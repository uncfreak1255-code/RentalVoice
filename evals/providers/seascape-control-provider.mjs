import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function normalizeHistory(vars = {}) {
  if (typeof vars.historyText === 'string' && vars.historyText.trim()) {
    return vars.historyText.trim();
  }

  if (Array.isArray(vars.history)) {
    return vars.history.join('\n').trim();
  }

  if (typeof vars.conversationContext === 'string' && vars.conversationContext.trim()) {
    return vars.conversationContext.trim();
  }

  if (Array.isArray(vars.conversationHistory)) {
    return vars.conversationHistory
      .map((entry) => {
        const role = entry?.role === 'assistant' ? 'Host - Sawyer' : 'Guest';
        return `[${role}]: ${entry?.content || ''}`.trim();
      })
      .join('\n')
      .trim();
  }

  return '';
}

function extractGuestName(history) {
  const matches = Array.from(history.matchAll(/\[Guest(?:\s*-\s*([^\]]+))?\]:/g));
  const last = matches.at(-1);
  return last?.[1]?.trim() || '';
}

export function buildSeascapeControlInput(vars = {}) {
  const history = normalizeHistory(vars);
  const guestName = vars.guestName || extractGuestName(history);

  return {
    convId: String(vars.conversationId || vars.convId || vars.reservationId || 'eval'),
    listingId: String(vars.listingId || vars.propertyId || ''),
    propertyName: vars.propertyName || '',
    guestName,
    channel: vars.channel || vars.channelName || 'direct',
    history,
  };
}

export function resolveSeascapeControlAdapterPath(options = {}) {
  const candidates = [
    options.adapterPath,
    process.env.SEASCAPE_CONTROL_ADAPTER_PATH,
    process.env.SEASCAPE_OPS_PATH
      ? path.join(process.env.SEASCAPE_OPS_PATH, 'scripts/lib/seascape-control-adapter.js')
      : null,
    '/Users/sawbeck/Projects/seascape-ops/scripts/lib/seascape-control-adapter.js',
    '/Users/sawbeck/.codex/worktrees/seascape-control-adapter/scripts/lib/seascape-control-adapter.js',
  ].filter(Boolean);

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) {
    throw new Error(
      'Could not find seascape-control-adapter.js. Set SEASCAPE_CONTROL_ADAPTER_PATH or SEASCAPE_OPS_PATH.',
    );
  }

  return match;
}

export function loadSeascapeControlAdapter(options = {}) {
  const adapterPath = resolveSeascapeControlAdapterPath(options);
  return require(adapterPath);
}

export async function runSeascapeControlFromVars(vars = {}, options = {}) {
  const input = buildSeascapeControlInput(vars);
  const adapterRunner =
    options.adapterRunner || loadSeascapeControlAdapter(options).runSeascapeControlDraft;

  const raw = await adapterRunner(input, {
    hubPath: options.hubPath || process.env.SEASCAPE_HUB_PATH,
    claudeBin: options.claudeBin || process.env.CLAUDE_BIN,
  });

  return {
    input,
    raw,
    output: raw?.draft || '',
  };
}

export default class SeascapeControlProvider {
  constructor(options = {}) {
    this._id = options.id || 'seascape-control-provider';
    this.options = options;
  }

  id() {
    return this._id;
  }

  async callApi(_prompt, context) {
    try {
      const result = await runSeascapeControlFromVars(context?.vars || {}, this.options);
      if (!result.raw) {
        return { error: 'Seascape control returned no draft' };
      }

      return {
        output: result.output,
        metadata: {
          input: result.input,
          tier: result.raw?.tier,
          category: result.raw?.category,
          notes: result.raw?.notes,
        },
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}
