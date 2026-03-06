#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=../lib/common.sh
source "$ROOT_DIR/ops/lib/common.sh"
# shellcheck source=../lib/require-env-class.sh
source "$ROOT_DIR/ops/lib/require-env-class.sh"

if [[ -f "$ROOT_DIR/server/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/server/.env"
  set +a
fi

require_env "SUPABASE_URL"
require_env "SUPABASE_SERVICE_ROLE_KEY"
require_env "SUPABASE_ENV_CLASS"
require_env "SUPABASE_PROJECT_REF"
require_env "SUPABASE_PROJECT_LABEL"

mode="live"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      mode="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

case "$mode" in
  live)
    require_runtime_env_class "live" "founder-preflight"
    ;;
  rehearsal)
    if [[ "${ALLOW_NONLIVE_SUPABASE:-false}" != "true" ]]; then
      echo "[founder-preflight] Refusing rehearsal mode without ALLOW_NONLIVE_SUPABASE=true." >&2
      exit 1
    fi
    require_runtime_env_class "staging,test,smoke,dev" "founder-preflight"
    ;;
  *)
    echo "Unknown mode: $mode" >&2
    exit 1
    ;;
esac

require_non_forbidden_founder_project_ref "founder-preflight"

if [[ "$mode" == "live" ]]; then
  echo "[founder-preflight] Live founder environment metadata looks valid."
else
  echo "[founder-preflight] Rehearsal founder environment metadata looks valid."
fi

echo "[founder-preflight] Project: ${SUPABASE_PROJECT_LABEL} (${SUPABASE_PROJECT_REF})"
echo "[founder-preflight] SUPABASE_ENV_CLASS=${SUPABASE_ENV_CLASS}"
