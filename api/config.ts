/**
 * Secrets and tunables.
 *
 * Every key is read from the environment — nothing is ever committed. For
 * local development put them in `functions/.env` (gitignored); for deployment
 * set them with `firebase functions:secrets:set` or in the console.
 */
export const CONFIG = {
  geminiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  openWeatherKey: process.env.OPENWEATHER_API_KEY ?? '',
  /** Optional — data.gov.in Agmarknet resource key for real mandi prices. */
  dataGovKey: process.env.DATA_GOV_API_KEY ?? '',
  dataGovResource: process.env.DATA_GOV_RESOURCE ?? '9ef84268-d588-465a-a308-a864a43d0070',
};

export const hasGemini = () => CONFIG.geminiKey.length > 0;
export const hasWeather = () => CONFIG.openWeatherKey.length > 0;
export const hasMandi = () => CONFIG.dataGovKey.length > 0;

/** Language name used inside prompts so Gemini answers in the farmer's tongue. */
export const LANG_NAME: Record<string, string> = {
  en: 'simple Indian English',
  hi: 'Hindi (Devanagari script)',
  mr: 'Marathi (Devanagari script)',
  pa: 'Punjabi (Gurmukhi script)',
  ta: 'Tamil',
  bn: 'Bengali',
};

export const langName = (code: string): string => LANG_NAME[code] ?? LANG_NAME.en;
