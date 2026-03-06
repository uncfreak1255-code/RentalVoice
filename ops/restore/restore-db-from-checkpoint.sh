#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

require_cmd pg_restore
require_env DATABASE_URL
ensure_dirs

checkpoint_id=""
manifest_path=""
yes_flag="false"

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

if [[ "$yes_flag" != "true" ]]; then
  echo "Refusing to restore without --yes (destructive operation)." >&2
  exit 1
fi

if [[ -z "$manifest_path" ]]; then
  if [[ -z "$checkpoint_id" ]]; then
    echo "Usage: $0 --checkpoint-id <id> [--yes] | --manifest <path> [--yes]" >&2
    exit 1
  fi
  manifest_path="$MANIFEST_DIR/${checkpoint_id}.json"
fi

if [[ ! -f "$manifest_path" ]]; then
  echo "Manifest not found: $manifest_path" >&2
  exit 1
fi

backup_file="$(json_field "$manifest_path" "backupFile")"
expected_checksum="$(json_field "$manifest_path" "checksumSha256")"
s3_object="$(json_field "$manifest_path" "s3Object")"

if [[ ! -f "$backup_file" ]]; then
  if [[ -n "$s3_object" ]]; then
    require_cmd aws
    mkdir -p "$(dirname "$backup_file")"
    echo "[restore] Downloading backup from $s3_object"
    aws s3 cp "$s3_object" "$backup_file"
  else
    echo "Backup file not found locally and no s3Object in manifest: $backup_file" >&2
    exit 1
  fi
fi

actual_checksum="$(sha256_file "$backup_file")"
if [[ "$actual_checksum" != "$expected_checksum" ]]; then
  echo "Checksum mismatch for $backup_file" >&2
  echo "Expected: $expected_checksum" >&2
  echo "Actual:   $actual_checksum" >&2
  exit 1
fi

restore_file="$backup_file"
tmp_decrypted=""

if [[ "$backup_file" == *.enc ]]; then
  require_cmd openssl
  require_env BACKUP_ENCRYPTION_KEY
  tmp_decrypted="$(mktemp "${TMPDIR:-/tmp}/checkpoint-restore-XXXXXX.dump")"
  echo "[restore] Decrypting backup to temporary file"
  openssl enc -d -aes-256-cbc -pbkdf2 -in "$backup_file" -out "$tmp_decrypted" -pass env:BACKUP_ENCRYPTION_KEY
  restore_file="$tmp_decrypted"
fi

echo "[restore] Restoring database from $restore_file"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$restore_file"
echo "[restore] Database restore complete"

if [[ -n "$tmp_decrypted" && -f "$tmp_decrypted" ]]; then
  rm -f "$tmp_decrypted"
fi
