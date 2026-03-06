#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=../lib/common.sh
source "$ROOT_DIR/ops/lib/common.sh"
# shellcheck source=../lib/require-env-class.sh
source "$ROOT_DIR/ops/lib/require-env-class.sh"

ensure_dirs

checkpoint_id="commercial-cutover-$(timestamp_utc)"
skip_checkpoint="false"
auto_rollback_on_failure="${AUTO_ROLLBACK_ON_FAILURE:-true}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --checkpoint-id)
      checkpoint_id="$2"
      shift 2
      ;;
    --skip-checkpoint)
      skip_checkpoint="true"
      shift
      ;;
    --no-auto-rollback)
      auto_rollback_on_failure="false"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

timestamp="$(timestamp_utc)"
log_file="$LOG_DIR/controlled-migration-${timestamp}.log"
exec > >(tee -a "$log_file") 2>&1

on_failure() {
  local exit_code="$?"
  if [[ "$exit_code" -eq 0 ]]; then
    return
  fi

  echo "[migration] Controlled migration failed (exit $exit_code)"

  if [[ "$auto_rollback_on_failure" == "true" ]]; then
    echo "[migration] Running fast rollback with checkpoint: $checkpoint_id"
    bash "$ROOT_DIR/ops/rollback/fast-rollback.sh" --checkpoint-id "$checkpoint_id" || true
  else
    echo "[migration] Auto rollback disabled; skipping fast rollback"
  fi
}
trap on_failure EXIT

run_optional_cmd() {
  local label="$1"
  local cmd="$2"
  if [[ -z "$cmd" ]]; then
    echo "[migration] Skipping: $label (no command provided)"
    return
  fi

  echo "[migration] Running: $label"
  eval "$cmd"
}

echo "[migration] Starting controlled commercial migration"
echo "[migration] Checkpoint ID: $checkpoint_id"
echo "[migration] Log file: $log_file"

require_runtime_env_class "live" "migration"

if [[ "$skip_checkpoint" != "true" ]]; then
  echo "[migration] Step 1/6: Create pre-migration checkpoint"
  bash "$ROOT_DIR/ops/checkpoint/create-checkpoint.sh" --checkpoint-id "$checkpoint_id"

  echo "[migration] Step 2/6: Verify checkpoint integrity"
  bash "$ROOT_DIR/ops/checkpoint/verify-checkpoint.sh" --checkpoint-id "$checkpoint_id"
else
  echo "[migration] Step 1/6 skipped: checkpoint creation"
  echo "[migration] Step 2/6 skipped: checkpoint verification"
fi

echo "[migration] Step 3/6: Apply DB migrations (optional command)"
run_optional_cmd "APPLY_DB_MIGRATIONS_CMD" "${APPLY_DB_MIGRATIONS_CMD:-}"

echo "[migration] Step 4/6: Deploy server release (optional command)"
run_optional_cmd "DEPLOY_SERVER_RELEASE_CMD" "${DEPLOY_SERVER_RELEASE_CMD:-}"

echo "[migration] Step 5/6: Execute local-to-commercial learning import (optional command)"
run_optional_cmd "LOCAL_LEARNING_IMPORT_CMD" "${LOCAL_LEARNING_IMPORT_CMD:-}"

echo "[migration] Step 6/6: Run post-deploy smoke checks (optional command)"
run_optional_cmd "POST_DEPLOY_SMOKE_CMD" "${POST_DEPLOY_SMOKE_CMD:-}"

echo "[migration] Controlled migration completed successfully"
echo "[migration] Checkpoint retained: $checkpoint_id"
echo "[migration] Log written to $log_file"

trap - EXIT
