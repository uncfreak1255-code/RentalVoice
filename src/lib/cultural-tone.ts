// Cultural Tone Adaptation Service
// Provides language-specific communication norms and cultural adjustments for AI-generated responses

export interface CulturalToneProfile {
  languageCode: string;
  languageName: string;
  // Tone characteristics
  formalityDefault: number; // 0-100 scale (0=casual, 100=very formal)
  warmthDefault: number; // 0-100 scale (0=distant, 100=warm)
  directnessDefault: number; // 0-100 scale (0=indirect, 100=very direct)
  // Communication norms
  usesHonorifics: boolean;
  commonGreetings: string[];
  commonSignoffs: string[];
  // Cultural considerations
  culturalNotes: string[];
  avoidPhrases: string[]; // Phrases that might be inappropriate
  preferredPhrases: string[]; // Culturally appropriate expressions
  // Emoji/expression usage
  emojiUsage: 'low' | 'moderate' | 'high';
  exclamationUsage: 'low' | 'moderate' | 'high';
  // Response length preference
  preferredLength: 'concise' | 'moderate' | 'detailed';
}

export interface LearnedLanguageStyle {
  languageCode: string;
  samplesAnalyzed: number;
  // Learned adjustments (overrides defaults)
  learnedFormality?: number;
  learnedWarmth?: number;
  learnedGreetings: string[];
  learnedSignoffs: string[];
  commonPhrases: string[];
  lastUpdated: Date;
}

