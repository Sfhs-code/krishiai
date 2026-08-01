import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScanLine, Camera, Loader2, RotateCcw, X, Keyboard } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { verifyInput, ApiUnavailable } from '../../lib/api';
import { fileToCompressedBase64 } from '../../lib/image';
import { startBarcodeScan, isValidGtin, gs1Origin, type ScanHandle } from '../../lib/barcode';
import type { VerificationResult } from '../../lib/types';
import { SignalBanner, SignalPill } from '../../components/StatusLight';
import { Field, PrimaryButton, ScreenHeader, SpeakButton, inputClass } from '../../components/ui';

/**
 * Offline heuristic used when the backend is unreachable. It only ever returns
 * green or yellow — declaring something counterfeit is a serious call and
 * requires the registry check on the server.
 */
function localVerdict(code: string): VerificationResult {
  const valid = isValidGtin(code);
  const origin = gs1Origin(code);
  return {
    signal: valid ? 'yellow' : 'red',
    verdict: valid ? 'Under review' : 'Invalid barcode',
    productName: 'Unknown product',
    brand: '—',
    batch: code,
    reasons: valid
      ? [
          'Barcode check digit is valid.',
          origin ? `Registered origin: ${origin}.` : 'Origin prefix not recognised.',
          'Could not reach the registry to confirm the manufacturer — treat as unverified.',
        ]
      : [
          'The barcode check digit does not match.',
          'A genuine retail barcode always passes this test.',
          'This is a strong sign of a fake or re-printed label.',
        ],
    advice: valid
      ? 'Keep the bill and the empty packet. Verify again once you have network before using the product on a large area.'
      : 'Do not use this product. Take a photo of the packet and the shop bill, and report it on the Kisan Call Centre number 1800-180-1551.',
    speak: valid
      ? 'This barcode looks structurally valid but I could not confirm the manufacturer offline. Check again when you have network.'
      : 'Warning. This barcode is not valid. Do not use this product. Keep the bill and report it.',
  };
}

