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

require_runtime_env_class "live" "founder-preflight"

if [[ "${SUPABASE_PROJECT_REF}" == "gqnocsoouudbogwislsl" ]]; then
  echo "[founder-preflight] Refusing linked test project ref gqnocsoouudbogwislsl as a live founder target." >&2
  exit 1
fi

if [[ "${SUPABASE_PROJECT_REF}" == "cqbzsntmlwpsaxwnoath" ]]; then
  echo "[founder-preflight] Refusing legacy empty project ref cqbzsntmlwpsaxwnoath as a live founder target." >&2
  exit 1
fi

echo "[founder-preflight] Live founder environment metadata looks valid."
echo "[founder-preflight] Project: ${SUPABASE_PROJECT_LABEL} (${SUPABASE_PROJECT_REF})"
echo "[founder-preflight] SUPABASE_ENV_CLASS=${SUPABASE_ENV_CLASS}"
