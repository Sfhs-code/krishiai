export type Signal = 'green' | 'yellow' | 'red';

export interface SoilReading {
  nitrogen: { value: number; signal: Signal; label: string };
  phosphorus: { value: number; signal: Signal; label: string };
  potassium: { value: number; signal: Signal; label: string };
  ph: { value: number; signal: Signal; label: string };
  organicCarbon: { value: number; signal: Signal; label: string };
  advice: string[];
}

/**
 * Modelled soil profile for a location.
 *
 * India's Soil Health Card database has no free public point API, so this
 * derives a plausible reading from agro-ecological zone characteristics and a
 * location hash. It is deterministic (the same field always gives the same
 * numbers) and is presented in the UI as modelled, with a prompt to get a
 * certified Soil Health Card. Swap this for a real lab feed when one is
 * available — the response shape is what the client depends on.
 */
export function soilFor(lat: number, lon: number): SoilReading {
  const h = hash(`${lat.toFixed(2)},${lon.toFixed(2)}`);
  const pick = (i: number, min: number, max: number) => min + ((h >> (i * 5)) & 31) / 31 * (max - min);

  // Broad zone split — the Deccan black-soil belt behaves very differently from
  // the Indo-Gangetic alluvium, and this is the single biggest driver.
  const blackSoilBelt = lat > 15 && lat < 22 && lon > 72 && lon < 80;
  const gangetic = lat > 24 && lat < 30 && lon > 75 && lon < 88;

  const nitrogen = Math.round(blackSoilBelt ? pick(0, 180, 300) : gangetic ? pick(0, 240, 400) : pick(0, 200, 360));
  const phosphorus = Math.round(pick(1, 9, 38));
  const potassium = Math.round(blackSoilBelt ? pick(2, 180, 380) : pick(2, 110, 260));
  const ph = Number((blackSoilBelt ? pick(3, 7.2, 8.4) : gangetic ? pick(3, 6.4, 7.8) : pick(3, 5.8, 7.6)).toFixed(1));
  const organicCarbon = Number(pick(4, 0.28, 0.82).toFixed(2));

  const nSig: Signal = nitrogen < 240 ? 'red' : nitrogen < 480 ? 'yellow' : 'green';
  const pSig: Signal = phosphorus < 10 ? 'red' : phosphorus < 25 ? 'yellow' : 'green';
  const kSig: Signal = potassium < 120 ? 'red' : potassium < 280 ? 'yellow' : 'green';
  const phSig: Signal = ph < 5.5 || ph > 8.5 ? 'red' : ph < 6.0 || ph > 7.8 ? 'yellow' : 'green';
  const ocSig: Signal = organicCarbon < 0.4 ? 'red' : organicCarbon < 0.6 ? 'yellow' : 'green';

  const label = (s: Signal) => (s === 'red' ? 'Low' : s === 'yellow' ? 'Medium' : 'Good');

  const advice: string[] = [];
  if (nSig !== 'green') {
    advice.push(
      `Nitrogen is ${label(nSig).toLowerCase()}. Apply ${nSig === 'red' ? 45 : 25} kg urea per acre, split into two doses with your irrigations.`,
    );
  }
  if (pSig !== 'green') {
    advice.push(`Phosphorus is ${label(pSig).toLowerCase()}. Apply ${pSig === 'red' ? 50 : 30} kg single super phosphate per acre at sowing.`);
  }
  if (kSig !== 'green') {
    advice.push(`Potassium is ${label(kSig).toLowerCase()}. Add ${kSig === 'red' ? 30 : 20} kg muriate of potash per acre before the next irrigation.`);
  }
  if (ph > 7.8) {
    advice.push('Soil is alkaline. Apply gypsum at 200 kg per acre and use ammonium sulphate instead of urea this season.');
  } else if (ph < 6.0) {
    advice.push('Soil is acidic. Apply agricultural lime at 200 kg per acre four weeks before sowing.');
  }
  if (ocSig !== 'green') {
    advice.push('Organic carbon is below target. Grow dhaincha or sunhemp as green manure after harvest and plough it back at flowering.');
  }
  if (!advice.length) {
    advice.push('All nutrients are in the good range. Maintain the current fertiliser schedule and re-test after two seasons.');
  }

  return {
    nitrogen: { value: nitrogen, signal: nSig, label: label(nSig) },
    phosphorus: { value: phosphorus, signal: pSig, label: label(pSig) },
    potassium: { value: potassium, signal: kSig, label: label(kSig) },
    ph: { value: ph, signal: phSig, label: ph > 7.8 ? 'Alkaline' : ph < 6 ? 'Acidic' : 'Neutral' },
    organicCarbon: { value: organicCarbon, signal: ocSig, label: label(ocSig) },
    advice,
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