// Comprehensive cultural profiles for each supported language
export const CULTURAL_PROFILES: Record<string, CulturalToneProfile> = {
  en: {
    languageCode: 'en',
    languageName: 'English',
    formalityDefault: 40,
    warmthDefault: 60,
    directnessDefault: 75,
    usesHonorifics: false,
    commonGreetings: ['Hi', 'Hello', 'Hey there', 'Good morning', 'Good afternoon'],
    commonSignoffs: ['Best', 'Thanks', 'Cheers', 'Best regards', 'Take care'],
    culturalNotes: [
      'Direct and straightforward communication is valued',
      'Friendly but professional tone works well',
      'Time-sensitive responses appreciated',
    ],
    avoidPhrases: [],
    preferredPhrases: ['Happy to help', 'Let me know', 'No problem', 'Absolutely'],
    emojiUsage: 'moderate',
    exclamationUsage: 'moderate',
    preferredLength: 'concise',
  },
  es: {
    languageCode: 'es',
    languageName: 'Spanish',
    formalityDefault: 45,
    warmthDefault: 80,
    directnessDefault: 55,
    usesHonorifics: true,
    commonGreetings: ['¡Hola!', '¡Buenos días!', '¡Buenas tardes!', '¡Buenas noches!', '¡Bienvenido/a!'],
    commonSignoffs: ['Saludos cordiales', 'Un abrazo', 'Que tengas un buen día', 'Con mucho gusto', 'Atentamente'],
    culturalNotes: [
      'Warm and personal communication is valued',
      'Building rapport is important before business matters',
      'Use exclamation marks for enthusiasm',
      'Address guests warmly, like welcoming family',
    ],
    avoidPhrases: ['No hay problema (can sound dismissive)'],
    preferredPhrases: ['Con mucho gusto', 'Estamos para servirle', 'Es un placer', 'No dude en contactarnos'],
    emojiUsage: 'high',
    exclamationUsage: 'high',
    preferredLength: 'moderate',
  },
  fr: {
    languageCode: 'fr',
    languageName: 'French',
    formalityDefault: 65,
    warmthDefault: 55,
    directnessDefault: 45,
    usesHonorifics: true,
    commonGreetings: ['Bonjour', 'Bonsoir', 'Cher(e) invité(e)', 'Bienvenue'],
    commonSignoffs: ['Cordialement', 'Bien à vous', 'Avec mes meilleures salutations', 'À bientôt'],
    culturalNotes: [
      'Formal address (vous) is expected in hospitality',
      'Politeness formulas are essential',
      'Acknowledge the guest before getting to business',
      'Elegance in language is appreciated',
    ],
    avoidPhrases: ['Tu (informal you) with guests', 'Overly casual expressions'],
    preferredPhrases: ['Je vous en prie', 'N\'hésitez pas', 'Avec plaisir', 'Je reste à votre disposition'],
    emojiUsage: 'low',
    exclamationUsage: 'low',
    preferredLength: 'moderate',
  },
  de: {
    languageCode: 'de',
    languageName: 'German',
    formalityDefault: 75,
    warmthDefault: 45,
    directnessDefault: 85,
    usesHonorifics: true,
    commonGreetings: ['Guten Tag', 'Sehr geehrte/r', 'Hallo', 'Grüß Gott (Austrian/Bavarian)'],
    commonSignoffs: ['Mit freundlichen Grüßen', 'Beste Grüße', 'Herzliche Grüße', 'Vielen Dank'],
    culturalNotes: [
      'Formal address (Sie) is mandatory in hospitality',
      'Precision and clarity are highly valued',
      'Be thorough with information',
      'Punctuality references are well-received',
      'Direct communication without excessive pleasantries',
    ],
    avoidPhrases: ['Du (informal) unless guest initiates', 'Vague timeframes'],
    preferredPhrases: ['Gerne', 'Selbstverständlich', 'Bei Fragen stehe ich Ihnen gerne zur Verfügung'],
    emojiUsage: 'low',
    exclamationUsage: 'low',
    preferredLength: 'detailed',
  },
  it: {
    languageCode: 'it',
    languageName: 'Italian',
    formalityDefault: 50,
    warmthDefault: 85,
    directnessDefault: 50,
    usesHonorifics: true,
    commonGreetings: ['Buongiorno', 'Buonasera', 'Caro/a ospite', 'Benvenuto/a'],
    commonSignoffs: ['Cordiali saluti', 'A presto', 'Un caro saluto', 'Con i migliori auguri'],
    culturalNotes: [
      'Warmth and hospitality are central to Italian culture',
      'Personal connection matters greatly',
      'Food and local recommendations are especially appreciated',
      'Expressiveness is welcomed',
    ],
    avoidPhrases: ['Cold or robotic responses'],
    preferredPhrases: ['Con piacere', 'Sarà un piacere', 'Non esiti a contattarci', 'Siamo a vostra disposizione'],
    emojiUsage: 'high',
    exclamationUsage: 'high',
    preferredLength: 'moderate',
  },
  pt: {
    languageCode: 'pt',
    languageName: 'Portuguese',
    formalityDefault: 45,
    warmthDefault: 80,
    directnessDefault: 55,
    usesHonorifics: true,
    commonGreetings: ['Olá', 'Bom dia', 'Boa tarde', 'Boa noite', 'Seja bem-vindo/a'],
    commonSignoffs: ['Atenciosamente', 'Abraços', 'Com os melhores cumprimentos', 'Até breve'],
    culturalNotes: [
      'Warm and friendly communication style',
      'Personal touch is valued',
      'Brazilian Portuguese tends to be warmer than European Portuguese',
      'Building relationship is important',
    ],
    avoidPhrases: [],
    preferredPhrases: ['Com prazer', 'Estamos à disposição', 'Fico feliz em ajudar', 'Não hesite em perguntar'],
    emojiUsage: 'high',
    exclamationUsage: 'moderate',
    preferredLength: 'moderate',
  },
  zh: {
    languageCode: 'zh',
    languageName: 'Chinese',
    formalityDefault: 70,
    warmthDefault: 60,
    directnessDefault: 40,
    usesHonorifics: true,
    commonGreetings: ['您好', '尊敬的客人', '欢迎', '早上好/下午好/晚上好'],
    commonSignoffs: ['祝您入住愉快', '如有需要请随时联系我们', '此致敬礼', '谢谢'],
    culturalNotes: [
      'Respect and courtesy are paramount',
      'Indirect communication often preferred',
      'Face-saving is important - avoid direct criticism',
      'Use honorific forms (您 vs 你)',
      'Acknowledge their time and patience',
    ],
    avoidPhrases: ['Direct refusals', 'Blunt negative statements'],
    preferredPhrases: ['很高兴为您服务', '如有任何问题请随时联系', '非常感谢您的理解', '我们会尽力满足您的需求'],
    emojiUsage: 'moderate',
    exclamationUsage: 'low',
    preferredLength: 'moderate',
  },
  ja: {
    languageCode: 'ja',
    languageName: 'Japanese',
    formalityDefault: 90,
    warmthDefault: 65,
    directnessDefault: 25,
    usesHonorifics: true,
    commonGreetings: ['いらっしゃいませ', 'こんにちは', 'お世話になっております', 'ようこそ'],
    commonSignoffs: ['よろしくお願いいたします', 'ご不明な点がございましたらお気軽にお問い合わせください', '何卒よろしくお願い申し上げます'],
    culturalNotes: [
      'Extremely high formality expected in hospitality (keigo)',
      'Indirect communication is the norm',
      'Apologize proactively even for minor inconveniences',
      'Express gratitude frequently',
      'Avoid direct "no" - use softer alternatives',
      'Attention to detail is greatly appreciated',
    ],
    avoidPhrases: ['Direct refusals', 'Casual language', 'あなた (direct "you")'],
    preferredPhrases: [
      'かしこまりました (understood/will do)',
      '恐れ入りますが (I\'m sorry to trouble you but...)',
      '何かございましたらお申し付けください',
      'ご滞在をお楽しみください',
    ],
    emojiUsage: 'moderate',
    exclamationUsage: 'low',
    preferredLength: 'detailed',
  },
  ko: {
    languageCode: 'ko',
    languageName: 'Korean',
    formalityDefault: 80,
    warmthDefault: 65,
    directnessDefault: 35,
    usesHonorifics: true,
    commonGreetings: ['안녕하세요', '환영합니다', '반갑습니다'],
    commonSignoffs: ['감사합니다', '좋은 하루 되세요', '편안한 숙박 되세요', '문의 사항이 있으시면 연락 주세요'],
    culturalNotes: [
      'Honorific language (존댓말) is mandatory in hospitality',
      'Respect for the guest is paramount',
      'Apologize readily for any inconvenience',
      'Indirect communication is valued',
      'Speed and efficiency in responses appreciated',
    ],
    avoidPhrases: ['Informal speech (반말)', 'Direct refusals'],
    preferredPhrases: ['기꺼이 도와드리겠습니다', '편하게 말씀해 주세요', '최선을 다해 도와드리겠습니다'],
    emojiUsage: 'moderate',
    exclamationUsage: 'moderate',
    preferredLength: 'moderate',
  },
  ar: {
    languageCode: 'ar',
    languageName: 'Arabic',
    formalityDefault: 65,
    warmthDefault: 80,
    directnessDefault: 45,
    usesHonorifics: true,
    commonGreetings: ['مرحباً', 'السلام عليكم', 'أهلاً وسهلاً', 'صباح الخير / مساء الخير'],
    commonSignoffs: ['مع أطيب التحيات', 'شكراً جزيلاً', 'نتمنى لكم إقامة سعيدة', 'في خدمتكم دائماً'],
    culturalNotes: [
      'Hospitality is deeply valued in Arab culture',
      'Warm and generous communication expected',
      'Religious phrases may be used naturally',
      'Building personal rapport is important',
      'Patience and understanding are key virtues',
    ],
    avoidPhrases: [],
    preferredPhrases: ['بكل سرور', 'نحن سعداء بخدمتكم', 'لا تتردد في التواصل معنا', 'إن شاء الله'],
    emojiUsage: 'moderate',
    exclamationUsage: 'moderate',
    preferredLength: 'moderate',
  },
  ru: {
    languageCode: 'ru',
    languageName: 'Russian',
    formalityDefault: 60,
    warmthDefault: 50,
    directnessDefault: 70,
    usesHonorifics: true,
    commonGreetings: ['Здравствуйте', 'Добрый день', 'Добро пожаловать', 'Приветствуем вас'],
    commonSignoffs: ['С уважением', 'Всего доброго', 'Хорошего отдыха', 'Будем рады помочь'],
    culturalNotes: [
      'Formal address (Вы) expected in business/hospitality',
      'Direct communication is valued but be polite',
      'Thoroughness in information is appreciated',
      'Russians appreciate honesty and sincerity',
    ],
    avoidPhrases: ['Overly casual language with strangers'],
    preferredPhrases: ['С удовольствием', 'Будем рады помочь', 'Не стесняйтесь обращаться', 'Приятного пребывания'],
    emojiUsage: 'moderate',
    exclamationUsage: 'low',
    preferredLength: 'moderate',
  },
};

