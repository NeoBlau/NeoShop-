import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Who took the photographs.
 *
 * Part of the menu photography is CC-BY, where the credit is a licence
 * condition rather than a courtesy, so it is rendered wherever the pictures
 * are. The file is written by the fetch step; when a brand supplies its own
 * photography the file simply is not there, and this renders nothing.
 */

interface Credit {
  item: string;
  creator: string;
  creatorUrl: string;
  licence: string;
  licenceUrl: string;
  source: string;
}

export function PhotoCredits() {
  const { t } = useTranslation();
  const [credits, setCredits] = useState<Credit[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch('/food/credits.json')
      .then((response) => (response.ok ? (response.json() as Promise<Credit[]>) : []))
      .then((list) => {
        if (!cancelled) setCredits(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        // No credits file is the normal case for supplied photography.
        if (!cancelled) setCredits([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!credits || credits.length === 0) return null;

  // One line, not forty: the same photographer often took several, and a wall
  // of links under a menu is nobody's idea of a credit.
  const people = [...new Set(credits.map((credit) => credit.creator).filter(Boolean))];
  const licences = [...new Set(credits.map((credit) => credit.licence.toUpperCase()))];

  return (
    <footer className="text-ink-faint mt-8 text-[11px] leading-relaxed">
      <p>{t('food.photoCredits', { credits: `${people.join(', ')} — ${licences.join(', ')}` })}</p>
    </footer>
  );
}
