#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=../lib/common.sh
source "$ROOT_DIR/ops/lib/common.sh"
# shellcheck source=../lib/require-env-class.sh
source "$ROOT_DIR/ops/lib/require-env-class.sh"

require_cmd bun
ensure_dirs

if [[ -f "$ROOT_DIR/server/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/server/.env"
  set +a
fi

founder_email="sawyerbeck25@gmail.com"
founder_name="Sawyer Beck"
org_name="Rental Voice Founder"
base_plan="starter"
founder_plan="${FOUNDER_PLAN_OVERRIDE:-enterprise}"
execute_flag="false"
yes_flag="false"
password=""
output_path="$MANIFEST_DIR/founder-bootstrap-$(timestamp_utc).json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      founder_email="$2"
      shift 2
      ;;
    --name)
      founder_name="$2"
      shift 2
      ;;
    --org-name)
      org_name="$2"
      shift 2
      ;;
    --base-plan)
      base_plan="$2"
      shift 2
      ;;
    --founder-plan)
      founder_plan="$2"
      shift 2
      ;;
    --password)
      password="$2"
      shift 2
      ;;
    --output)
      output_path="$2"
      shift 2
      ;;
    --execute)
      execute_flag="true"
      shift
      ;;
    --yes)
      yes_flag="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$execute_flag" == "true" && "$yes_flag" != "true" ]]; then
  echo "Refusing to execute founder bootstrap without --yes" >&2
  exit 1
fi

if [[ "$execute_flag" == "true" ]]; then
  require_runtime_env_class "live" "founder-bootstrap"
  echo "[founder-bootstrap] Executing founder bootstrap against configured Supabase project"
else
  require_runtime_env_class "live,staging,test,smoke,dev,unset" "founder-bootstrap"
  echo "[founder-bootstrap] Dry run only. No auth user or database rows will be created."
fi

cmd=(
  bun
  run
  "$ROOT_DIR/server/scripts/bootstrap-founder-account.ts"
  --email "$founder_email"
  --name "$founder_name"
  --org-name "$org_name"
  --base-plan "$base_plan"
  --founder-plan "$founder_plan"
  --output "$output_path"
)

if [[ -n "$password" ]]; then
  cmd+=(--password "$password")
fi

if [[ "$execute_flag" == "true" ]]; then
  cmd+=(--execute)
fi

"${cmd[@]}"

echo "[founder-bootstrap] Result manifest: $output_path"