/**
 * Get the cultural profile for a language
 */
export function getCulturalProfile(languageCode: string): CulturalToneProfile {
  return CULTURAL_PROFILES[languageCode] || CULTURAL_PROFILES['en'];
}

/**
 * Generate cultural tone instructions for AI prompt
 */
export function generateCulturalToneInstructions(
  languageCode: string,
  learnedStyle?: LearnedLanguageStyle
): string {
  const profile = getCulturalProfile(languageCode);

  // Use learned values if available, otherwise defaults
  const formality = learnedStyle?.learnedFormality ?? profile.formalityDefault;
  const warmth = learnedStyle?.learnedWarmth ?? profile.warmthDefault;
  const greetings = learnedStyle?.learnedGreetings?.length
    ? learnedStyle.learnedGreetings
    : profile.commonGreetings;
  const signoffs = learnedStyle?.learnedSignoffs?.length
    ? learnedStyle.learnedSignoffs
    : profile.commonSignoffs;

  let instructions = `\n## CULTURAL TONE ADAPTATION (${profile.languageName})

**Communication Style Guidelines:**
- Formality Level: ${formality >= 70 ? 'FORMAL' : formality >= 40 ? 'SEMI-FORMAL' : 'CASUAL'} (${formality}/100)
- Warmth Level: ${warmth >= 70 ? 'WARM' : warmth >= 40 ? 'FRIENDLY' : 'RESERVED'} (${warmth}/100)
- Directness: ${profile.directnessDefault >= 70 ? 'DIRECT' : profile.directnessDefault >= 40 ? 'BALANCED' : 'INDIRECT'} (${profile.directnessDefault}/100)

**Cultural Considerations:**
${profile.culturalNotes.map((note) => `- ${note}`).join('\n')}

**Appropriate Greetings:** ${greetings.slice(0, 3).join(', ')}
**Appropriate Sign-offs:** ${signoffs.slice(0, 3).join(', ')}
`;

  if (profile.usesHonorifics) {
    instructions += `\n**IMPORTANT:** Use honorific/formal address forms appropriate for ${profile.languageName}.`;
  }

  if (profile.preferredPhrases.length > 0) {
    instructions += `\n**Recommended Phrases:** ${profile.preferredPhrases.slice(0, 4).join(', ')}`;
  }

  if (profile.avoidPhrases.length > 0) {
    instructions += `\n**Avoid:** ${profile.avoidPhrases.join(', ')}`;
  }

  // Expression guidelines
  instructions += `\n\n**Expression Guidelines:**
- Emoji usage: ${profile.emojiUsage.toUpperCase()} (${profile.emojiUsage === 'high' ? 'welcomed' : profile.emojiUsage === 'moderate' ? 'occasional use OK' : 'use sparingly'})
- Exclamation marks: ${profile.exclamationUsage.toUpperCase()} (${profile.exclamationUsage === 'high' ? 'encouraged for enthusiasm' : profile.exclamationUsage === 'moderate' ? 'occasional use' : 'minimal'})
- Response length preference: ${profile.preferredLength.toUpperCase()}`;

  // Add learned patterns if available
  if (learnedStyle && learnedStyle.samplesAnalyzed >= 3) {
    instructions += `\n\n**Learned Host Style for ${profile.languageName}:**
Based on ${learnedStyle.samplesAnalyzed} analyzed messages in this language:`;

    if (learnedStyle.commonPhrases.length > 0) {
      instructions += `\n- Frequently used phrases: ${learnedStyle.commonPhrases.slice(0, 5).join(', ')}`;
    }
  }

  return instructions;
}

