import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

import { CONFIG, hasGemini, hasMandi, hasWeather, langName } from './config';
import { generate, generateJson, farmerSystemPrompt, NoGeminiKey } from './gemini';
import { fetchWeather, reverseGeocode, NoWeatherKey } from './weather';
import { fetchMandi, NoMandiKey } from './mandi';
import { soilFor } from './soil';
import { SCHEME_CATALOGUE, matchSchemesLocally } from './schemes';

setGlobalOptions({ region: 'us-central1', maxInstances: 10, memory: '512MiB', timeoutSeconds: 120 });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '12mb' })); // leaf photos arrive as base64

/** 503 tells the client "not configured" so it can show demo data gracefully. */
function handleError(res: Response, err: unknown, label: string): void {
  if (err instanceof NoGeminiKey || err instanceof NoWeatherKey || err instanceof NoMandiKey) {
    res.status(503).json({ error: 'not-configured', service: label });
    return;
  }
  console.error(`[${label}]`, err);
  res.status(502).json({ error: 'upstream-failed', service: label });
}

const num = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/* ------------------------------------------------------------------ health */

app.get('/health', (_req, res) => {
  res.json({ gemini: hasGemini(), weather: hasWeather(), mandi: hasMandi(), model: CONFIG.geminiModel });
});

/* ----------------------------------------------------------------- weather */

app.get('/weather', async (req: Request, res: Response) => {
  try {
    const lat = num(req.query.lat, 19.9975);
    const lon = num(req.query.lon, 73.7898);
    res.set('Cache-Control', 'public, max-age=900');
    res.json(await fetchWeather(lat, lon, String(req.query.lang ?? 'en')));
  } catch (err) {
    handleError(res, err, 'weather');
  }
});

app.get('/geo', async (req: Request, res: Response) => {
  try {
    const place = await reverseGeocode(num(req.query.lat, 0), num(req.query.lon, 0));
    res.json({ place });
  } catch (err) {
    handleError(res, err, 'geo');
  }
});

/* ------------------------------------------------------------------- mandi */

app.get('/mandi', async (req: Request, res: Response) => {
  try {
    const commodities = String(req.query.commodities ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    res.set('Cache-Control', 'public, max-age=1800');
    res.json(await fetchMandi(String(req.query.state ?? 'Maharashtra'), commodities));
  } catch (err) {
    handleError(res, err, 'mandi');
  }
});

/* -------------------------------------------------------------------- soil */

app.get('/soil', (req: Request, res: Response) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json(soilFor(num(req.query.lat, 19.99), num(req.query.lon, 73.78)));
});

/* -------------------------------------------------------------------- chat */

