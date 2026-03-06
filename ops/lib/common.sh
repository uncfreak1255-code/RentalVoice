#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST_DIR="${MANIFEST_DIR:-$ROOT_DIR/ops/manifests}"
CHECKPOINT_DIR="${CHECKPOINT_DIR:-$ROOT_DIR/ops/checkpoints}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/ops/logs}"

timestamp_utc() {
  date -u +"%Y%m%dT%H%M%SZ"
}

ensure_dirs() {
  mkdir -p "$MANIFEST_DIR" "$CHECKPOINT_DIR" "$LOG_DIR"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

sha256_file() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    openssl dgst -sha256 "$file" | awk '{print $NF}'
  fi
}

json_field() {
  local manifest_path="$1"
  local field="$2"
  node -e "const fs=require('fs'); const x=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(String(x[process.argv[2]] ?? ''));" "$manifest_path" "$field"
}
