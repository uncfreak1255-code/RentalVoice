import { getSupabaseAdmin } from '../db/supabase.js';

export type VoiceReadinessState = 'untrained' | 'learning' | 'ready' | 'degraded';

export interface VoiceReadiness {
  state: VoiceReadinessState;
  importedExamples: number;
  styleSamples: number;
  semanticReady: boolean;
  autopilotEligible: boolean;
  reason: string;
}

const READY_IMPORTED_EXAMPLES = 100;
const READY_STYLE_SAMPLES = 20;
const LEARNING_IMPORTED_EXAMPLES = 20;
const LEARNING_STYLE_SAMPLES = 5;

export function getVoiceReadiness(input: {
  importedExamples: number;
  styleSamples: number;
  semanticReady: boolean;
}): VoiceReadiness {
  const { importedExamples, styleSamples, semanticReady } = input;

  if ((importedExamples > 0 || styleSamples > 0) && !semanticReady) {
    return {
      state: 'degraded',
      importedExamples,
      styleSamples,
      semanticReady,
      autopilotEligible: false,
      reason: 'Voice data exists, but semantic grounding is not ready.',
    };
  }

  if (
    semanticReady &&
    importedExamples >= READY_IMPORTED_EXAMPLES &&
    styleSamples >= READY_STYLE_SAMPLES
  ) {
    return {
      state: 'ready',
      importedExamples,
      styleSamples,
      semanticReady,
      autopilotEligible: true,
      reason: 'Server voice model is grounded and autopilot is eligible.',
    };
  }

  if (
    semanticReady &&
    (importedExamples >= LEARNING_IMPORTED_EXAMPLES || styleSamples >= LEARNING_STYLE_SAMPLES)
  ) {
    return {
      state: 'learning',
      importedExamples,
      styleSamples,
      semanticReady,
      autopilotEligible: false,
      reason: 'Voice model is still learning from imported history and edits.',
    };
  }

  return {
    state: 'untrained',
    importedExamples,
    styleSamples,
    semanticReady,
    autopilotEligible: false,
    reason: 'Not enough imported voice data yet.',
  };
}

async function getStyleSamples(orgId: string, propertyId: string | null): Promise<number> {
  const supabase = getSupabaseAdmin();

  if (propertyId) {
    const { data } = await supabase
      .from('host_style_profiles')
      .select('samples_analyzed')
      .eq('org_id', orgId)
      .eq('property_id', propertyId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (typeof data?.samples_analyzed === 'number') {
      return data.samples_analyzed;
    }
  }

  const { data } = await supabase
    .from('host_style_profiles')
    .select('samples_analyzed')
    .eq('org_id', orgId)
    .is('property_id', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return typeof data?.samples_analyzed === 'number' ? data.samples_analyzed : 0;
}

async function getImportedExamples(orgId: string, propertyId: string | null): Promise<number> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('voice_examples')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('origin_type', 'historical');

  if (propertyId) {
    query = query.eq('property_id', propertyId);
  }

  const { count } = await query;
  return count || 0;
}

export async function getVoiceReadinessForOrg(
  orgId: string,
  propertyId?: string | null
): Promise<VoiceReadiness> {
  const scopedPropertyId = propertyId ? String(propertyId) : null;
  const [importedExamples, styleSamples] = await Promise.all([
    getImportedExamples(orgId, scopedPropertyId),
    getStyleSamples(orgId, scopedPropertyId),
  ]);

  return getVoiceReadiness({
    importedExamples,
    styleSamples,
    semanticReady: importedExamples > 0,
  });
}
