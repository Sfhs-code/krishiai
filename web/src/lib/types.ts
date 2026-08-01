/** GREEN / YELLOW / RED — the single visual language used across the app. */
export type Signal = 'green' | 'yellow' | 'red';

export type LangCode = 'en' | 'hi' | 'mr' | 'pa' | 'ta' | 'bn';

export interface WeatherNow {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKph: number;
  rainChance: number;
  condition: string;
  icon: string;
  place: string;
  sunrise?: number;
  sunset?: number;
}

export interface ForecastDay {
  day: string;
  date: string;
  maxC: number;
  minC: number;
  rainChance: number;
  condition: string;
  icon: string;
}

export interface WeatherBundle {
  now: WeatherNow;
  forecast: ForecastDay[];
  /** Derived irrigation call — the headline card on Home. */
  irrigation: {
    signal: Signal;
    /**
     * Machine-readable verdict from the backend. The client renders its own
     * localised copy from this, so the message that gets spoken aloud is in
     * the farmer's language. `headline`/`detail` are the English fallback.
     */
    kind?: 'skip' | 'wait' | 'urgent' | 'normal';
    rainChance?: number;
    tempC?: number;
    humidity?: number;
    headline: string;
    detail: string;
    litresSaved: number;
  };
}

export interface Crop {
  id: string;
  name: string;
  emoji: string;
  areaAcre: number;
  stage: string;
  signal: Signal;
  status: string;
  nextAction: string;
  nextActionIn: string;
  sownOn: string;
  expectedYieldQtl: number;
  yieldTrend: number;
}

export interface MandiPrice {
  id: string;
  commodity: string;
  emoji: string;
  market: string;
  district: string;
  state: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  changePct: number;
  unit: string;
  arrivalTonnes?: number;
  /** Congestion at the yard: green = normal, yellow = waiting, red = divert. */
  congestion: Signal;
  waitMinutes: number;
  distanceKm: number;
  updatedAt: string;
}

export interface Scheme {
  id: string;
  name: string;
  nameHi: string;
  benefit: string;
  category: string;
  eligible: boolean;
  reason: string;
  deadline?: string;
  applyUrl: string;
  documents: string[];
}

export interface DiagnosisResult {
  crop: string;
  disease: string;
  diseaseLocal?: string;
  confidence: number;
  signal: Signal;
  severity: string;
  summary: string;
  organicTreatment: string[];
  chemicalTreatment: string[];
  prevention: string[];
  spreadRisk: string;
  /** Spoken immediately on completion — low-literacy users listen, not read. */
  speak: string;
}

export interface VerificationResult {
  signal: Signal;
  verdict: string;
  productName: string;
  brand: string;
  batch?: string;
  registrationNo?: string;
  reasons: string[];
  advice: string;
  reportUrl?: string;
  speak: string;
}

export interface DiversificationPlan {
  currentUse: string;
  totalIdleAcre: number;
  options: {
    id: string;
    title: string;
    emoji: string;
    investment: string;
    monthlyIncome: string;
    paybackMonths: number;
    effort: 'low' | 'medium' | 'high';
    waterNeed: 'low' | 'medium' | 'high';
    signal: Signal;
    why: string;
    steps: string[];
  }[];
  speak: string;
}

export interface ResiduePlan {
  summary: string;
  estimatedResidue: string;
  burningHarms: string[];
  machinery: {
    name: string;
    emoji: string;
    description: string;
    subsidy: string;
    whereToGet: string;
  }[];
  sellOptions: {
    buyer: string;
    emoji: string;
    description: string;
    estimatedRate: string;
  }[];
  soilBenefit: string[];
  speak: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  /** Set while the answer is streaming/pending. */
  pending?: boolean;
  sources?: string[];
  image?: string;
}

export interface SoilReading {
  nitrogen: { value: number; signal: Signal; label: string };
  phosphorus: { value: number; signal: Signal; label: string };
  potassium: { value: number; signal: Signal; label: string };
  ph: { value: number; signal: Signal; label: string };
  organicCarbon: { value: number; signal: Signal; label: string };
  advice: string[];
}

export interface Expense {
  id: string;
  label: string;
  category: 'seed' | 'fertiliser' | 'labour' | 'fuel' | 'irrigation' | 'other' | 'income';
  amount: number;
  date: string;
}

export interface FarmProfile {
  name: string;
  phone: string;
  village: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
  landAcre: number;
  soilType: string;
  irrigation: string;
  language: LangCode;
}