/**
 * Get a summary of cultural adaptations for the reasoning display
 */
export function getCulturalAdaptationSummary(languageCode: string): {
  language: string;
  adaptations: string[];
  formalityLevel: string;
  warmthLevel: string;
} {
  const profile = getCulturalProfile(languageCode);

  const formalityLevel =
    profile.formalityDefault >= 70
      ? 'Formal'
      : profile.formalityDefault >= 40
        ? 'Semi-formal'
        : 'Casual';
  const warmthLevel =
    profile.warmthDefault >= 70 ? 'Warm' : profile.warmthDefault >= 40 ? 'Friendly' : 'Reserved';

  const adaptations: string[] = [];

  if (profile.usesHonorifics) {
    adaptations.push('Using honorific language forms');
  }

  if (profile.directnessDefault < 40) {
    adaptations.push('Indirect communication style');
  } else if (profile.directnessDefault > 70) {
    adaptations.push('Direct communication style');
  }

  if (profile.emojiUsage === 'high') {
    adaptations.push('Expressive with emojis');
  } else if (profile.emojiUsage === 'low') {
    adaptations.push('Minimal emoji usage');
  }

  if (profile.preferredLength === 'detailed') {
    adaptations.push('Thorough, detailed responses');
  } else if (profile.preferredLength === 'concise') {
    adaptations.push('Concise responses');
  }

  // Add key cultural notes
  if (profile.culturalNotes.length > 0) {
    adaptations.push(profile.culturalNotes[0]);
  }

  return {
    language: profile.languageName,
    adaptations,
    formalityLevel,
    warmthLevel,
  };
}

