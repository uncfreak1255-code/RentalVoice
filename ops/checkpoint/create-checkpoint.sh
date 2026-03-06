#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

require_cmd pg_dump
require_env DATABASE_URL
ensure_dirs

checkpoint_id="checkpoint-$(timestamp_utc)"

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

created_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
dump_path="$CHECKPOINT_DIR/${checkpoint_id}.dump"
archive_path="$dump_path"

echo "[checkpoint] Creating PostgreSQL dump at $dump_path"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$dump_path"

if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  require_cmd openssl
  encrypted_path="${dump_path}.enc"
  echo "[checkpoint] Encrypting dump to $encrypted_path"
  openssl enc -aes-256-cbc -pbkdf2 -salt -in "$dump_path" -out "$encrypted_path" -pass env:BACKUP_ENCRYPTION_KEY
  rm -f "$dump_path"
  archive_path="$encrypted_path"
fi

checksum="$(sha256_file "$archive_path")"
s3_object=""

if [[ -n "${BACKUP_BUCKET:-}" ]]; then
  require_cmd aws
  object_name="$(basename "$archive_path")"
  s3_object="${BACKUP_BUCKET%/}/${object_name}"
  echo "[checkpoint] Uploading backup to $s3_object"
  aws s3 cp "$archive_path" "$s3_object"
fi

git_sha="unknown"
if command -v git >/dev/null 2>&1 && git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_sha="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")"
fi

flags_snapshot="{}"
if [[ -n "${FLAGS_SNAPSHOT_FILE:-}" && -f "${FLAGS_SNAPSHOT_FILE}" ]]; then
  flags_snapshot="$(cat "${FLAGS_SNAPSHOT_FILE}")"
fi

runtime_context="$(node "$ROOT_DIR/ops/lib/build-runtime-manifest.mjs")"

manifest_path="$MANIFEST_DIR/${checkpoint_id}.json"
cat > "$manifest_path" <<EOF
{
  "checkpointId": "$checkpoint_id",
  "createdAt": "$created_at",
  "gitSha": "$git_sha",
  "backupFile": "$archive_path",
  "checksumSha256": "$checksum",
  "s3Object": "$s3_object",
  "flagsSnapshot": $flags_snapshot,
  "runtimeContext": $runtime_context
}
EOF

echo "[checkpoint] Manifest written: $manifest_path"
echo "[checkpoint] Done: $checkpoint_id"
