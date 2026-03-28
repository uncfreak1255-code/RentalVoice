#!/bin/bash
# Rental Voice — Overnight Promptfoo Eval Runner
# Run with: bash evals/run-overnight.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

if [[ -z "${GOOGLE_API_KEY:-}" ]]; then
  echo "GOOGLE_API_KEY is required"
  exit 1
fi

PROMPTFOO="${PROMPTFOO:-/Users/sawbeck/.local/node/node-v22.22.0-darwin-arm64/bin/promptfoo}"
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
RESULTS_DIR="evals/results"
FOUNDER_LOG="${RESULTS_DIR}/eval-founder-${TIMESTAMP}.log"
FOUNDER_RESULT="${RESULTS_DIR}/eval-founder-${TIMESTAMP}.json"
COLD_START_LOG="${RESULTS_DIR}/eval-cold-start-${TIMESTAMP}.log"
COLD_START_RESULT="${RESULTS_DIR}/eval-cold-start-${TIMESTAMP}.json"

mkdir -p "${RESULTS_DIR}"

echo "Starting Rental Voice founder and cold-start evaluations at $(date)"
echo "Founder log: ${FOUNDER_LOG}"
echo "Founder results: ${FOUNDER_RESULT}"
echo "Cold-start log: ${COLD_START_LOG}"
echo "Cold-start results: ${COLD_START_RESULT}"
echo ""

# Founder canary
${PROMPTFOO} eval \
  --config evals/promptfooconfig-founder.yaml \
  --no-cache \
  --output "${FOUNDER_RESULT}" \
  2>&1 | tee "${FOUNDER_LOG}"

echo ""
echo "Founder canary complete at $(date)"
echo ""

# Cold-start onboarding
${PROMPTFOO} eval \
  --config evals/promptfooconfig-cold-start.yaml \
  --no-cache \
  --output "${COLD_START_RESULT}" \
  2>&1 | tee "${COLD_START_LOG}"

echo ""
echo "Evaluation complete at $(date)"
echo "Founder results saved to: ${FOUNDER_RESULT}"
echo "Cold-start results saved to: ${COLD_START_RESULT}"
echo ""
echo "To view results in browser: ${PROMPTFOO} view"
