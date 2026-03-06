#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

checkpoint_id=""
manifest_path=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --checkpoint-id)
      checkpoint_id="$2"
      shift 2
      ;;
    --manifest)
      manifest_path="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${STAGING_DATABASE_URL:-}" ]]; then
  echo "Missing required env var: STAGING_DATABASE_URL" >&2
  exit 1
fi

restore_args=("--yes")
if [[ -n "$manifest_path" ]]; then
  restore_args+=("--manifest" "$manifest_path")
elif [[ -n "$checkpoint_id" ]]; then
  restore_args+=("--checkpoint-id" "$checkpoint_id")
else
  echo "Usage: $0 --checkpoint-id <id> | --manifest <path>" >&2
  exit 1
fi

echo "[drill] Running restore drill against STAGING_DATABASE_URL"
DATABASE_URL="$STAGING_DATABASE_URL" \
  bash "$ROOT_DIR/ops/restore/restore-db-from-checkpoint.sh" "${restore_args[@]}"

if [[ -n "${DRILL_POSTCHECK_CMD:-}" ]]; then
  echo "[drill] Running post-restore verification command"
  eval "$DRILL_POSTCHECK_CMD"
fi

echo "[drill] Restore drill completed"
