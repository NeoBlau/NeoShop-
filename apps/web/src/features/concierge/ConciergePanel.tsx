import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { conciergeFollowUps, conciergeOpening, conciergeTopic } from '@3dsfera/shared';
import { Button } from '../../ui/Button.js';

/**
 * The concierge's side of the conversation.
 *
 * A visitor picks from what is on offer and never types: the answers are
 * written, reviewed and translated, which is the point of scripting it. The
 * panel holds the one piece of state the dialogue has — which topic is being
 * read — and everything else comes from the graph in the shared package.
 */
export function ConciergePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [topicId, setTopicId] = useState<string | null>(null);

  const topic = topicId === null ? null : conciergeTopic(topicId);
  const options = topic ? conciergeFollowUps(topic.id) : conciergeOpening();

  const reset = useCallback(() => setTopicId(null), []);

  return (
    <aside
      role="dialog"
      aria-label={t('concierge.name')}
      className="panel pointer-events-auto absolute inset-x-3 bottom-3 z-10 max-h-[62vh] overflow-y-auto p-4 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-h-[70vh] sm:w-[24rem]"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-ink text-sm font-semibold">{t('concierge.name')}</p>
          <p className="text-ink-faint text-xs">{t('concierge.role')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-faint hover:text-ink text-xs"
          aria-label={t('concierge.close')}
        >
          ✕
        </button>
      </header>

      {/* The greeting stays visible until something is asked, then the answer
          takes its place: two paragraphs of chrome above every reply would push
          the reply itself off a phone screen. */}
      <p className="text-ink-muted mt-3 text-sm leading-relaxed">
        {topic ? t(topic.answer) : t('concierge.greeting')}
      </p>

      {topic?.link ? (
        <Link
          to={topic.link.to}
          className="text-accent mt-3 inline-block text-sm hover:underline"
          onClick={onClose}
        >
          {t(topic.link.label)}
        </Link>
      ) : null}

      <p className="text-ink-faint mt-4 text-xs">{t('concierge.opening')}</p>

      <div className="mt-2 flex flex-col gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTopicId(option.id)}
            className="border-edge hover:border-edge-strong hover:bg-panel-raised rounded-lg border px-3 py-2 text-left text-sm transition-colors"
          >
            {t(option.question)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {topic ? (
          <Button variant="ghost" onClick={reset}>
            {t('concierge.back')}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onClose}>
          {t('concierge.close')}
        </Button>
      </div>
    </aside>
  );
}
