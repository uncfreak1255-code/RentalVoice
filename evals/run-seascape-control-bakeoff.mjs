import fs from 'node:fs';
import path from 'node:path';

import { runSeascapeControlFromVars } from './providers/seascape-control-provider.mjs';

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    console.error(
      'Usage: node evals/run-seascape-control-bakeoff.mjs <sample-json-path> <output-json-path>',
    );
    process.exit(1);
  }

  const sampleRows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(sampleRows)) {
    throw new Error('Sample input must be a JSON array');
  }

  const results = [];
  for (const row of sampleRows) {
    const result = await runSeascapeControlFromVars({
      conversationId: row.conversationId,
      listingId: row.listingId,
      propertyName: row.propertyName,
      guestName: row.guestName,
      channel: row.channel,
      historyText: row.historyText,
    });

    results.push({
      conversationId: row.conversationId,
      listingId: row.listingId,
      propertyName: row.propertyName,
      guestName: row.guestName,
      channel: row.channel,
      output: result.output,
      control: result.raw,
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} Seascape control results to ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
