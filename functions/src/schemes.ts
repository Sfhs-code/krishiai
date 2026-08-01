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

interface FarmProfile {
  landAcre?: number;
  state?: string;
  district?: string;
  irrigation?: string;
  soilType?: string;
}

/**
 * Curated catalogue of central government schemes, with the eligibility rule
 * for each expressed as code.
 *
 * This is deliberately not left to the LLM. Scheme names, benefit amounts and
 * portal URLs are facts a farmer may act on — a hallucinated ₹ figure or a
 * fake portal link is worse than no answer. Gemini is used only to translate
 * the human-readable reason.
 */
const RULES: (Omit<Scheme, 'eligible' | 'reason'> & {
  decide: (p: FarmProfile, crops: string[]) => { eligible: boolean; reason: string };
})[] = [
  {
    id: 'pm-kisan',
    name: 'PM-KISAN',
    nameHi: 'पीएम किसान सम्मान निधि',
    benefit: '₹6,000 / year',
    category: 'Direct income',
    applyUrl: 'https://pmkisan.gov.in/',
    documents: ['Aadhaar card', 'Land record (7/12 or khatauni)', 'Bank passbook'],
    decide: () => ({
      eligible: true,
      reason:
        'All landholding farmer families are covered. The amount arrives in three instalments of ₹2,000 directly in your Aadhaar-linked bank account.',
    }),
  },
  {
    id: 'fasal-bima',
    name: 'PM Fasal Bima Yojana',
    nameHi: 'प्रधानमंत्री फसल बीमा योजना',
    benefit: 'Crop insurance from 2% premium',
    category: 'Insurance',
    deadline: 'Before sowing each season',
    applyUrl: 'https://pmfby.gov.in/',
    documents: ['Aadhaar card', 'Sowing certificate', 'Bank passbook', 'Land record'],
    decide: (_p, crops) => ({
      eligible: true,
      reason: crops.length
        ? `You are growing ${crops.slice(0, 3).join(', ')}. Enrol before sowing to cover loss from drought, flood, pest attack or unseasonal rain.`
        : 'Any notified crop can be insured. You pay 2% of the sum insured for kharif and 1.5% for rabi; the government pays the rest.',
    }),
  },
  {
    id: 'kcc',
    name: 'Kisan Credit Card',
    nameHi: 'किसान क्रेडिट कार्ड',
    benefit: 'Up to ₹3 lakh @ 4%',
    category: 'Credit',
    applyUrl: 'https://www.myscheme.gov.in/schemes/kcc',
    documents: ['Aadhaar card', 'Land record', 'Passport photo', 'PAN card'],
    decide: () => ({
      eligible: true,
      reason:
        'Any cultivator with land records qualifies. Repay on time and the effective interest drops to 4% after the government subvention.',
    }),
  },
  {
    id: 'kusum',
    name: 'PM Kusum Solar Pump',
    nameHi: 'पीएम कुसुम सोलर पंप',
    benefit: 'Up to 60% subsidy on a solar pump',
    category: 'Energy',
    applyUrl: 'https://pmkusum.mnre.gov.in/',
    documents: ['Aadhaar card', 'Land record', 'Bank passbook', 'Electricity bill (if any)'],
    decide: (p) => {
      const grid = /electric|grid/i.test(p.irrigation ?? '');
      return grid
        ? {
            eligible: false,
            reason:
              'Component B of the scheme is for farmers without a grid-connected pump. Your holding already has an electric connection, so you would apply under Component C for solarisation instead.',
          }
        : {
            eligible: true,
            reason:
              'You do not have a grid-connected pump, so you can apply under Component B for a standalone solar pump with up to 60% central and state subsidy.',
          };
    },
  },
  {
    id: 'shc',
    name: 'Soil Health Card',
    nameHi: 'मृदा स्वास्थ्य कार्ड',
    benefit: 'Free soil test every 2 years',
    category: 'Advisory',
    applyUrl: 'https://soilhealth.dac.gov.in/',
    documents: ['Aadhaar card', 'Land record'],
    decide: () => ({
      eligible: true,
      reason:
        'Every farmer is entitled to a free soil test with a fertiliser recommendation. Collect the sample from your field and submit it at the nearest soil testing lab or Krishi Vigyan Kendra.',
    }),
  },
  {
    id: 'enam',
    name: 'e-NAM Registration',
    nameHi: 'ई-नाम पंजीकरण',
    benefit: 'Sell to 1,000+ mandis online',
    category: 'Market',
    applyUrl: 'https://enam.gov.in/',
    documents: ['Aadhaar card', 'Bank passbook', 'Mobile number'],
    decide: () => ({
      eligible: true,
      reason:
        'Register once and you can accept bids from buyers in other mandis without transporting your produce there first. Payment comes directly to your bank account.',
    }),
  },
  {
    id: 'pmksy',
    name: 'Per Drop More Crop (PMKSY)',
    nameHi: 'प्रति बूंद अधिक फसल',
    benefit: '55% subsidy on drip / sprinkler',
    category: 'Irrigation',
    applyUrl: 'https://pmksy.gov.in/microirrigation/',
    documents: ['Aadhaar card', 'Land record', 'Bank passbook', 'Quotation from an empanelled vendor'],
    decide: (p) => {
      const micro = /drip|sprinkler/i.test(p.irrigation ?? '');
      return micro
        ? {
            eligible: false,
            reason:
              'You already have micro-irrigation installed. The subsidy applies to a new installation, or to extending drip to an additional area you have not covered yet.',
          }
        : {
            eligible: true,
            reason:
              'Small and marginal farmers get 55% subsidy on drip or sprinkler systems. This typically cuts water use by 40% and works well on your soil type.',
          };
    },
  },
  {
    id: 'agri-infra',
    name: 'Agriculture Infrastructure Fund',
    nameHi: 'कृषि अवसंरचना निधि',
    benefit: '3% interest subvention on loans up to ₹2 crore',
    category: 'Credit',
    applyUrl: 'https://agriinfra.dac.gov.in/',
    documents: ['Aadhaar card', 'Land record', 'Project report', 'Bank account details'],
    decide: (p) => {
      const big = (p.landAcre ?? 0) >= 2;
      return big
        ? {
            eligible: true,
            reason:
              'Your holding supports a post-harvest project such as a small warehouse, cold room or grading unit. The fund pays 3% of the interest for seven years.',
          }
        : {
            eligible: true,
            reason:
              'You can apply through a Farmer Producer Organisation or a self-help group even on a smaller holding — group applications are explicitly covered.',
          };
    },
  },
];

export const SCHEME_CATALOGUE = RULES.map(({ decide: _decide, ...rest }) => rest);

export function matchSchemesLocally(profile: FarmProfile | undefined, crops: string[]): Scheme[] {
  const p = profile ?? {};
  const scored = RULES.map(({ decide, ...rest }) => {
    const { eligible, reason } = decide(p, crops);
    return { ...rest, eligible, reason };
  });
  // Eligible schemes first — that is what the farmer scrolls to.
  return scored.sort((a, b) => Number(b.eligible) - Number(a.eligible));
}
