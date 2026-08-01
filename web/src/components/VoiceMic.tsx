import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Mic, X, Loader2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Sheet } from './Sheet';
import { asrSupported, listen, type Listener } from '../lib/speech';
import { routeIntent } from '../lib/intents';

/**
 * Persistent "Hold to Speak" control, mounted once in the AppShell so it is
 * genuinely available on every screen.
 *
 * Interaction: press and hold anywhere on the button, speak, release to send.
 * A short tap also works (toggle mode) because holding is hard for users with
 * unsteady hands — both gestures reach the same place.
 */
export function VoiceMic() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang, say, hush } = useApp();

  const [open, setOpen] = useState(false);
  const [partial, setPartial] = useState('');
  const [phase, setPhase] = useState<'idle' | 'listening' | 'working'>('idle');
  const [error, setError] = useState<string | null>(null);

  const listener = useRef<Listener | null>(null);
  const holdStart = useRef(0);
  const supported = asrSupported();

  const finish = useCallback(
    (transcript: string) => {
      setPhase('working');
      const intent = routeIntent(transcript, lang);

      if (intent.kind === 'navigate') {
        say(intent.say);
        navigate(intent.to);
      } else if (intent.kind === 'action') {
        say(intent.say);
        const routes: Record<string, string> = {
          'scan-disease': '/tools/disease',
          'verify-input': '/tools/verify',
          sos: '/tools/sos',
          listen: '/assistant',
        };
        navigate(routes[intent.action] ?? '/assistant');
      } else {
        // A real question — hand it to the assistant, pre-filled and auto-sent.
        navigate('/assistant', { state: { ask: intent.question } });
      }

      setTimeout(() => {
        setOpen(false);
        setPhase('idle');
        setPartial('');
      }, 350);
    },
    [lang, navigate, say],
  );

  const start = useCallback(() => {
    if (!supported) {
      setOpen(true);
      setError(t('voiceNotSupported'));
      return;
    }
    hush();
    setError(null);
    setPartial('');
    setOpen(true);
    setPhase('listening');
    holdStart.current = Date.now();

    listener.current = listen(lang, {
      onPartial: setPartial,
      onResult: finish,
      onError: (kind) => {
        setPhase('idle');
        if (kind === 'not-allowed') setError(t('micDenied'));
        else if (kind === 'no-speech') setError(t('didNotCatch'));
        else if (kind === 'unsupported') setError(t('voiceNotSupported'));
        else setError(t('didNotCatch'));
      },
      onEnd: () => {
        setPhase((p) => (p === 'listening' ? 'idle' : p));
      },
    });
  }, [finish, hush, lang, supported, t]);

  const stop = useCallback(() => {
    // A tap under 350 ms means "toggle on" rather than "hold and release" —
    // keep listening so the user can speak at their own pace.
    if (Date.now() - holdStart.current < 350) return;
    listener.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    listener.current?.abort();
    listener.current = null;
    setOpen(false);
    setPhase('idle');
    setPartial('');
    setError(null);
  }, []);

  useEffect(() => () => listener.current?.abort(), []);

  return (
    <>
      <button
        type="button"
        aria-label={t('holdToSpeak')}
        onPointerDown={(e) => {
          e.preventDefault();
          start();
        }}
        onPointerUp={stop}
        onPointerLeave={() => phase === 'listening' && stop()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') stop();
        }}
        className="relative -mt-8 flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-full bg-leaf text-white shadow-float transition-transform duration-150 active:scale-95"
      >
        {phase === 'listening' && (
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[oklch(60%_0.15_152)]" aria-hidden />
        )}
        <span className="absolute inset-[3px] rounded-full ring-2 ring-white/40" aria-hidden />
        <Mic size={30} strokeWidth={2.4} className="relative" aria-hidden />
      </button>

      {open && (
        <Sheet onClose={cancel} label={t('holdToSpeak')}>
          <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative flex h-24 w-24 items-center justify-center">
                {phase === 'listening' && (
                  <>
                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/40" />
                    <span
                      className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30"
                      style={{ animationDelay: '0.5s' }}
                    />
                  </>
                )}
                <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-leaf text-white shadow-float">
                  {phase === 'working' ? (
                    <Loader2 size={34} className="animate-spin" aria-hidden />
                  ) : (
                    <Mic size={34} strokeWidth={2.4} aria-hidden />
                  )}
                </span>
              </div>

              <p className="font-display text-xl font-bold">
                {phase === 'listening' ? t('speakNow') : phase === 'working' ? t('assistant.thinking') : t('holdToSpeak')}
              </p>

              {phase === 'listening' && <p className="text-sm text-muted-foreground">{t('tapToStop')}</p>}

              {partial && (
                <p className="min-h-[3rem] w-full rounded-md bg-muted px-4 py-3 text-lg font-medium leading-snug">
                  {partial}
                </p>
              )}

              {error && (
                <p className="w-full rounded-md bg-[oklch(93%_0.05_25)] px-4 py-3 text-sm font-medium text-[oklch(45%_0.17_25)]">
                  {error}
                </p>
              )}

              <div className="flex w-full gap-3 pt-1">
                <button
                  type="button"
                  onClick={cancel}
                  className="press flex flex-1 items-center justify-center gap-2 rounded-md border border-border py-3 font-semibold"
                >
                  <X size={18} aria-hidden />
                  {t('close')}
                </button>
                {phase === 'idle' && (
                  <button
                    type="button"
                    onClick={start}
                    className="press flex-1 rounded-md bg-primary py-3 font-semibold text-primary-foreground"
                  >
                    {t('retry')}
                  </button>
                )}
                {phase === 'listening' && (
                  <button
                    type="button"
                    onClick={() => listener.current?.stop()}
                    className="press flex-1 rounded-md bg-primary py-3 font-semibold text-primary-foreground"
                  >
                    {t('assistant.send')}
                  </button>
                )}
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
