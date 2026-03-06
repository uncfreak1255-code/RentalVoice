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
output_path="$MANIFEST_DIR/founder-bootstrap-packet-$(timestamp_utc).json"

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

cat > "$output_path" <<EOF
{
  "generatedAtUtc": "$(timestamp_utc)",
  "intent": "founder_bootstrap_execution_packet",
  "founderTargetEmail": "$founder_email",
  "requiredEnvKeys": [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ENV_CLASS",
    "SUPABASE_PROJECT_REF",
    "SUPABASE_PROJECT_LABEL",
    "FOUNDER_EMAILS",
    "FOUNDER_PLAN_OVERRIDE",
    "FOUNDER_BILLING_BYPASS"
  ],
  "requiredBaselineStep": {
    "required": true,
    "command": "npm run ops:baseline:protect -- --checkpoint-id protected-local-baseline-<timestamp>",
    "reason": "Create a fresh rollback anchor immediately before founder bootstrap or migration work."
  },
  "commandOrder": [
    "npm run ops:founder:checklist",
    "npm run ops:founder:packet",
    "npm run ops:founder:preflight",
    "npm run ops:founder:bootstrap -- --execute --yes --password '<temporary-password>'",
    "GET /api/auth/me",
    "GET /api/billing/status",
    "GET /api/entitlements/current",
    "GET /api/analytics/founder-diagnostics"
  ],
  "rehearsalCommandOrder": [
    "npm run ops:founder:checklist",
    "npm run ops:founder:packet",
    "npm run ops:founder:preflight:rehearsal",
    "ALLOW_NONLIVE_SUPABASE=true npm run ops:founder:bootstrap -- --execute --yes --rehearsal --password '<temporary-password>'"
  ],
  "environmentSnapshot": {
    "supabaseEnvClass": "${SUPABASE_ENV_CLASS:-unset}",
    "supabaseProjectRef": "${SUPABASE_PROJECT_REF:-unknown}",
    "supabaseProjectLabel": "${SUPABASE_PROJECT_LABEL:-unknown}",
    "founderEmails": "${FOUNDER_EMAILS:-unset}",
    "founderPlanOverride": "${FOUNDER_PLAN_OVERRIDE:-unset}",
    "founderBillingBypass": "${FOUNDER_BILLING_BYPASS:-unset}"
  },
  "validationEndpoints": [
    "GET /api/auth/me",
    "GET /api/billing/status",
    "GET /api/entitlements/current",
    "GET /api/analytics/founder-diagnostics",
    "GET /api/migration/local-learning/status"
  ],
  "rollbackReminder": {
    "required": true,
    "artifactFamily": [
      "protected-local-baseline",
      "founder-bootstrap-manifest",
      "founder-live-readiness-manifest",
      "founder-bootstrap-packet"
    ]
  }
}
EOF

echo "[founder-packet] Packet written: $output_path"
