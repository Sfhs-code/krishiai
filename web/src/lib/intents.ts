import type { LangCode } from './types';

/**
 * Voice intent router. Maps a spoken phrase (in any of the six languages) to
 * an in-app destination or action. Keyword-based on purpose: it must work
 * offline and instantly, without a round-trip to an LLM. Anything it can't
 * classify falls through to `ask` — the AI assistant answers in full.
 */

export type Intent =
  | { kind: 'navigate'; to: string; say: string }
  | { kind: 'action'; action: 'scan-disease' | 'verify-input' | 'sos' | 'listen'; say: string }
  | { kind: 'ask'; question: string };

interface Rule {
  intent: Exclude<Intent, { kind: 'ask' }>;
  words: Partial<Record<LangCode, string[]>> & { en: string[] };
}

const RULES: Rule[] = [
  {
    intent: { kind: 'navigate', to: '/', say: 'Opening home' },
    words: {
      en: ['home', 'dashboard', 'main', 'weather'],
      hi: ['होम', 'घर', 'मुख्य', 'मौसम'],
      mr: ['मुख्यपृष्ठ', 'हवामान'],
      pa: ['ਘਰ', 'ਮੌਸਮ'],
      ta: ['முகப்பு', 'வானிலை'],
      bn: ['হোম', 'আবহাওয়া'],
    },
  },
  {
    intent: { kind: 'navigate', to: '/crops', say: 'Opening your crops' },
    words: {
      en: ['crop', 'crops', 'my field', 'my farm', 'plants'],
      hi: ['फसल', 'खेत', 'फ़सल'],
      mr: ['पीक', 'शेत'],
      pa: ['ਫਸਲ', 'ਖੇਤ'],
      ta: ['பயிர்', 'வயல்'],
      bn: ['ফসল', 'খেত'],
    },
  },
  {
    intent: { kind: 'navigate', to: '/mandi', say: 'Opening mandi prices' },
    words: {
      en: ['mandi', 'market', 'price', 'prices', 'rate', 'sell'],
      hi: ['मंडी', 'भाव', 'दाम', 'कीमत', 'बेचना'],
      mr: ['मंडी', 'भाव', 'बाजार'],
      pa: ['ਮੰਡੀ', 'ਭਾਅ'],
      ta: ['சந்தை', 'விலை'],
      bn: ['মান্ডি', 'দাম', 'বাজার'],
    },
  },
  {
    intent: { kind: 'navigate', to: '/tools', say: 'Opening tools' },
    words: {
      en: ['tool', 'tools', 'scheme', 'schemes', 'soil', 'insight'],
      hi: ['औज़ार', 'योजना', 'मिट्टी', 'साधन'],
      mr: ['साधने', 'योजना', 'माती'],
      pa: ['ਸੰਦ', 'ਯੋਜਨਾ', 'ਮਿੱਟੀ'],
      ta: ['கருவி', 'திட்டம்', 'மண்'],
      bn: ['সরঞ্জাম', 'প্রকল্প', 'মাটি'],
    },
  },
  {
    intent: { kind: 'navigate', to: '/assistant', say: 'Ask me anything' },
    words: {
      en: ['assistant', 'ai bot', 'chat', 'talk', 'help me'],
      hi: ['सहायक', 'बात', 'मदद', 'बॉट'],
      mr: ['सहाय्यक', 'मदत'],
      pa: ['ਸਹਾਇਕ', 'ਮਦਦ'],
      ta: ['உதவியாளர்', 'உதவி'],
      bn: ['সহায়ক', 'সাহায্য'],
    },
  },
  {
    intent: { kind: 'navigate', to: '/profile', say: 'Opening your profile' },
    words: {
      en: ['profile', 'account', 'my details', 'settings', 'language'],
      hi: ['प्रोफ़ाइल', 'खाता', 'सेटिंग', 'भाषा'],
      mr: ['प्रोफाइल', 'खाते', 'भाषा'],
      pa: ['ਪ੍ਰੋਫਾਈਲ', 'ਖਾਤਾ', 'ਭਾਸ਼ਾ'],
      ta: ['சுயவிவரம்', 'மொழி'],
      bn: ['প্রোফাইল', 'ভাষা'],
    },
  },
  {
    intent: { kind: 'action', action: 'scan-disease', say: 'Opening the disease scanner' },
    words: {
      en: ['scan', 'disease', 'leaf', 'sick plant', 'spots on'],
      hi: ['स्कैन', 'बीमारी', 'रोग', 'पत्ती'],
      mr: ['स्कॅन', 'रोग', 'पान'],
      pa: ['ਸਕੈਨ', 'ਰੋਗ', 'ਪੱਤਾ'],
      ta: ['ஸ்கேன்', 'நோய்', 'இலை'],
      bn: ['স্ক্যান', 'রোগ', 'পাতা'],
    },
  },
  {
    intent: { kind: 'action', action: 'verify-input', say: 'Opening counterfeit check' },
    words: {
      en: ['verify', 'fake', 'counterfeit', 'genuine', 'check fertilizer', 'check pesticide', 'barcode'],
      hi: ['जांच', 'नकली', 'असली', 'खाद जांच', 'बारकोड'],
      mr: ['तपासा', 'बनावट', 'खरे'],
      pa: ['ਜਾਂਚ', 'ਨਕਲੀ', 'ਅਸਲੀ'],
      ta: ['சரிபார்', 'போலி', 'அசல்'],
      bn: ['যাচাই', 'নকল', 'আসল'],
    },
  },
  {
    intent: { kind: 'action', action: 'sos', say: 'Opening emergency helplines' },
    words: {
      en: ['sos', 'emergency', 'help urgent', 'ambulance', 'accident'],
      hi: ['आपातकाल', 'मदद तुरंत', 'एम्बुलेंस'],
      mr: ['आणीबाणी', 'रुग्णवाहिका'],
      pa: ['ਐਮਰਜੈਂਸੀ', 'ਐਂਬੂਲੈਂਸ'],
      ta: ['அவசரம்', 'ஆம்புலன்ஸ்'],
      bn: ['জরুরি', 'অ্যাম্বুলেন্স'],
    },
  },
];

function normalise(s: string): string {
  return s.toLowerCase().replace(/[.,!?।]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function routeIntent(transcript: string, lang: LangCode): Intent {
  const text = normalise(transcript);
  if (!text) return { kind: 'ask', question: transcript };

  for (const rule of RULES) {
    const bank = [...(rule.words[lang] ?? []), ...rule.words.en];
    if (bank.some((w) => text.includes(normalise(w)))) {
      return rule.intent;
    }
  }
  // Nothing matched a shortcut → treat as a real question for the assistant.
  return { kind: 'ask', question: transcript };
}