/**
 * Analyze a message to learn language-specific style patterns
 */
export function analyzeMessageForLanguageStyle(
  content: string,
  languageCode: string
): Partial<LearnedLanguageStyle> {
  const greetingPatterns: Record<string, RegExp[]> = {
    en: [/^(hi|hello|hey|good (morning|afternoon|evening))/i],
    es: [/^(hola|buenos? (días?|tardes?|noches?))/i],
    fr: [/^(bonjour|bonsoir|salut)/i],
    de: [/^(guten (tag|morgen|abend)|hallo|grüß gott)/i],
    it: [/^(buongiorno|buonasera|ciao|salve)/i],
    pt: [/^(olá|oi|bom dia|boa (tarde|noite))/i],
    ja: [/^(こんにちは|おはよう|こんばんは|いらっしゃいませ)/],
    ko: [/^(안녕하세요|반갑습니다)/],
    zh: [/^(您好|你好|早上好|下午好)/],
    ar: [/^(مرحبا|السلام عليكم|أهلا)/],
    ru: [/^(здравствуйте|добрый день|привет)/i],
  };

  const signoffPatterns: Record<string, RegExp[]> = {
    en: [/(best|thanks|cheers|regards|take care)[\s,.!]*$/i],
    es: [/(saludos|gracias|un abrazo|atentamente)[\s,.!]*$/i],
    fr: [/(cordialement|bien à vous|merci)[\s,.!]*$/i],
    de: [/(mit freundlichen grüßen|beste grüße|danke)[\s,.!]*$/i],
    it: [/(cordiali saluti|grazie|a presto)[\s,.!]*$/i],
    pt: [/(atenciosamente|obrigado|abraços)[\s,.!]*$/i],
    ja: [/(よろしくお願いします|ありがとうございます)[\s,.!]*$/],
    ko: [/(감사합니다|좋은 하루 되세요)[\s,.!]*$/],
    zh: [/(谢谢|祝您)[\s,.!]*$/],
    ar: [/(شكرا|مع تحياتي)[\s,.!]*$/],
    ru: [/(с уважением|спасибо|всего доброго)[\s,.!]*$/i],
  };

  const learnedGreetings: string[] = [];
  const learnedSignoffs: string[] = [];

  // Extract greetings
  const greetingRegexes = greetingPatterns[languageCode] || greetingPatterns['en'];
  for (const regex of greetingRegexes) {
    const match = content.match(regex);
    if (match) {
      learnedGreetings.push(match[0]);
    }
  }

  // Extract signoffs
  const signoffRegexes = signoffPatterns[languageCode] || signoffPatterns['en'];
  for (const regex of signoffRegexes) {
    const match = content.match(regex);
    if (match) {
      learnedSignoffs.push(match[0].trim());
    }
  }

  // Analyze formality based on language-specific indicators
  let formalityScore = 50;
  const profile = getCulturalProfile(languageCode);

  // Check for formal vs informal address (varies by language)
  if (languageCode === 'de') {
    if (/\bSie\b/.test(content)) formalityScore += 20;
    if (/\bdu\b/i.test(content)) formalityScore -= 15;
  } else if (languageCode === 'fr') {
    if (/\bvous\b/i.test(content)) formalityScore += 20;
    if (/\btu\b/i.test(content)) formalityScore -= 15;
  } else if (languageCode === 'es' || languageCode === 'pt') {
    if (/\busted(es)?\b/i.test(content)) formalityScore += 15;
  } else if (languageCode === 'ja') {
    // Check for keigo patterns
    if (/ます|ございます|いたします/.test(content)) formalityScore += 25;
  } else if (languageCode === 'ko') {
    // Check for formal endings
    if (/습니다|세요/.test(content)) formalityScore += 20;
  } else if (languageCode === 'zh') {
    if (/您/.test(content)) formalityScore += 15;
  } else if (languageCode === 'ru') {
    if (/\bВы\b/.test(content)) formalityScore += 15;
  }

  return {
    languageCode,
    learnedGreetings,
    learnedSignoffs,
    learnedFormality: Math.min(100, Math.max(0, formalityScore)),
    commonPhrases: [],
    lastUpdated: new Date(),
  };
}