app.post('/ai/chat', async (req: Request, res: Response) => {
  try {
    const { question, lang = 'en', profile, crops = [], history = [] } = req.body ?? {};
    if (typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'question-required' });
      return;
    }

    const context = [
      profile ? `Farmer's farm: ${profile.landAcre} acre in ${profile.village}, ${profile.district}, ${profile.state}. Soil: ${profile.soilType}. Irrigation: ${profile.irrigation}.` : '',
      Array.isArray(crops) && crops.length
        ? `Crops right now: ${crops.map((c: { name: string; stage: string; areaAcre: number; status: string }) => `${c.name} (${c.areaAcre} acre, ${c.stage}, ${c.status})`).join('; ')}.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const answer = await generate(`${context ? `${context}\n\n` : ''}Farmer asks: ${question}`, {
      system: farmerSystemPrompt(langName(String(lang))),
      history: Array.isArray(history) ? history.slice(-8) : [],
      temperature: 0.5,
      maxOutputTokens: 900,
    });

    res.json({ answer });
  } catch (err) {
    handleError(res, err, 'chat');
  }
});

/* --------------------------------------------------------------- diagnosis */

app.post('/ai/diagnose', async (req: Request, res: Response) => {
  try {
    const { image, cropHint, lang = 'en', place } = req.body ?? {};
    if (typeof image !== 'string' || image.length < 100) {
      res.status(400).json({ error: 'image-required' });
      return;
    }

    const language = langName(String(lang));
    const prompt = [
      'You are a plant pathologist looking at a photo of a crop leaf from an Indian farm.',
      cropHint ? `The farmer says this is ${cropHint}.` : 'Identify the crop yourself.',
      place ? `The farm is in ${place}.` : '',
      '',
      'Return JSON matching exactly this shape:',
      `{
  "crop": string,
  "disease": string (English name; "Healthy" if no disease),
  "diseaseLocal": string (the same name in ${language}),
  "confidence": number 0-100,
  "signal": "green" | "yellow" | "red",
  "severity": string (one or two words),
  "summary": string (2 sentences in ${language}, plain language),
  "organicTreatment": string[] (2-4 steps in ${language}, with quantities),
  "chemicalTreatment": string[] (2-4 steps in ${language}, name the active ingredient, dose per litre, and the pre-harvest interval),
  "prevention": string[] (2-3 steps in ${language}),
  "spreadRisk": string (Low, Medium or High, written in ${language}),
  "speak": string (a 3-sentence spoken summary in ${language}; this is read aloud to a farmer who cannot read)
}`,
      '',
      'Rules:',
      '- signal is "green" when the leaf is healthy, "yellow" for a minor or early problem, "red" for a serious infection that spreads fast.',
      '- If the photo is too blurry or is not a plant, set disease to "Unclear photo", confidence below 30, signal "yellow", and ask for a clearer photo in the summary.',
      '- Never recommend a pesticide banned in India. Always mention gloves and mask in the chemical steps.',
      '- No markdown anywhere in the strings.',
    ]
      .filter(Boolean)
      .join('\n');

    const result = await generateJson<Record<string, unknown>>(prompt, {
      image: { mimeType: 'image/jpeg', data: image },
      temperature: 0.25,
      maxOutputTokens: 1600,
    });

    res.json(result);
  } catch (err) {
    handleError(res, err, 'diagnose');
  }
});

/* ------------------------------------------------------------ verification */

app.post('/ai/verify', async (req: Request, res: Response) => {
  try {
    const { image, barcode, lang = 'en' } = req.body ?? {};
    if (!image && !barcode) {
      res.status(400).json({ error: 'image-or-barcode-required' });
      return;
    }

    const language = langName(String(lang));
    const gtin = typeof barcode === 'string' ? barcode.replace(/\D/g, '') : '';
    const checkDigitOk = gtin ? validGtin(gtin) : null;

    const prompt = [
      'You are verifying whether an agricultural input (fertiliser, pesticide or seed packet) sold to an Indian farmer is genuine or counterfeit.',
      image ? 'A photo of the product label is attached. Read the brand, product name, batch number and the CIB&RC / FCO registration number from it.' : '',
      gtin ? `The scanned barcode is ${gtin}.` : '',
      checkDigitOk !== null
        ? `The GS1 check digit is ${checkDigitOk ? 'VALID' : 'INVALID'}.${gtin.startsWith('890') ? ' The 890 prefix indicates registration in India.' : ''}`
        : '',
      '',
      'Return JSON matching exactly this shape:',
      `{
  "signal": "green" | "yellow" | "red",
  "verdict": string (short phrase in ${language}),
  "productName": string,
  "brand": string,
  "batch": string,
  "registrationNo": string,
  "reasons": string[] (2-4 short sentences in ${language} explaining the evidence),
  "advice": string (what the farmer should do now, in ${language}),
  "speak": string (a 3-sentence spoken summary in ${language})
}`,
      '',
      'Rules for the signal, and follow them strictly:',
      '- "green" only when the label shows a readable manufacturer, a plausible registration number, and nothing contradicts it.',
      '- "yellow" when something cannot be confirmed: unreadable label, missing registration number, no network evidence. This is the honest default.',
      '- "red" only when there is concrete evidence of a fake: an invalid check digit, a misspelt brand name, a missing mandatory registration number on a pesticide, or an expiry date already past.',
      '- You cannot query a live registry, so never claim you confirmed the product with the manufacturer. If you are inferring, say you are inferring.',
      '- Use "" for any field you genuinely cannot read.',
      '- No markdown anywhere in the strings.',
    ]
      .filter(Boolean)
      .join('\n');

    const result = await generateJson<Record<string, unknown>>(prompt, {
      image: image ? { mimeType: 'image/jpeg', data: image } : undefined,
      temperature: 0.2,
      maxOutputTokens: 1200,
    });

    res.json(result);
  } catch (err) {
    handleError(res, err, 'verify');
  }
});

/* ---------------------------------------------------------- diversification */

app.post('/ai/diversify', async (req: Request, res: Response) => {
  try {
    const { idleAcre = 1, profile, lang = 'en', budget = 'medium' } = req.body ?? {};
    const language = langName(String(lang));

    const prompt = [
      `A farmer in ${profile?.district ?? 'Nashik'}, ${profile?.state ?? 'Maharashtra'} has ${idleAcre} acre of idle or under-used land.`,
      `Soil: ${profile?.soilType ?? 'black cotton'}. Irrigation: ${profile?.irrigation ?? 'borewell'}. Total holding: ${profile?.landAcre ?? 4} acre.`,
      `Their budget is ${budget}.`,
      '',
      'Recommend 4 realistic ways to earn from that idle land. Consider agroforestry, beekeeping, mushroom cultivation, solar leasing, fish or poultry, floriculture, fodder, and vermicompost production. Choose what actually fits this district and soil.',
      '',
      'Return JSON matching exactly this shape:',
      `{
  "currentUse": string,
  "totalIdleAcre": number,
  "options": [{
    "id": string (slug),
    "title": string (in ${language}),
    "emoji": string (one emoji),
    "investment": string (rupees, Indian formatting),
    "monthlyIncome": string (rupees range),
    "paybackMonths": number,
    "effort": "low" | "medium" | "high",
    "waterNeed": "low" | "medium" | "high",
    "signal": "green" | "yellow" | "red",
    "why": string (1-2 sentences in ${language}),
    "steps": string[] (3-4 concrete first steps in ${language})
  }],
  "speak": string (3-sentence spoken summary in ${language})
}`,
      '',
      'Rules:',
      '- Order the options best-first: the first one must be the one you would actually advise.',
      '- signal is "green" for low risk and proven local demand, "yellow" where approval or a buyer is uncertain, "red" for high risk.',
      '- Use real Indian scheme names and real input costs. Do not invent subsidy percentages.',
      '- No markdown anywhere in the strings.',
    ].join('\n');

    const result = await generateJson<Record<string, unknown>>(prompt, { temperature: 0.6, maxOutputTokens: 2400 });
    res.json(result);
  } catch (err) {
    handleError(res, err, 'diversify');
  }
});

/* ---------------------------------------------------------- post-harvest residue */

app.post('/ai/residue', async (req: Request, res: Response) => {
  try {
    const { cropName = 'Paddy', acres = 2, lang = 'en', profile } = req.body ?? {};
    const language = langName(String(lang));
    const place = profile ? `${profile.district ?? 'Nashik'}, ${profile.state ?? 'Maharashtra'}` : 'Punjab, India';

    const prompt = [
      `You are a crop-residue management advisor. Stubble burning is illegal and causes severe air pollution across India, and you help farmers find profitable alternatives.`,
      '',
      'HARVEST DETAILS',
      `- Crop just harvested: ${cropName}`,
      `- Area: ${acres} acres`,
      `- Location: ${place}`,
      '',
      'YOUR TASK',
      '1. Estimate how much residue this harvest produces.',
      '2. Give three concrete reasons not to burn it — include the actual environmental compensation fine and the nitrogen, phosphorus and potassium lost per tonne burnt.',
      '3. Recommend in-situ machinery — Super Seeder, Happy Seeder, Smart Seeder, Mulcher, Baler, Rotavator — with the real subsidy available under the Crop Residue Management (CRM) scheme, and where a farmer hires it (Custom Hiring Centre, co-operative society).',
      '4. Give ways to SELL the residue for actual money — biomass power plants, compressed bio-gas plants, paper mills, cattle fodder traders, mushroom growers — with realistic per-tonne rates.',
      '',
      'Return JSON matching exactly this shape:',
      `{
  "summary": string (two encouraging sentences to the farmer in ${language}),
  "estimatedResidue": string (rough tonnes for this crop and acreage),
  "burningHarms": string[] (3 short reasons not to burn, including the legal fine and nutrient loss),
  "machinery": [{
    "name": string,
    "emoji": string (one emoji),
    "description": string (what it does, 2 sentences),
    "subsidy": string (actual subsidy % and scheme name),
    "whereToGet": string (where to hire or buy)
  }],
  "sellOptions": [{
    "buyer": string (who buys — biomass plant, CBG plant, paper mill, cattle fodder, mushroom unit),
    "emoji": string (one emoji),
    "description": string (how the farmer sells to them, 2 sentences),
    "estimatedRate": string (realistic rate per tonne in rupees)
  }],
  "soilBenefit": string[] (2 lines on what incorporating residue does for soil),
  "speak": string (3-sentence spoken summary in ${language})
}`,
      '',
      'Rules:',
      '- Every rupee figure must be realistic for India in 2026.',
      '- Be practical and encouraging, never preachy. The farmer burns because it is cheap and fast — show them something better.',
      `- Write ALL text values natively in ${language}. Keep scheme and machine names recognisable.`,
      '- No markdown anywhere in the strings.',
    ].join('\n');

    const result = await generateJson<Record<string, unknown>>(prompt, { temperature: 0.5, maxOutputTokens: 2400 });
    res.json(result);
  } catch (err) {
    handleError(res, err, 'residue');
  }
});

/* ----------------------------------------------------------------- schemes */

app.post('/ai/schemes', async (req: Request, res: Response) => {
  try {
    const { profile, crops = [], lang = 'en' } = req.body ?? {};

    // The catalogue is the source of truth for names, benefits and URLs so the
    // model can never invent a scheme or a portal link. Gemini only re-writes
    // the eligibility reason in the farmer's language.
    const base = matchSchemesLocally(profile, Array.isArray(crops) ? crops : []);

    if (!hasGemini() || String(lang) === 'en') {
      res.json(base);
      return;
    }

    const language = langName(String(lang));
    const prompt = [
      `Translate the "reason" field of each scheme below into ${language}. Keep every other field byte-for-byte identical.`,
      'Return a JSON array with exactly the same objects in the same order.',
      '',
      JSON.stringify(base),
    ].join('\n');

    try {
      const translated = await generateJson<typeof base>(prompt, { temperature: 0.1, maxOutputTokens: 3000 });
      // Never let a bad translation drop schemes or rewrite the apply URLs.
      const safe = Array.isArray(translated) && translated.length === base.length
        ? base.map((s, i) => ({ ...s, reason: translated[i]?.reason ?? s.reason }))
        : base;
      res.json(safe);
    } catch {
      res.json(base);
    }
  } catch (err) {
    handleError(res, err, 'schemes');
  }
});

app.get('/schemes/catalogue', (_req, res) => {
  res.json(SCHEME_CATALOGUE);
});

app.use((_req, res) => {
  res.status(404).json({ error: 'not-found' });
});

export const api = onRequest(app);

/* --------------------------------------------------------------- utilities */

function validGtin(digits: string): boolean {
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const body = digits.slice(0, -1).split('').reverse().map(Number);
  const check = Number(digits.slice(-1));
  const sum = body.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

if (process.env.RENDER === 'true' || process.env.RENDER) {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