export default function VerifyProduct() {
  const { t } = useTranslation();
  const { lang, say } = useApp();

  const [mode, setMode] = useState<'idle' | 'scanning' | 'manual'>('idle');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  const video = useRef<HTMLVideoElement>(null);
  const handle = useRef<ScanHandle | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const check = async (payload: { barcode?: string; imageBase64?: string }) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await verifyInput({ ...payload, lang });
      setResult(res);
      say(res.speak || res.verdict);
    } catch (err) {
      if (payload.barcode) {
        const local = localVerdict(payload.barcode);
        setResult(local);
        say(local.speak);
      } else {
        setError(
          err instanceof ApiUnavailable && err.reason === 'no-key'
            ? 'Label reading needs a Gemini API key on the backend. You can still scan the barcode — that works offline.'
            : 'Could not verify right now. Scan the barcode instead, or try again when you have network.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const startScan = async () => {
    setMode('scanning');
    setError(null);
    setResult(null);
    // Wait a frame so the <video> element is mounted before the camera attaches.
    await new Promise((r) => requestAnimationFrame(r));
    if (!video.current) return;
    handle.current = await startBarcodeScan(
      video.current,
      (code) => {
        setMode('idle');
        void check({ barcode: code });
      },
      (kind) => {
        setMode('idle');
        setError(kind === 'denied' ? t('verify.cameraDenied') : 'No camera available. Enter the barcode number instead.');
      },
    );
  };

  const stopScan = () => {
    handle.current?.stop();
    handle.current = null;
    setMode('idle');
  };

  useEffect(() => () => handle.current?.stop(), []);

  const reset = () => {
    setResult(null);
    setError(null);
    setManual('');
    setMode('idle');
  };

  return (
    <div className="space-y-5">
      <ScreenHeader title={t('verify.title')} subtitle={t('verify.instruction')} back speakText={t('verify.instruction')} />

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const { base64 } = await fileToCompressedBase64(f, 1100, 0.85);
          void check({ imageBase64: base64 });
        }}
      />

      {mode === 'scanning' && (
        <div className="relative overflow-hidden rounded-lg bg-black shadow-glass">
          <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-[78%] rounded-md border-2 border-white/90 shadow-[0_0_0_9999px_oklch(0%_0_0_/_0.45)]" />
          </div>
          <button
            type="button"
            onClick={stopScan}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
            aria-label={t('cancel')}
          >
            <X size={18} aria-hidden />
          </button>
          <p className="absolute inset-x-0 bottom-3 text-center text-sm font-semibold text-white">
            {t('verify.scanBarcode')}…
          </p>
        </div>
      )}

      {busy && (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-card py-8">
          <Loader2 size={22} className="animate-spin text-primary" aria-hidden />
          <p className="font-display font-bold">{t('verify.checking')}</p>
        </div>
      )}

      {mode === 'idle' && !busy && !result && (
        <div className="grid gap-2.5">
          <PrimaryButton onClick={() => void startScan()}>
            <ScanLine size={19} aria-hidden /> {t('verify.scanBarcode')}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            className="press flex items-center justify-center gap-2 rounded-md border border-border bg-card py-3.5 font-semibold"
          >
            <Camera size={18} aria-hidden /> {t('verify.photoLabel')}
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className="press flex items-center justify-center gap-2 py-2 text-sm font-semibold text-muted-foreground"
          >
            <Keyboard size={15} aria-hidden /> Enter number manually
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="solid-card space-y-3 p-4">
          <Field label="Barcode number">
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="8901234567890"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="press flex-1 rounded-md border border-border py-3 font-semibold">
              {t('cancel')}
            </button>
            <PrimaryButton className="flex-1" onClick={() => void check({ barcode: manual.trim() })} disabled={manual.trim().length < 6}>
              {t('verify.title')}
            </PrimaryButton>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-[oklch(94%_0.08_82)] p-4">
          <p className="text-[15px] font-medium leading-snug text-[oklch(42%_0.1_70)]">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <SignalBanner
            signal={result.signal}
            title={
              result.signal === 'green' ? t('verify.genuine') : result.signal === 'yellow' ? t('verify.suspect') : t('verify.fake')
            }
            detail={result.verdict}
            action={<SpeakButton text={result.speak || `${result.verdict}. ${result.advice}`} />}
          />

          <section className="solid-card divide-y divide-border">
            {[
              { label: 'Product', value: result.productName },
              { label: t('verify.brand'), value: result.brand },
              { label: t('verify.batch'), value: result.batch ?? '—' },
              { label: t('verify.registration'), value: result.registrationNo ?? '—' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="min-w-0 truncate font-semibold">{row.value}</span>
              </div>
            ))}
          </section>

          <section className="solid-card p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <h2 className="flex-1 font-display text-lg font-bold">{t('verify.why')}</h2>
              <SpeakButton text={result.reasons.join('. ')} />
            </div>
            <ul className="space-y-2">
              {result.reasons.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          </section>

          <section className={`rounded-lg p-4 ${result.signal === 'red' ? 'bg-[oklch(93%_0.05_25)]' : 'bg-primary-soft'}`}>
            <div className="mb-1.5 flex items-center gap-2">
              <h2 className="flex-1 font-display text-lg font-bold">{t('verify.advice')}</h2>
              <SignalPill signal={result.signal} label={t(`signal.${result.signal}`)} size="sm" />
            </div>
            <p className="text-[15px] leading-snug">{result.advice}</p>
            {result.signal === 'red' && (
              <a
                href="tel:18001801551"
                className="press mt-3 flex items-center justify-center gap-2 rounded-md bg-destructive py-3 font-bold text-destructive-foreground"
              >
                📞 Report — 1800 180 1551
              </a>
            )}
          </section>

          <button
            type="button"
            onClick={reset}
            className="press flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card py-3.5 font-semibold"
          >
            <RotateCcw size={17} aria-hidden /> {t('verify.checkAnother')}
          </button>
        </div>
      )}
    </div>
  );
}
