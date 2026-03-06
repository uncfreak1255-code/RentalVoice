#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

ensure_dirs

checkpoint_id="${CHECKPOINT_ID:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --checkpoint-id)
      checkpoint_id="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

timestamp="$(timestamp_utc)"
log_file="$LOG_DIR/rollback-${timestamp}.log"

exec > >(tee -a "$log_file") 2>&1

echo "[rollback] Starting fast rollback at $timestamp"
echo "[rollback] Checkpoint: ${checkpoint_id:-none specified}"

flags_payload='{
  "USE_SERVER_ENTITLEMENTS": false,
  "USE_SERVER_LEARNING": false,
  "AUTO_IMPORT_LEARNING": false,
  "USE_SUPERMEMORY_SERVER": false,
  "STRICT_ACCOUNT_SCOPING": true
}'

if [[ -n "${FEATURE_FLAG_WEBHOOK_URL:-}" ]]; then
  require_cmd curl
  echo "[rollback] Applying safe feature flags via webhook"
  curl -fsS -X POST "$FEATURE_FLAG_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    ${FEATURE_FLAG_WEBHOOK_TOKEN:+-H "Authorization: Bearer $FEATURE_FLAG_WEBHOOK_TOKEN"} \
    -d "$flags_payload"
else
  flags_file="$LOG_DIR/rollback-flags-${timestamp}.json"
  echo "$flags_payload" > "$flags_file"
  echo "[rollback] FEATURE_FLAG_WEBHOOK_URL not set; wrote safe flags payload to $flags_file"
fi

if [[ -n "${PREVIOUS_SERVER_RELEASE_CMD:-}" ]]; then
  echo "[rollback] Rolling back server release"
  eval "$PREVIOUS_SERVER_RELEASE_CMD"
else
  echo "[rollback] PREVIOUS_SERVER_RELEASE_CMD not set; skipping server deploy rollback"
fi

if [[ -n "${PREVIOUS_EXPO_UPDATE_CMD:-}" ]]; then
  echo "[rollback] Rolling back Expo update channel"
  eval "$PREVIOUS_EXPO_UPDATE_CMD"
else
  echo "[rollback] PREVIOUS_EXPO_UPDATE_CMD not set; skipping Expo update rollback"
fi

echo "[rollback] Fast rollback sequence completed"
echo "[rollback] Log written to $log_file"
