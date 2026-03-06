import { createClient } from '@supabase/supabase-js';
import { PLAN_LIMITS, type PlanTier } from '../src/lib/types.js';

const DRY_RUN_USER_ID = '00000000-0000-0000-0000-000000000001';
const DRY_RUN_ORG_ID = '00000000-0000-0000-0000-000000000002';

type Args = {
  email: string;
  name: string;
  orgName: string;
  basePlan: PlanTier;
  founderPlan: PlanTier;
  password?: string;
  execute: boolean;
  output?: string;
};

type RuntimeEnvironmentSummary = {
  envClass: string;
  projectRef: string;
  projectLabel: string;
  allowNonLive: boolean;
};

function parseArgs(argv: string[]): Args {
  const parsed: Partial<Args> = {
    email: 'sawyerbeck25@gmail.com',
    name: 'Sawyer Beck',
    orgName: 'Rental Voice Founder',
    basePlan: 'starter',
    founderPlan: 'enterprise',
    execute: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--email':
        parsed.email = argv[++i];
        break;
      case '--name':
        parsed.name = argv[++i];
        break;
      case '--org-name':
        parsed.orgName = argv[++i];
        break;
      case '--base-plan':
        parsed.basePlan = argv[++i] as PlanTier;
        break;
      case '--founder-plan':
        parsed.founderPlan = argv[++i] as PlanTier;
        break;
      case '--password':
        parsed.password = argv[++i];
        break;
      case '--output':
        parsed.output = argv[++i];
        break;
      case '--execute':
        parsed.execute = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!parsed.email || !parsed.name || !parsed.orgName || !parsed.basePlan || !parsed.founderPlan) {
    throw new Error('Missing required founder bootstrap arguments');
  }

  return parsed as Args;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getRuntimeEnvironmentSummary(): RuntimeEnvironmentSummary {
  return {
    envClass: process.env.SUPABASE_ENV_CLASS || 'unset',
    projectRef: process.env.SUPABASE_PROJECT_REF || 'unknown',
    projectLabel: process.env.SUPABASE_PROJECT_LABEL || 'unknown',
    allowNonLive: process.env.ALLOW_NONLIVE_SUPABASE === 'true',
  };
}

async function findAuthUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;

    const users = data.users || [];
    const found = users.find((user) => (user.email || '').trim().toLowerCase() === normalized);
    if (found) return found;
    if (users.length < 200) return null;
    page += 1;
  }
}

