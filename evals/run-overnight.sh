#!/bin/bash
# Rental Voice — Overnight Promptfoo Eval Runner
# Run with: bash evals/run-overnight.sh

set -e

cd /Users/sawbeck/Projects/RentalVoice

export GOOGLE_API_KEY=AIzaSyCwZPO8K6vkFJ_Q8mb59TotQ6uhBgpvQu4

PROMPTFOO=/Users/sawbeck/.local/node/node-v22.22.0-darwin-arm64/bin/promptfoo
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
LOG_FILE="evals/results/eval-${TIMESTAMP}.log"
RESULT_FILE="evals/results/eval-${TIMESTAMP}.json"

echo "Starting Rental Voice prompt evaluation at $(date)"
echo "Log: ${LOG_FILE}"
echo "Results: ${RESULT_FILE}"
echo ""

# Run the eval
${PROMPTFOO} eval \
  --config evals/promptfooconfig.yaml \
  --no-cache \
  --output "${RESULT_FILE}" \
  2>&1 | tee "${LOG_FILE}"

echo ""
echo "Evaluation complete at $(date)"
echo "Results saved to: ${RESULT_FILE}"
echo ""
echo "To view results in browser: ${PROMPTFOO} view"