/**
 * Get language display name with cultural context
 */
export function getLanguageDisplayInfo(languageCode: string): {
  name: string;
  nativeName: string;
  culturalNote: string;
  flag: string;
} {
  const displayInfo: Record<
    string,
    { name: string; nativeName: string; culturalNote: string; flag: string }
  > = {
    en: {
      name: 'English',
      nativeName: 'English',
      culturalNote: 'Direct and friendly',
      flag: '🇺🇸',
    },
    es: {
      name: 'Spanish',
      nativeName: 'Español',
      culturalNote: 'Warm and expressive',
      flag: '🇪🇸',
    },
    fr: {
      name: 'French',
      nativeName: 'Français',
      culturalNote: 'Formal and elegant',
      flag: '🇫🇷',
    },
    de: {
      name: 'German',
      nativeName: 'Deutsch',
      culturalNote: 'Precise and formal',
      flag: '🇩🇪',
    },
    it: {
      name: 'Italian',
      nativeName: 'Italiano',
      culturalNote: 'Warm and hospitable',
      flag: '🇮🇹',
    },
    pt: {
      name: 'Portuguese',
      nativeName: 'Português',
      culturalNote: 'Warm and personal',
      flag: '🇵🇹',
    },
    zh: {
      name: 'Chinese',
      nativeName: '中文',
      culturalNote: 'Respectful and courteous',
      flag: '🇨🇳',
    },
    ja: {
      name: 'Japanese',
      nativeName: '日本語',
      culturalNote: 'Highly formal (keigo)',
      flag: '🇯🇵',
    },
    ko: {
      name: 'Korean',
      nativeName: '한국어',
      culturalNote: 'Formal and respectful',
      flag: '🇰🇷',
    },
    ar: {
      name: 'Arabic',
      nativeName: 'العربية',
      culturalNote: 'Warm hospitality',
      flag: '🇸🇦',
    },
    ru: {
      name: 'Russian',
      nativeName: 'Русский',
      culturalNote: 'Direct and sincere',
      flag: '🇷🇺',
    },
  };

  return (
    displayInfo[languageCode] || {
      name: 'Unknown',
      nativeName: 'Unknown',
      culturalNote: 'Standard communication',
      flag: '🌐',
    }
  );
}
