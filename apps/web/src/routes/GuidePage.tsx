import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GUIDE_FACTS, guideBrief, matchHeard, type GuideLocation } from '@3dsfera/shared';
import { useLocationIndex, locationBase } from '../features/world/useLocationData.js';
import { SUGGESTED_ENDPOINT, useLocalAi } from '../features/guide/localAi.js';
import { Button, Spinner } from '../ui/Button.js';
import { Alert } from '../ui/Alert.js';

/**
 * The guide: questions about the worlds, answered twice over.
 *
 * Without a model connected, every answer is one of the written ones in the
 * shared package — reviewed, translated, and true whether or not anything else
 * is running. With one, the same facts are handed to a model on the buyer's own
 * machine as its brief, and it gets to phrase the answer instead.
 *
 * The facts are not all hard-coded: what locations this build actually has,
 * how many plots each one offers and how heavy it is come from the manifests
 * the asset build wrote. A guide that describes a location nobody built is
 * worse than no guide.
 */

interface Turn {
  id: number;
  question: string;
  answer: string;
  /** Where the answer came from, because the buyer is entitled to know. */
  from: 'script' | 'model';
}

/** Reads what each built location says about itself. */
function useGuideLocations(): { locations: GuideLocation[]; loading: boolean } {
  const { ids, loading: indexLoading } = useLocationIndex();
  const [locations, setLocations] = useState<GuideLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ru';

  useEffect(() => {
    if (indexLoading) return;

    const controller = new AbortController();

    void Promise.all(
      ids.map(async (id): Promise<GuideLocation | null> => {
        try {
          const response = await fetch(`${locationBase(id)}/location.json`, {
            signal: controller.signal,
          });
          if (!response.ok) return null;

          const manifest = (await response.json()) as {
            id: string;
            title?: { ru: string; en: string };
            blurb?: { ru: string; en: string };
            anchors?: unknown[];
            levels?: { level: number; triangles: number }[];
            source?: { title: string; author: string; licence: string };
          };

          const full = manifest.levels?.find((level) => level.level === 0);

          return {
            id: manifest.id,
            title: manifest.title?.[language] ?? manifest.id,
            blurb: manifest.blurb?.[language] ?? '',
            plots: manifest.anchors?.length ?? 0,
            triangles: full?.triangles ?? 0,
            credit: manifest.source
              ? `${manifest.source.title} — ${manifest.source.author}, ${manifest.source.licence}`
              : '',
          };
        } catch {
          // A location that will not describe itself is left out of the brief
          // rather than described wrongly.
          return null;
        }
      }),
    ).then((all) => {
      if (controller.signal.aborted) return;
      setLocations(all.filter((entry): entry is GuideLocation => entry !== null));
      setLoading(false);
    });

    return () => controller.abort();
  }, [ids, indexLoading, language]);

  return { locations, loading: indexLoading || loading };
}

