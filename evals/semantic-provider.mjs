/**
 * Custom promptfoo provider that enriches prompts with semantic voice examples
 * before sending to Gemini.
 *
 * How it works:
 *   1. Extracts guest message from the test case vars
 *   2. Embeds it via Gemini embedding API
 *   3. Queries Supabase pgvector for similar voice examples
 *   4. Injects matched examples into the prompt as {{historicalExamples}}
 *   5. Sends enriched prompt to Gemini for generation
 *
 * Usage in promptfooconfig.yaml:
 *   providers:
 *     - id: file://semantic-provider.mjs
 */

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zsitbuwzxtsgfqzhtged.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FOUNDER_ORG_ID = '600c7934-8e01-425f-a60c-14c5e7b5c36c';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const GENERATION_MODEL = 'gemini-2.0-flash';
const EMBEDDING_DIMENSIONS = 768;
const MATCH_COUNT = 5;

async function embedText(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GOOGLE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.embedding.values;
}

async function querySemanticExamples(guestMessage) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return null; // No service key — skip semantic enrichment
  }

  try {
    const embedding = await embedText(guestMessage);

    // Call the match_voice_examples RPC
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_voice_examples`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        query_embedding: `[${embedding.join(',')}]`,
        query_org_id: FOUNDER_ORG_ID,
        match_count: MATCH_COUNT,
      }),
    });

    if (!res.ok) {
      console.error(`[SemanticProvider] Supabase RPC error: ${res.status}`);
      return null;
    }

    const examples = await res.json();
    if (!examples || examples.length === 0) return null;

    // Format as prompt text
    const lines = examples.map((ex, i) =>
      `Example ${i + 1} (similarity: ${(ex.similarity * 100).toFixed(0)}%):\n  Guest: "${ex.guest_message}"\n  Host: "${ex.host_response}"`
    );

    return `\nHISTORICAL VOICE EXAMPLES (real past responses by this host to similar messages — match this style):\n${lines.join('\n\n')}`;
  } catch (err) {
    console.error(`[SemanticProvider] Semantic query failed:`, err.message);
    return null;
  }
}

async function generateWithGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GENERATION_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini generation failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts?.[0]?.text) {
    throw new Error('No content in Gemini response');
  }
  return candidate.content.parts[0].text;
}

// Extract guest message from conversationContext variable
function extractGuestMessage(vars) {
  const ctx = vars?.conversationContext || '';
  // Match patterns like [Guest - Name]: message
  const match = ctx.match(/\[Guest[^\]]*\]:\s*(.+)/s);
  if (match) return match[1].trim();
  // Fallback: last line that looks like a guest message
  const lines = ctx.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('Guest')) {
      const msgMatch = lines[i].match(/:\s*(.+)/s);
      if (msgMatch) return msgMatch[1].trim();
    }
  }
  return ctx.trim().split('\n').pop()?.trim() || '';
}

export default class SemanticProvider {
  constructor(options) {
    this._id = options?.id || 'semantic-gemini';
    this.config = options?.config || {};
  }

  id() {
    return this._id;
  }

  async callApi(prompt, context) {
    const vars = context?.vars || {};

    // Extract guest message and get semantic examples
    const guestMessage = extractGuestMessage(vars);
    let enrichedPrompt = prompt;

    if (guestMessage) {
      const semanticBlock = await querySemanticExamples(guestMessage);
      if (semanticBlock) {
        // Replace empty {{historicalExamples}} placeholder or append before the --- separator
        if (enrichedPrompt.includes('{{historicalExamples}}')) {
          enrichedPrompt = enrichedPrompt.replace('{{historicalExamples}}', semanticBlock);
        } else if (enrichedPrompt.includes('---')) {
          enrichedPrompt = enrichedPrompt.replace('---', `${semanticBlock}\n\n---`);
        } else {
          enrichedPrompt += semanticBlock;
        }
      }
    }

    try {
      const output = await generateWithGemini(enrichedPrompt);
      return { output };
    } catch (err) {
      return { error: err.message };
    }
  }
}
