import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Camera, Image as ImageIcon, Loader2, RotateCcw } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { diagnoseLeaf, ApiUnavailable } from '../../lib/api';
import { fileToCompressedBase64 } from '../../lib/image';
import type { DiagnosisResult } from '../../lib/types';
import { SignalBanner, SignalPill } from '../../components/StatusLight';
import { PrimaryButton, ScreenHeader, SpeakButton } from '../../components/ui';

export default function DiseaseScan() {
  const { t } = useTranslation();
  const hint = (useLocation().state as { cropHint?: string } | null)?.cropHint;
  const { profile, lang, say } = useApp();

  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const { dataUrl, base64 } = await fileToCompressedBase64(file, 1024, 0.82);
      setPreview(dataUrl);
      const res = await diagnoseLeaf(base64, { cropHint: hint, lang, profile });
      setResult(res);
      say(res.speak || `${res.disease}. ${res.summary}`);
    } catch (err) {
      setError(
        err instanceof ApiUnavailable && err.reason === 'no-key'
          ? 'The vision service is not configured. Add a Gemini API key to the backend to enable photo diagnosis.'
          : err instanceof ApiUnavailable && err.reason === 'offline'
            ? 'You are offline. The photo is saved — reconnect and scan again to get a diagnosis.'
            : 'Could not read that photo. Take a clearer picture of a single affected leaf in daylight.',
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-5">
      <ScreenHeader title={t('disease.title')} subtitle={t('disease.instruction')} back speakText={t('disease.instruction')} />

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-lg shadow-glass">
          <img src={preview} alt="Leaf being analysed" className="aspect-[4/3] w-full object-cover" />
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[oklch(20%_0.03_155_/_0.55)] backdrop-blur-sm text-white">
              <Loader2 size={34} className="animate-spin" aria-hidden />
              <p className="font-display font-bold">{t('disease.analysing')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card/60">
          <span className="text-5xl" aria-hidden>🍃</span>
          <p className="max-w-[15rem] text-center text-sm text-muted-foreground">{t('disease.instruction')}</p>
        </div>
      )}

      {!result && (
        <div className="grid gap-2.5">
          <PrimaryButton onClick={() => cameraInput.current?.click()} disabled={busy}>
            <Camera size={19} aria-hidden /> {t('disease.takePhoto')}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            disabled={busy}
            className="press flex items-center justify-center gap-2 rounded-md border border-border bg-card py-3.5 font-semibold disabled:opacity-50"
          >
            <ImageIcon size={18} aria-hidden /> {t('disease.choosePhoto')}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-[oklch(94%_0.08_82)] p-4">
          <p className="text-[15px] font-medium leading-snug text-[oklch(42%_0.1_70)]">{error}</p>
          <button type="button" onClick={reset} className="mt-3 flex items-center gap-1.5 text-sm font-bold text-[oklch(42%_0.1_70)]">
            <RotateCcw size={14} aria-hidden /> {t('disease.scanAnother')}
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <SignalBanner
            signal={result.signal}
            title={result.diseaseLocal ? `${result.disease} · ${result.diseaseLocal}` : result.disease}
            detail={result.summary}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <SignalPill signal={result.signal} label={t('disease.confidence', { n: Math.round(result.confidence) })} size="sm" />
                <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold">
                  {t('disease.severity')}: {result.severity}
                </span>
                <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold">
                  {t('disease.spreadRisk')}: {result.spreadRisk}
                </span>
                <SpeakButton text={result.speak || `${result.disease}. ${result.summary}`} />
              </div>
            }
          />

          {(
            [
              { title: t('disease.organic'), emoji: '🌿', items: result.organicTreatment },
              { title: t('disease.chemical'), emoji: '🧪', items: result.chemicalTreatment },
              { title: t('disease.prevention'), emoji: '🛡️', items: result.prevention },
            ] as const
          )
            .filter((s) => s.items?.length)
            .map((s) => (
              <section key={s.title} className="solid-card p-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-xl" aria-hidden>{s.emoji}</span>
                  <h2 className="flex-1 font-display text-lg font-bold">{s.title}</h2>
                  <SpeakButton text={`${s.title}. ${s.items.join('. ')}`} />
                </div>
                <ol className="space-y-2.5">
                  {s.items.map((item, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-[15px] leading-snug">{item}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}

          <button
            type="button"
            onClick={reset}
            className="press flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card py-3.5 font-semibold"
          >
            <RotateCcw size={17} aria-hidden /> {t('disease.scanAnother')}
          </button>
        </div>
      )}
    </div>
  );
}
