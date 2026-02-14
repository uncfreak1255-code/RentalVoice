// Lightweight language detection using Unicode ranges and common patterns
// No external dependencies — regex-based heuristic detection

const LANG_PATTERNS: { code: string; test: (t: string) => boolean }[] = [
  // CJK scripts — most distinctive, test first
  { code: 'ja', test: (t) => /[\u3040-\u309F\u30A0-\u30FF]/.test(t) }, // Hiragana/Katakana
  { code: 'ko', test: (t) => /[\uAC00-\uD7AF\u1100-\u11FF]/.test(t) }, // Hangul
  { code: 'zh', test: (t) => /[\u4E00-\u9FFF]/.test(t) && !/[\u3040-\u309F]/.test(t) }, // CJK without Hiragana

  // RTL scripts
  { code: 'ar', test: (t) => /[\u0600-\u06FF]/.test(t) && !/[\u06A9\u06CC\u06AF\u067E]/.test(t) }, // Arabic (without Persian-specific chars)
  { code: 'fa', test: (t) => /[\u06A9\u06CC\u06AF\u067E]/.test(t) }, // Persian-specific characters

  // Cyrillic
  { code: 'ru', test: (t) => /[\u0400-\u04FF]/.test(t) },

  // Latin-based — use common greeting/word patterns
  { code: 'de', test: (t) => /\b(hallo|guten|danke|bitte|können|möchten|ich|ist|sehr|nicht)\b/i.test(t) },
  { code: 'fr', test: (t) => /\b(bonjour|merci|je suis|comment|bienvenue|est-ce|nous|très|avec|pour)\b/i.test(t) },
  { code: 'es', test: (t) => /\b(hola|gracias|buenos|buenas|cómo|nosotros|tenemos|nuestra|quiero|puede)\b/i.test(t) },
  { code: 'it', test: (t) => /\b(ciao|grazie|buongiorno|buonasera|posso|siamo|nostro|vorrei|come|molto)\b/i.test(t) },
  { code: 'pt', test: (t) => /\b(olá|obrigad[oa]|bom dia|como|nosso|pode|muito|temos|está|gostaria)\b/i.test(t) },
];

/**
 * Detect the language of a text string using Unicode ranges and keyword patterns.
 * Returns ISO 639-1 code (en, es, fr, de, etc.) or 'en' as fallback.
 * Designed to be fast — runs in <1ms on typical guest messages.
 */
export function detectLanguage(text: string): string {
  if (!text || text.length < 3) return 'en';

  // Clean the text: remove URLs, emails, numbers-only sequences
  const cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\S+@\S+/g, '')
    .trim();

  if (cleaned.length < 3) return 'en';

  for (const { code, test } of LANG_PATTERNS) {
    if (test(cleaned)) return code;
  }

  return 'en'; // Default fallback
}

/**
 * Get a confidence label for the detection.
 * Based on how many matching signals are found.
 */
export function getDetectionConfidence(text: string): 'high' | 'medium' | 'low' {
  if (!text || text.length < 10) return 'low';

  const detected = detectLanguage(text);

  // Script-based detections (CJK, Arabic, Cyrillic) are very reliable
  if (['ja', 'ko', 'zh', 'ar', 'fa', 'ru'].includes(detected)) return 'high';

  // Latin-based: count matching keywords
  const pattern = LANG_PATTERNS.find((p) => p.code === detected);
  if (!pattern || detected === 'en') return 'low';

  // If we matched a non-English Latin language, medium confidence
  return 'medium';
}

/** Map of language codes to display names */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  it: 'Italian', pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese',
  ko: 'Korean', ar: 'Arabic', fa: 'Persian', ru: 'Russian',
};