function Connection({ ai }: { ai: ReturnType<typeof useLocalAi> }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(SUGGESTED_ENDPOINT);

  if (ai.endpoint !== null) {
    return (
      <div className="border-edge bg-panel-raised rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink-muted text-xs">
            {ai.state === 'ready'
              ? t('guide.connected', { model: ai.model ?? t('guide.unnamedModel') })
              : ai.state === 'checking'
                ? t('guide.checking')
                : t('guide.unreachable')}
          </p>
          <button
            type="button"
            onClick={ai.disconnect}
            className="text-ink-faint hover:text-ink text-xs underline"
          >
            {t('guide.disconnect')}
          </button>
        </div>
        <p className="text-ink-faint mt-1 font-mono text-[11px] break-all">{ai.endpoint}</p>
        {ai.state === 'unreachable' ? (
          <p className="text-ink-faint mt-2 text-[11px] leading-snug">
            {t('guide.unreachableHint')}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-edge bg-panel-raised rounded-lg border p-3">
      <p className="text-ink text-sm">{t('guide.connectTitle')}</p>
      <p className="text-ink-faint mt-1 text-xs leading-relaxed">{t('guide.connectHint')}</p>

      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ai.connect(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          inputMode="url"
          spellCheck={false}
          aria-label={t('guide.endpointLabel')}
          className="border-edge bg-void text-ink min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-xs outline-none focus:border-edge-strong"
        />
        <Button type="submit">{t('guide.connect')}</Button>
      </form>
    </div>
  );
}

export function GuidePage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const { locations, loading } = useGuideLocations();
  const ai = useLocalAi();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(1);
  const transcript = useRef<HTMLDivElement>(null);

  const brief = useMemo(() => guideBrief(locations, language), [locations, language]);

  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' });
  }, [turns, ai.thinking]);

  const answer = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (trimmed === '') return;

      setDraft('');

      // The script first, always: it is the answer if there is no model, and
      // it is the fallback if the model does not come back.
      const scripted = matchHeard(trimmed, GUIDE_FACTS);

      if (ai.state === 'ready') {
        const spoken = await ai.ask(brief, trimmed);
        if (spoken !== null) {
          setTurns((all) => [
            ...all,
            { id: nextId.current++, question: trimmed, answer: spoken, from: 'model' },
          ]);
          return;
        }
      }

      setTurns((all) => [
        ...all,
        {
          id: nextId.current++,
          question: trimmed,
          answer: scripted ? scripted.answer[language] : t('guide.noAnswer'),
          from: 'script',
        },
      ]);
    },
    [ai, brief, language, t],
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header>
        <h1 className="page-title">{t('guide.title')}</h1>
        <p className="text-ink-muted mt-1 text-sm leading-relaxed">{t('guide.intro')}</p>
      </header>

      <Connection ai={ai} />

      {loading ? (
        <div className="text-ink-muted flex items-center gap-2 text-sm">
          <Spinner />
          {t('guide.readingLocations')}
        </div>
      ) : locations.length === 0 ? (
        <Alert tone="info">{t('guide.noLocations')}</Alert>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {locations.map((location) => (
            <li key={location.id} className="panel p-3">
              <p className="text-ink text-sm font-medium">{location.title}</p>
              <p className="text-ink-muted mt-1 text-xs leading-relaxed">{location.blurb}</p>
              <p className="text-ink-faint mt-2 text-[11px]">
                {t('guide.locationStats', {
                  plots: location.plots,
                  triangles: location.triangles.toLocaleString(i18n.language),
                })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <section className="panel flex flex-col gap-3 p-4">
        <div ref={transcript} className="flex max-h-[45vh] flex-col gap-4 overflow-y-auto">
          {turns.length === 0 ? (
            <p className="text-ink-faint text-sm">{t('guide.empty')}</p>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className="flex flex-col gap-1.5">
                <p className="text-ink self-end rounded-lg bg-panel-raised px-3 py-2 text-sm">
                  {turn.question}
                </p>
                <p className="text-ink-muted text-sm leading-relaxed whitespace-pre-wrap">
                  {turn.answer}
                </p>
                <p className="text-ink-faint text-[11px]">
                  {turn.from === 'model' ? t('guide.fromModel') : t('guide.fromScript')}
                </p>
              </div>
            ))
          )}

          {ai.thinking ? (
            <div className="text-ink-faint flex items-center gap-2 text-sm">
              <Spinner />
              {t('guide.thinking')}
            </div>
          ) : null}
        </div>

        {ai.error ? <Alert tone="danger">{t(ai.error)}</Alert> : null}

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void answer(draft);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('guide.placeholder')}
            aria-label={t('guide.placeholder')}
            className="border-edge bg-void text-ink min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-edge-strong"
          />
          <Button type="submit" disabled={ai.thinking || draft.trim() === ''}>
            {t('guide.send')}
          </Button>
        </form>

        {/* The written questions, as buttons. Nobody should have to guess what
            this thing knows, and with no model connected these are exactly
            what it knows. */}
        <div className="flex flex-wrap gap-2">
          {GUIDE_FACTS.map((fact) => (
            <button
              key={fact.id}
              type="button"
              onClick={() => void answer(fact.question[language])}
              className="border-edge text-ink-muted hover:border-edge-strong hover:text-ink rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
            >
              {fact.question[language]}
            </button>
          ))}
        </div>
      </section>

      <p className="text-ink-faint text-xs">
        <Link to="/world" className="hover:text-ink underline">
          {t('guide.toWorld')}
        </Link>
      </p>
    </div>
  );
}