function buildEntitlements(plan: PlanTier) {
  const limits = PLAN_LIMITS[plan];
  return {
    plan_tier: plan,
    supermemory_enabled: limits.supermemoryIncluded,
    supermemory_mode: limits.supermemoryIncluded ? 'full' : 'off',
    supermemory_write_limit_monthly: limits.supermemoryWriteLimitMonthly,
    supermemory_read_limit_monthly: limits.supermemoryReadLimitMonthly,
    supermemory_retention_days: limits.supermemoryRetentionDays,
    supermemory_top_k: limits.supermemoryTopK,
    supermemory_cross_property: limits.supermemoryCrossProperty,
    supermemory_team_shared: limits.supermemoryTeamShared,
    supermemory_addon_active: false,
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const runtimeEnvironment = getRuntimeEnvironmentSummary();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const actions: string[] = [];
  const warnings: string[] = [];
  const recommendedFounderEnv = {
    FOUNDER_EMAILS: args.email,
    FOUNDER_PLAN_OVERRIDE: args.founderPlan,
    FOUNDER_BILLING_BYPASS: 'true',
  };

  let authUser = await findAuthUserByEmail(supabase, args.email);
  if (!authUser) {
    actions.push(`Create auth user for ${args.email}`);
    if (args.execute) {
      if (!args.password) {
        throw new Error('A password is required when creating a new founder auth user');
      }
      const { data, error } = await supabase.auth.admin.createUser({
        email: args.email,
        password: args.password,
        email_confirm: true,
        user_metadata: {
          name: args.name,
          bootstrap_source: 'founder_account_v1',
        },
      });
      if (error) throw error;
      authUser = data.user;
    }
  }

  const founderUserId = authUser?.id || DRY_RUN_USER_ID;

  const { data: existingUserRow, error: userRowError } = await supabase
    .from('users')
    .select('id, email, plan, trial_ends_at')
    .eq('id', founderUserId)
    .maybeSingle();
  if (userRowError) throw userRowError;

  if (!existingUserRow) {
    actions.push(`Create users row for ${founderUserId}`);
    if (args.execute) {
      const { error } = await supabase.from('users').insert({
        id: founderUserId,
        email: args.email,
        name: args.name,
        plan: args.basePlan,
        trial_ends_at: null,
      });
      if (error) throw error;
    }
  }

  const { data: existingMembership, error: membershipError } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', founderUserId)
    .maybeSingle();
  if (membershipError) throw membershipError;

  let orgId = existingMembership?.org_id || null;

  if (!orgId) {
    actions.push(`Create organization and owner membership for ${founderUserId}`);
    if (args.execute) {
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: args.orgName,
          owner_id: founderUserId,
        })
        .select('id')
        .single();
      if (orgError) throw orgError;
      orgId = organization.id;

      const { error: memberInsertError } = await supabase.from('org_members').insert({
        org_id: orgId,
        user_id: founderUserId,
        role: 'owner',
      });
      if (memberInsertError) throw memberInsertError;
    } else {
      orgId = DRY_RUN_ORG_ID;
    }
  }

  const { data: existingSettings, error: settingsError } = await supabase
    .from('org_settings')
    .select('org_id')
    .eq('org_id', orgId)
    .maybeSingle();
  if (settingsError) throw settingsError;

  if (!existingSettings) {
    actions.push(`Create org_settings row for ${orgId}`);
    if (args.execute) {
      const { error } = await supabase.from('org_settings').insert({ org_id: orgId });
      if (error) throw error;
    }
  }

  const { data: existingAiConfig, error: aiConfigError } = await supabase
    .from('ai_configs')
    .select('org_id, mode')
    .eq('org_id', orgId)
    .maybeSingle();
  if (aiConfigError) throw aiConfigError;

  if (!existingAiConfig) {
    actions.push(`Create managed ai_configs row for ${orgId}`);
    if (args.execute) {
      const { error } = await supabase.from('ai_configs').insert({
        org_id: orgId,
        mode: 'managed',
      });
      if (error) throw error;
    }
  }

  const { data: existingEntitlements, error: entitlementsError } = await supabase
    .from('org_entitlements')
    .select('org_id, plan_tier')
    .eq('org_id', orgId)
    .maybeSingle();
  if (entitlementsError) throw entitlementsError;

  if (!existingEntitlements || existingEntitlements.plan_tier !== args.founderPlan) {
    actions.push(`Upsert org_entitlements for ${orgId} using ${args.founderPlan}`);
    if (args.execute) {
      const { error } = await supabase.from('org_entitlements').upsert({
        org_id: orgId,
        ...buildEntitlements(args.founderPlan),
      }, { onConflict: 'org_id' });
      if (error) throw error;
    }
  }

  if (args.basePlan !== 'starter') {
    warnings.push('Base plan is not starter; founder access will still work, but the bypass model is less explicit.');
  }

  const result = {
    execute: args.execute,
    founderEmail: args.email,
    founderName: args.name,
    founderUserId,
    orgId,
    basePlan: args.basePlan,
    founderPlan: args.founderPlan,
    runtimeEnvironment,
    existing: {
      authUser: !!authUser,
      userRow: !!existingUserRow,
      membership: !!existingMembership,
      aiConfig: !!existingAiConfig,
      entitlements: !!existingEntitlements,
    },
    actions,
    warnings,
    recommendedFounderEnv,
    validationChecklist: [
      'Set FOUNDER_EMAILS to the founder email in the chosen live environment.',
      'Set FOUNDER_PLAN_OVERRIDE to the desired effective plan before founder smoke tests.',
      'Set FOUNDER_BILLING_BYPASS=true before opening billing surfaces on the founder account.',
      'Verify /api/auth/me, /api/billing/status, /api/entitlements/current, and /api/analytics/founder-diagnostics with the founder session.',
    ],
  };

  if (args.output) {
    await Bun.write(args.output, `${JSON.stringify(result, null, 2)}\n`);
  }

  console.log(JSON.stringify(result, null, 2));
}

await main();
