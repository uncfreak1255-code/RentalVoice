#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=../lib/common.sh
source "$ROOT_DIR/ops/lib/common.sh"

ensure_dirs

if [[ -f "$ROOT_DIR/server/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/server/.env"
  set +a
fi

founder_email="sawyerbeck25@gmail.com"
output_path="$MANIFEST_DIR/founder-live-readiness-$(timestamp_utc).json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      founder_email="$2"
      shift 2
      ;;
    --output)
      output_path="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

env_class="${SUPABASE_ENV_CLASS:-unset}"
project_ref="${SUPABASE_PROJECT_REF:-unknown}"
project_label="${SUPABASE_PROJECT_LABEL:-unknown}"

founder_emails_current="${FOUNDER_EMAILS:-}"
founder_plan_override_current="${FOUNDER_PLAN_OVERRIDE:-}"
founder_billing_bypass_current="${FOUNDER_BILLING_BYPASS:-}"

forbidden_ref_reason="none"
if [[ "$project_ref" == "gqnocsoouudbogwislsl" ]]; then
  forbidden_ref_reason="linked_test_project"
elif [[ "$project_ref" == "cqbzsntmlwpsaxwnoath" ]]; then
  forbidden_ref_reason="legacy_empty_project"
fi

is_live_env="false"
if [[ "$env_class" == "live" ]]; then
  is_live_env="true"
fi

is_forbidden_ref="false"
if [[ "$forbidden_ref_reason" != "none" ]]; then
  is_forbidden_ref="true"
fi

is_founder_env_configured="false"
if [[ -n "$founder_emails_current" && -n "$founder_plan_override_current" && -n "$founder_billing_bypass_current" ]]; then
  is_founder_env_configured="true"
fi

cat > "$output_path" <<EOF
{
  "generatedAtUtc": "$(timestamp_utc)",
  "intent": "future_live_founder_environment_readiness",
  "founderTargetEmail": "$founder_email",
  "currentRuntimeEnvironment": {
    "supabaseEnvClass": "$env_class",
    "supabaseProjectRef": "$project_ref",
    "supabaseProjectLabel": "$project_label"
  },
  "requiredEnvironmentContract": {
    "requiredKeys": [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_ENV_CLASS",
      "SUPABASE_PROJECT_REF",
      "SUPABASE_PROJECT_LABEL",
      "FOUNDER_EMAILS",
      "FOUNDER_PLAN_OVERRIDE",
      "FOUNDER_BILLING_BYPASS"
    ],
    "requiredValues": {
      "SUPABASE_ENV_CLASS": "live",
      "FOUNDER_EMAILS": "$founder_email",
      "FOUNDER_PLAN_OVERRIDE": "enterprise",
      "FOUNDER_BILLING_BYPASS": "true"
    }
  },
  "currentFounderEnv": {
    "FOUNDER_EMAILS": "${founder_emails_current:-unset}",
    "FOUNDER_PLAN_OVERRIDE": "${founder_plan_override_current:-unset}",
    "FOUNDER_BILLING_BYPASS": "${founder_billing_bypass_current:-unset}"
  },
  "forbiddenProjectRefs": [
    {
      "projectRef": "gqnocsoouudbogwislsl",
      "reason": "linked_test_project_with_test_smoke_app_users_only"
    },
    {
      "projectRef": "cqbzsntmlwpsaxwnoath",
      "reason": "legacy_project_with_no_app_auth_users"
    }
  ],
  "readinessSummary": {
    "isLiveEnvironment": $is_live_env,
    "isForbiddenProjectRef": $is_forbidden_ref,
    "forbiddenProjectRefReason": "$forbidden_ref_reason",
    "isFounderEnvConfigured": $is_founder_env_configured,
    "readyForFounderBootstrapExecute": false
  },
  "bootstrapCommands": {
    "preflight": "npm run ops:founder:preflight",
    "dryRun": "npm run ops:founder:bootstrap",
    "execute": "npm run ops:founder:bootstrap -- --execute --yes --password '<temporary-password>'"
  },
  "postBootstrapValidation": [
    "GET /api/auth/me",
    "GET /api/billing/status",
    "GET /api/entitlements/current",
    "GET /api/analytics/founder-diagnostics"
  ],
  "migrationPrerequisites": [
    "Create a protected baseline at current HEAD",
    "Choose a real live Supabase project that is not one of the forbidden refs",
    "Set the live environment metadata and founder env keys",
    "Run founder preflight successfully",
    "Create founder account and org",
    "Only then rehearse personal-to-founder migration"
  ]
}
EOF

echo "[founder-readiness] Manifest written: $output_path"
