import type { LangCode } from './types';

/**
 * Voice engine. Wraps the browser Web Speech APIs behind a tiny, resilient
 * surface so the whole app can "speak first". Both recognition and synthesis
 * degrade silently on browsers that lack them (older Android WebViews) — the
 * UI stays usable, it just falls back to tap + text.
 */

const BCP47: Record<LangCode, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  pa: 'pa-IN',
  ta: 'ta-IN',
  bn: 'bn-IN',
};

/* ----------------------------------------------------------------- synthesis */

let voicesReady = false;
function primeVoices() {
  if (voicesReady || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.getVoices();
  voicesReady = true;
}

function pickVoice(lang: LangCode): SpeechSynthesisVoice | undefined {
  if (typeof speechSynthesis === 'undefined') return undefined;
  const wanted = BCP47[lang].toLowerCase();
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === wanted) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en'))
  );
}

export function ttsSupported(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

/** Speak text aloud. Cancels any in-flight speech first. */
export function speak(text: string, lang: LangCode, opts: { onEnd?: () => void; rate?: number } = {}): void {
  if (!ttsSupported() || !text.trim()) {
    opts.onEnd?.();
    return;
  }
  primeVoices();
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = BCP47[lang];
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = opts.rate ?? 0.96; // a touch slower — clarity over speed
    u.pitch = 1;
    u.onend = () => opts.onEnd?.();
    u.onerror = () => opts.onEnd?.();
    speechSynthesis.speak(u);
  } catch {
    opts.onEnd?.();
  }
}

export function stopSpeaking(): void {
  if (ttsSupported()) {
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

export function isSpeaking(): boolean {
  return ttsSupported() && speechSynthesis.speaking;
}

/* --------------------------------------------------------------- recognition */

type SpeechRecognitionCtor = new () => SpeechRecognition;

function recognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function asrSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface Listener {
  stop: () => void;
  abort: () => void;
}

/**
 * Start listening. Designed for a press-and-hold mic: call `start`, keep the
 * returned handle, and call `stop()` on release. Interim results stream to
 * `onPartial` so the user sees words appear as they speak.
 */
export function listen(
  lang: LangCode,
  handlers: {
    onPartial?: (text: string) => void;
    onResult: (text: string) => void;
    onError?: (kind: 'no-speech' | 'not-allowed' | 'unsupported' | 'error') => void;
    onStart?: () => void;
    onEnd?: () => void;
  },
): Listener {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    handlers.onError?.('unsupported');
    return { stop: () => undefined, abort: () => undefined };
  }

  const rec = new Ctor();
  rec.lang = BCP47[lang];
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = '';

  rec.onstart = () => handlers.onStart?.();
  rec.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) handlers.onPartial?.((finalText + interim).trim());
  };
  rec.onerror = (event: SpeechRecognitionErrorEvent) => {
    const code = event.error;
    if (code === 'no-speech') handlers.onError?.('no-speech');
    else if (code === 'not-allowed' || code === 'service-not-allowed') handlers.onError?.('not-allowed');
    else handlers.onError?.('error');
  };
  rec.onend = () => {
    if (finalText.trim()) handlers.onResult(finalText.trim());
    handlers.onEnd?.();
  };

  try {
    rec.start();
  } catch {
    handlers.onError?.('error');
  }

  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    abort: () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Warm up the audio + voice pipeline on the first user gesture (autoplay policy). */
export function primeSpeech(): void {
  primeVoices();
  if (ttsSupported()) {
    try {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      speechSynthesis.speak(u);
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}
