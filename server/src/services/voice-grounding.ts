import { getSupabaseAdmin } from '../db/supabase.js';
import { embedText } from './embedding.js';
import type { AIGenerateRequest } from '../lib/types.js';

interface StyleProfileRow {
  profile_json: Record<string, unknown> | null;
}

interface EditPatternRow {
  original: string;
  edited: string;
  category: string | null;
}

interface SemanticVoiceExample {
  guest_message: string;
  host_response: string;
  origin_type: string;
  property_id: string | null;
  similarity: number;
}

export interface ManagedVoiceGrounding {
  propertyId: string | null;
  styleProfile: Record<string, unknown> | null;
  semanticExamples: SemanticVoiceExample[];
  recentEditPatterns: EditPatternRow[];
}

async function getScopedStyleProfile(
  orgId: string,
  propertyId: string | null
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseAdmin();

  if (propertyId) {
    const { data } = await supabase
      .from('host_style_profiles')
      .select('profile_json')
      .eq('org_id', orgId)
      .eq('property_id', propertyId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if ((data as StyleProfileRow | null)?.profile_json) {
      return (data as StyleProfileRow).profile_json;
    }
  }

  const { data } = await supabase
    .from('host_style_profiles')
    .select('profile_json')
    .eq('org_id', orgId)
    .is('property_id', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data as StyleProfileRow | null)?.profile_json as Record<string, unknown> | null) || null;
}

async function getSemanticVoiceExamples(
  orgId: string,
  propertyId: string | null,
  guestMessage: string
): Promise<SemanticVoiceExample[]> {
  const supabase = getSupabaseAdmin();
  const embedding = await embedText(guestMessage);
  const { data } = await supabase.rpc('match_voice_examples', {
    query_embedding: `[${embedding.join(',')}]`,
    query_org_id: orgId,
    query_property_id: propertyId,
    match_count: 5,
  });

  return ((data as SemanticVoiceExample[] | null) || []).filter(
    (example) => example.guest_message && example.host_response
  );
}

async function getRecentEditPatterns(
  orgId: string,
  propertyId: string | null
): Promise<EditPatternRow[]> {
  const supabase = getSupabaseAdmin();

  if (propertyId) {
    const { data } = await supabase
      .from('edit_patterns')
      .select('original, edited, category')
      .eq('org_id', orgId)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(5);

    if ((data || []).length > 0) {
      return (data as EditPatternRow[]) || [];
    }
  }

  const { data } = await supabase
    .from('edit_patterns')
    .select('original, edited, category')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5);

  return (data as EditPatternRow[]) || [];
}

export async function getManagedVoiceGrounding(input: {
  orgId: string;
  propertyId?: string | null;
  guestMessage: string;
}): Promise<ManagedVoiceGrounding> {
  const propertyId = input.propertyId ? String(input.propertyId) : null;

  const [styleProfile, semanticExamples, recentEditPatterns] = await Promise.all([
    getScopedStyleProfile(input.orgId, propertyId).catch(() => null),
    getSemanticVoiceExamples(input.orgId, propertyId, input.guestMessage).catch(() => []),
    getRecentEditPatterns(input.orgId, propertyId).catch(() => []),
  ]);

  return {
    propertyId,
    styleProfile,
    semanticExamples,
    recentEditPatterns,
  };
}

function buildLanguageInstruction(request: Pick<AIGenerateRequest, 'responseLanguageMode' | 'hostDefaultLanguage'>): string {
  if (request.responseLanguageMode === 'host_default') {
    return `Always respond in ${request.hostDefaultLanguage || 'English'}.`;
  }

  if (request.responseLanguageMode === 'match_guest') {
    return 'Match the language the guest wrote in.';
  }

  return 'Respond in the same language as the guest message.';
}

function buildStyleSection(styleProfile: Record<string, unknown> | null): string {
  if (!styleProfile || styleProfile.trained !== true) {
    return 'No trained style profile yet. Stay close to the host examples below.';
  }

  const lines: string[] = [];
  if (styleProfile.tonePreference) {
    lines.push(`Tone preference: ${String(styleProfile.tonePreference)}.`);
  }
  if (styleProfile.usesEmoji === true) {
    lines.push('The host uses emojis sometimes when it feels natural.');
  }
  if (styleProfile.usesExclamation === true) {
    lines.push('The host uses exclamation points for warmth and emphasis.');
  }
  if (Array.isArray(styleProfile.topPhrases) && styleProfile.topPhrases.length > 0) {
    lines.push(
      `Common host phrases: ${(styleProfile.topPhrases as string[]).slice(0, 5).map((phrase) => `"${phrase}"`).join(', ')}.`
    );
  }

  return lines.length > 0 ? lines.join('\n') : 'A style profile exists but has no strong signals yet.';
}

function buildExamplesSection(examples: SemanticVoiceExample[]): string {
  if (examples.length === 0) {
    return 'No semantic host examples found yet. Default to the style profile and recent edits.';
  }

  return examples
    .map(
      (example, index) =>
        `Example ${index + 1} (${example.origin_type}${example.property_id ? `, property ${example.property_id}` : ''})\nGuest: ${example.guest_message}\nHost: ${example.host_response}`
    )
    .join('\n\n');
}

function buildEditPatternsSection(patterns: EditPatternRow[]): string {
  if (patterns.length === 0) {
    return 'No recent host edit patterns recorded yet.';
  }

  return patterns
    .map((pattern) => {
      const category = pattern.category ? ` [${pattern.category}]` : '';
      return `- Prefer "${pattern.edited}" over "${pattern.original}"${category}`;
    })
    .join('\n');
}

export async function buildManagedVoicePrompt(input: {
  orgId: string;
  propertyId?: string | null;
  guestMessage: string;
  guestName?: string;
  responseLanguageMode?: AIGenerateRequest['responseLanguageMode'];
  hostDefaultLanguage?: AIGenerateRequest['hostDefaultLanguage'];
  /** Pre-fetched grounding to avoid a duplicate Supabase round-trip. */
  grounding?: ManagedVoiceGrounding;
}): Promise<string> {
  const grounding = input.grounding ?? await getManagedVoiceGrounding(input);
  const guestNameLine = input.guestName ? `The guest's name is ${input.guestName}.` : '';
  const propertyLine = grounding.propertyId
    ? `This reply is for property ${grounding.propertyId}.`
    : 'No property is specified, so use the host’s general voice.';

  return [
    'You are writing the next guest reply exactly how the host would write it.',
    'Do not write like a generic AI assistant. Do not mention being AI.',
    buildLanguageInstruction(input),
    guestNameLine,
    propertyLine,
    '',
    'HOST STYLE PROFILE:',
    buildStyleSection(grounding.styleProfile),
    '',
    'REAL HOST REPLY EXAMPLES:',
    buildExamplesSection(grounding.semanticExamples),
    '',
    'RECENT HOST EDIT SIGNALS:',
    buildEditPatternsSection(grounding.recentEditPatterns),
    '',
    'Write one send-ready reply only. Keep it warm, specific, and host-centric.',
  ]
    .filter(Boolean)
    .join('\n');
}
