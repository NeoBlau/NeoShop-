import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../../ui/Button.js';
import { locationBase, type LocationManifest } from './useLocationData.js';

/**
 * Which world to walk into.
 *
 * Read from each location's own manifest rather than written here, so adding a
 * location is a build step and not a code change. The choice is remembered:
 * somebody who prefers the trail should not have to say so every visit.
 */

const STORAGE_KEY = 'sfera.location';

export function rememberedLocation(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberLocation(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode: the choice lasts for this visit, which is enough.
  }
}

interface Card {
  id: string;
  title: string;
  blurb: string;
  triangles: number;
  plots: number;
}

async function readCards(ids: string[], locale: 'ru' | 'en'): Promise<Card[]> {
  const cards = await Promise.all(
    ids.map(async (id): Promise<Card | null> => {
      try {
        const response = await fetch(`${locationBase(id)}/location.json`);
        if (!response.ok) return null;

        const manifest = (await response.json()) as LocationManifest;
        const finest = [...manifest.levels].sort((a, b) => a.level - b.level)[0];

        return {
          id,
          title: manifest.title?.[locale] ?? id,
          blurb: manifest.blurb?.[locale] ?? '',
          triangles: finest?.triangles ?? 0,
          plots: manifest.anchors.length,
        };
      } catch {
        // A location listed but not readable is simply not offered.
        return null;
      }
    }),
  );

  return cards.filter((card): card is Card => card !== null);
}

export function LocationPicker({
  ids,
  onChoose,
  onSkip,
}: {
  ids: string[];
  onChoose: (id: string) => void;
  onSkip: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('en') ? 'en' : 'ru';
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void readCards(ids, locale).then((list) => {
      if (!cancelled) setCards(list);
    });

    return () => {
      cancelled = true;
    };
  }, [ids, locale]);

  if (!cards) {
    return (
      <div className="text-ink-muted flex items-center justify-center gap-2 py-24 text-sm">
        <Spinner />
        {t('world.entering')}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-ink text-2xl font-semibold tracking-tight">{t('world.pickTitle')}</h1>
      <p className="text-ink-muted mt-1 text-sm">{t('world.pickSubtitle')}</p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => onChoose(card.id)}
              className="panel hover:border-edge-strong w-full p-5 text-left transition-colors"
            >
              <p className="text-ink text-lg font-medium">{card.title}</p>
              <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">{card.blurb}</p>
              <p className="text-ink-faint mt-3 text-xs">
                {t('world.pickFacts', {
                  triangles: (card.triangles / 1e6).toFixed(1),
                  plots: card.plots,
                })}
              </p>
            </button>
          </li>
        ))}
      </ul>

      <button type="button" onClick={onSkip} className="text-ink-faint hover:text-ink mt-6 text-sm">
        {t('world.openCatalog')}
      </button>
    </div>
  );
}
