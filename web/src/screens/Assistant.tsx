import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Send, Mic, Loader2, Volume2, Square } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { askAgronomist, offlineAnswer, ApiUnavailable } from '../lib/api';
import { readCache, writeCache } from '../lib/cache';
import { asrSupported, listen, speak, stopSpeaking, isSpeaking, type Listener } from '../lib/speech';
import type { ChatMessage } from '../lib/types';

const HISTORY_KEY = 'chat';

export default function Assistant() {
  const { t } = useTranslation();
  const routerState = useLocation().state as { ask?: string } | null;
  const { profile, crops, lang, say, autoSpeak, isOnline } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const bottom = useRef<HTMLDivElement>(null);
  const listener = useRef<Listener | null>(null);
  const consumedAsk = useRef<string | null>(null);
  const hydrated = useRef(false);

  /* ------------------------------------------------- restore transcript */
  useEffect(() => {
    void readCache<ChatMessage[]>(HISTORY_KEY).then((c) => {
      if (c?.value?.length) setMessages(c.value.filter((m) => !m.pending));
      hydrated.current = true;
    });
  }, []);

  useEffect(() => {
    if (hydrated.current && messages.length) void writeCache(HISTORY_KEY, messages.slice(-40));
  }, [messages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy) return;

      const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', text, at: Date.now() };
      const pendingId = `a${Date.now()}`;
      setMessages((m) => [...m, userMsg, { id: pendingId, role: 'assistant', text: '', at: Date.now(), pending: true }]);
      setInput('');
      setBusy(true);

      try {
        const history = messages.slice(-8);
        const res = await askAgronomist(text, { profile, crops, history, lang });
        setMessages((m) =>
          m.map((msg) => (msg.id === pendingId ? { ...msg, text: res.answer, pending: false, sources: res.sources } : msg)),
        );
        if (autoSpeak) {
          setSpeakingId(pendingId);
          speak(res.answer, lang, { onEnd: () => setSpeakingId(null) });
        }
      } catch (err) {
        // Offline or no key — answer from the on-device rule base rather than failing.
        const fallback =
          err instanceof ApiUnavailable && err.reason === 'no-key'
            ? 'The AI service is not configured yet — add a Gemini API key to the backend to get full answers. Meanwhile, here is what I can tell you offline:\n\n' +
              offlineAnswer(text)
            : offlineAnswer(text);
        setMessages((m) => m.map((msg) => (msg.id === pendingId ? { ...msg, text: fallback, pending: false } : msg)));
        if (autoSpeak) say(fallback);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, profile, crops, lang, autoSpeak, say],
  );

  /* ------------- a question arriving from the global mic auto-sends once */
  useEffect(() => {
    const ask = routerState?.ask;
    if (ask && consumedAsk.current !== ask) {
      consumedAsk.current = ask;
      void send(ask);
    }
  }, [routerState, send]);

  const toggleMic = useCallback(() => {
    if (listening) {
      listener.current?.stop();
      return;
    }
    if (!asrSupported()) return;
    stopSpeaking();
    setListening(true);
    listener.current = listen(lang, {
      onPartial: setInput,
      onResult: (text) => void send(text),
      onError: () => setListening(false),
      onEnd: () => setListening(false),
    });
  }, [listening, lang, send]);

  useEffect(() => () => listener.current?.abort(), []);

  const toggleSpeak = (m: ChatMessage) => {
    if (speakingId === m.id && isSpeaking()) {
      stopSpeaking();
      setSpeakingId(null);
    } else {
      setSpeakingId(m.id);
      speak(m.text, lang, { onEnd: () => setSpeakingId(null) });
    }
  };

  const suggestions = [t('assistant.suggest1'), t('assistant.suggest2'), t('assistant.suggest3'), t('assistant.suggest4')];

  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col">
      <div className="mb-4">
        <h1 className="font-display text-3xl font-extrabold leading-[1.1]">{t('assistant.title')}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">{t('assistant.subtitle')}</p>
      </div>

      <div className="flex-1 space-y-3">
        {messages.length === 0 && (
          <>
            <div className="glass-card flex gap-3 p-4">
              <span className="text-2xl leading-none" aria-hidden>🌿</span>
              <p className="flex-1 text-[15px] leading-relaxed">{t('assistant.welcome')}</p>
            </div>
            <div className="grid gap-2 pt-2">
              {suggestions.filter(Boolean).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="press rounded-md border border-border bg-card px-4 py-3 text-left text-[15px] font-medium shadow-glass"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg rounded-br-sm bg-primary px-4 py-3 text-[15px] font-medium leading-snug text-primary-foreground">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base" aria-hidden>
                🌿
              </span>
              <div className="min-w-0 flex-1">
                <div className="rounded-lg rounded-tl-sm border border-border bg-card px-4 py-3 shadow-glass">
                  {m.pending ? (
                    <span className="flex items-center gap-2 text-[15px] text-muted-foreground">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      {t('assistant.thinking')}
                    </span>
                  ) : (
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.text}</p>
                  )}
                  {m.sources && m.sources.length > 0 && (
                    <ul className="mt-2 space-y-0.5 border-t border-border pt-2">
                      {m.sources.map((s) => (
                        <li key={s} className="text-[11px] text-muted-foreground">· {s}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {!m.pending && (
                  <button
                    type="button"
                    onClick={() => toggleSpeak(m)}
                    className="mt-1.5 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-primary"
                  >
                    {speakingId === m.id ? (
                      <><Square size={11} fill="currentColor" aria-hidden /> {t('assistant.speaking')}</>
                    ) : (
                      <><Volume2 size={13} aria-hidden /> {t('assistant.tapToHear')}</>
                    )}
                  </button>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>

      {!isOnline && (
        <p className="mt-4 rounded-md bg-[oklch(94%_0.08_82)] px-4 py-2.5 text-center text-sm font-semibold text-[oklch(42%_0.1_70)]">
          {t('offline')} — {t('savedData')}
        </p>
      )}

      {/* Composer sits above the fixed bottom nav. */}
      <form
        className="sticky bottom-[76px] mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="flex flex-1 items-end gap-2 rounded-lg border border-border bg-card p-1.5 shadow-glass">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder={t('assistant.placeholder')}
            className="max-h-28 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[15px] outline-none"
          />
          <button
            type="button"
            onClick={toggleMic}
            aria-label={t('holdToSpeak')}
            aria-pressed={listening}
            className={`press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${
              listening ? 'bg-destructive text-destructive-foreground' : 'bg-primary-soft text-primary'
            }`}
          >
            {listening && <span className="absolute inset-0 animate-pulse-ring rounded-md bg-destructive/50" aria-hidden />}
            <Mic size={20} strokeWidth={2.4} className="relative" aria-hidden />
          </button>
        </div>
        <button
          type="submit"
          disabled={!input.trim() || busy}
          aria-label={t('assistant.send')}
          className="press flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glass disabled:opacity-40"
        >
          {busy ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Send size={20} aria-hidden />}
        </button>
      </form>
    </div>
  );
}
