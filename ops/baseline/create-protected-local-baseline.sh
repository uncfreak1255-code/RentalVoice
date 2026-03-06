#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=../lib/common.sh
source "$ROOT_DIR/ops/lib/common.sh"

ensure_dirs

checkpoint_id="protected-local-baseline-$(timestamp_utc)"

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

echo "[baseline] Creating protected local baseline checkpoint: $checkpoint_id"
bash "$ROOT_DIR/ops/checkpoint/create-checkpoint.sh" --checkpoint-id "$checkpoint_id"

echo "[baseline] Verifying protected local baseline checkpoint: $checkpoint_id"
bash "$ROOT_DIR/ops/checkpoint/verify-checkpoint.sh" --checkpoint-id "$checkpoint_id"

manifest_path="$MANIFEST_DIR/${checkpoint_id}.json"
baseline_manifest_path="$MANIFEST_DIR/${checkpoint_id}.baseline.json"

node --input-type=module - "$manifest_path" "$baseline_manifest_path" "$checkpoint_id" <<'EOF'
import fs from 'fs';

const [manifestPath, baselineManifestPath, checkpointId] = process.argv.slice(2);
const checkpoint = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const baseline = {
  baselineId: checkpointId,
  createdAt: checkpoint.createdAt,
  checkpointManifest: manifestPath,
  backupFile: checkpoint.backupFile,
  checksumSha256: checkpoint.checksumSha256,
  s3Object: checkpoint.s3Object || '',
  runtimeContext: checkpoint.runtimeContext || {},
  protectionContract: {
    canonicalSource: 'local_workspace',
    githubCanonical: false,
    currentUserFacingMode: 'personal',
    hostawayFirstUxFrozen: true,
    visibleAppAuth: 'not_exposed',
    visibleBillingInPersonalMode: false,
    deviceLocalPmsBehaviorPreserved: true,
  },
  founderFutureState: {
    founderEmail: 'sawyerbeck25@gmail.com',
    founderAppAuthUserExistsInCurrentProjects: false,
    currentProjectsAreLiveFounderEnvironment: false,
    futureFounderBootstrapRequired: true,
    futureFounderDataMigrationRequired: true,
  },
  knownEnvironmentTruths: [
    {
      projectRef: 'gqnocsoouudbogwislsl',
      label: 'Rental Voice',
      status: 'linked_project_with_test_smoke_app_users_only',
    },
    {
      projectRef: 'cqbzsntmlwpsaxwnoath',
      label: "uncfreak1255-code's Project",
      status: 'separate_project_with_no_app_auth_users',
    },
  ],
  nextSafeMoves: [
    'Treat the local workspace as canonical until a controlled promotion to GitHub is complete.',
    'Do not enable commercial mode as the default user-facing app path yet.',
    'Create the future founder app-auth account only in the intentionally chosen live environment.',
    'Use the later founder migration contract to import personal learning data one-way into that founder account.',
  ],
};

fs.writeFileSync(baselineManifestPath, `${JSON.stringify(baseline, null, 2)}\n`);
EOF

echo "[baseline] Protected baseline manifest written: $baseline_manifest_path"
echo "[baseline] Baseline locked: $checkpoint_id"
