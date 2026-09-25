import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { StreetQuest } from './useStreetQuest.js';
import { Button } from '../../ui/Button.js';

/**
 * The quest, in the corner of the world.
 *
 * Small on purpose, and never in the way: it is an offer, not a task list. One
 * objective is on screen at a time, with the reason the last one mattered
 * underneath it, because "walk a hundred metres" is only worth doing if
 * somebody says what the hundred metres was for.
 *
 * It never blocks anything. The buy button, the panels and the walking all
 * work identically whether a quest is running, finished or ignored — the same
 * rule the room missions follow, for the same reason: a discount is a nudge,
 * not a gate.
 */
export function QuestPanel({ quest, language }: { quest: StreetQuest; language: 'ru' | 'en' }) {
  const { t } = useTranslation();
  const definition = quest.quest;
  if (!definition) return null;

  if (quest.promo) {
    return (
      <aside className="panel pointer-events-auto absolute top-24 left-3 z-10 w-[17rem] p-3 sm:left-4">
        <p className="text-accent text-xs">{t('quest.finished')}</p>
        <p className="text-ink-muted mt-1.5 text-xs leading-relaxed">
          {definition.outro[language]}
        </p>
        <p className="text-ink mt-3 font-mono text-sm tracking-wider">{quest.promo.code}</p>
        <p className="text-ink-faint mt-1 text-[11px]">
          {t('quest.promoNote', { percent: quest.promo.percentOff })}
        </p>
        <Link
          to="/cart"
          className="text-accent mt-3 inline-block text-xs hover:underline"
          onClick={quest.give}
        >
          {t('quest.toCart')}
        </Link>
      </aside>
    );
  }

  if (!quest.active) {
    return (
      <aside className="panel pointer-events-auto absolute top-24 left-3 z-10 w-[17rem] p-3 sm:left-4">
        <p className="text-ink text-xs font-medium">{definition.title[language]}</p>
        <p className="text-ink-muted mt-1.5 text-xs leading-relaxed">
          {definition.intro[language]}
        </p>
        <p className="text-ink-faint mt-2 text-[11px]">
          {t('quest.reward', { percent: definition.percentOff })}
        </p>
        {quest.error ? <p className="text-danger mt-2 text-[11px]">{t(quest.error)}</p> : null}
        <div className="mt-3">
          <Button variant="ghost" onClick={quest.start}>
            {t('quest.accept')}
          </Button>
        </div>
      </aside>
    );
  }

  const step = quest.step;

  return (
    <aside className="panel pointer-events-auto absolute top-24 left-3 z-10 w-[17rem] p-3 sm:left-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-ink text-xs font-medium">{definition.title[language]}</p>
        <button
          type="button"
          onClick={quest.give}
          className="text-ink-faint hover:text-ink shrink-0 text-[11px]"
        >
          {t('quest.hide')}
        </button>
      </div>

      {step ? (
        <>
          <p className="text-ink-faint mt-2 text-[11px]">
            {t('quest.stepOf', { index: quest.index + 1, total: definition.steps.length })}
          </p>
          <p className="text-ink-muted mt-1 text-xs leading-relaxed">{step.prompt[language]}</p>

          <div className="bg-panel-raised mt-2.5 h-1 overflow-hidden rounded-full">
            <div
              className="bg-accent h-full transition-[width] duration-500"
              style={{ width: `${Math.round(quest.progress.fraction * 100)}%` }}
            />
          </div>

          {quest.progress.tally ? (
            <p className="text-ink-faint mt-1 text-[11px]">
              {t('quest.tally', quest.progress.tally)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-ink-muted mt-2 text-xs">{t('quest.wrappingUp')}</p>
      )}

      {/* Why the last objective was worth doing. Kept after the objective it
          belongs to, so the panel reads as a conversation rather than a form. */}
      {quest.justDone ? (
        <p className="border-edge text-ink-faint mt-3 border-t pt-2 text-[11px] leading-relaxed">
          {quest.justDone.done[language]}
        </p>
      ) : null}

      {quest.error ? <p className="text-danger mt-2 text-[11px]">{t(quest.error)}</p> : null}
    </aside>
  );
}
