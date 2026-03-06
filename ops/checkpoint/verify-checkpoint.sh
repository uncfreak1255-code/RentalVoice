#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

ensure_dirs

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

if [[ -z "$manifest_path" ]]; then
  if [[ -z "$checkpoint_id" ]]; then
    echo "Usage: $0 --checkpoint-id <id> | --manifest <path>" >&2
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

if [[ -z "$expected_checksum" ]]; then
  echo "Manifest missing checksumSha256" >&2
  exit 1
fi

if [[ -f "$backup_file" ]]; then
  actual_checksum="$(sha256_file "$backup_file")"
  if [[ "$actual_checksum" != "$expected_checksum" ]]; then
    echo "Checksum mismatch for $backup_file" >&2
    echo "Expected: $expected_checksum" >&2
    echo "Actual:   $actual_checksum" >&2
    exit 1
  fi
  echo "[verify] Local backup checksum verified"
else
  echo "[verify] Local backup file not found: $backup_file"
fi

if [[ -n "$s3_object" ]]; then
  require_cmd aws
  if aws s3 ls "$s3_object" >/dev/null 2>&1; then
    echo "[verify] Remote backup object exists: $s3_object"
  else
    echo "Remote backup object not found: $s3_object" >&2
    exit 1
  fi
fi

echo "[verify] Checkpoint verification passed: $manifest_path"
