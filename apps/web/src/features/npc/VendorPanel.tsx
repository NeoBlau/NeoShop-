import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { matchHeard, vendorLines, type ProductCategory, type VendorLine } from '@3dsfera/shared';
import { Button } from '../../ui/Button.js';
import { useListener, useSpeaker } from './voice.js';

/**
 * The conversation with a vendor.
 *
 * Scripted, and that is the feature. A seller who improvises can promise a
 * delivery date nobody agreed to, quote a warranty that does not exist or
 * invent a return policy — and it would be *this* platform's seller saying it.
 * So the answers are written, reviewed and translated, and the microphone does
 * not widen what can be said: it only picks which written answer is read out.
 *
 * Both halves of the voice are optional and both say so. Speaking is local and
 * free. Hearing is not — in Chrome the audio goes to Google — so the
 * microphone stays off until it is asked for, and every question it could
 * catch is also a button.
 */
export function VendorPanel({
  name,
  supplierName,
  category,
  onSpeakingChange,
  onClose,
}: {
  name: string;
  supplierName: string;
  /** Null when the frontage has nothing on it. */
  category: ProductCategory | null;
  /** So the counter in the scene can show which vendor is talking. */
  onSpeakingChange: (speaking: boolean) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ru';

  const lines = useMemo(() => vendorLines(category), [category]);
  const [answered, setAnswered] = useState<VendorLine | null>(null);
  const [missed, setMissed] = useState(false);
  const [voice, setVoice] = useState(true);

  const speaker = useSpeaker(voice);
  const say = speaker.say;

  useEffect(() => {
    onSpeakingChange(speaker.speaking);
  }, [speaker.speaking, onSpeakingChange]);

  // Nothing carries on talking after the panel closes.
  useEffect(() => speaker.hush, [speaker.hush]);

  const answer = useCallback(
    (line: VendorLine) => {
      setAnswered(line);
      setMissed(false);
      say(line.answer[language], language === 'en' ? 'en-GB' : 'ru-RU');
    },
    [language, say],
  );

  const onHeard = useCallback(
    (text: string) => {
      const line = matchHeard(text, lines);
      if (line) {
        answer(line);
        return;
      }
      // Saying "I did not understand" out loud is worse than showing it: the
      // buyer is already looking at the panel they just spoke into.
      setMissed(true);
    },
    [answer, lines],
  );

  const listener = useListener(onHeard);

  return (
    <aside
      role="dialog"
      aria-label={name}
      className="panel pointer-events-auto absolute inset-x-3 bottom-3 z-10 max-h-[64vh] overflow-y-auto p-4 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-h-[72vh] sm:w-[24rem]"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-ink text-sm font-semibold">{name}</p>
          <p className="text-ink-faint text-xs">
            {t('npc.vendorRole', { supplier: supplierName })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {speaker.available ? (
            <button
              type="button"
              onClick={() => setVoice((on) => !on)}
              aria-pressed={voice}
              title={voice ? t('npc.voiceOff') : t('npc.voiceOn')}
              className="text-ink-faint hover:text-ink rounded px-1.5 py-1 text-sm transition-colors"
            >
              <span aria-hidden="true">{voice ? '🔊' : '🔇'}</span>
              <span className="sr-only">{voice ? t('npc.voiceOff') : t('npc.voiceOn')}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="text-ink-faint hover:text-ink px-1 text-xs"
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>
      </header>

      <p aria-live="polite" className="text-ink-muted mt-3 text-sm leading-relaxed">
        {answered ? answered.answer[language] : t('npc.vendorGreeting', { name })}
      </p>

      {missed ? <p className="text-ink-faint mt-2 text-xs">{t('npc.notCaught')}</p> : null}

      {listener.listening || listener.heard !== '' ? (
        <p className="text-ink-faint mt-2 text-xs italic">
          {listener.heard === '' ? t('npc.listening') : `«${listener.heard}»`}
        </p>
      ) : null}

      {listener.error ? <p className="text-danger mt-2 text-xs">{t(listener.error)}</p> : null}

      <p className="text-ink-faint mt-4 text-xs">{t('npc.ask')}</p>

      <div className="mt-2 flex flex-col gap-1.5">
        {lines.map((line) => (
          <button
            key={line.id}
            type="button"
            onClick={() => answer(line)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              answered?.id === line.id
                ? 'border-accent/50 bg-accent/10 text-ink'
                : 'border-edge hover:border-edge-strong hover:bg-panel-raised'
            }`}
          >
            {line.question[language]}
          </button>
        ))}
      </div>

      {/* The microphone. Available only where the browser has recognition at
          all, and it says where the audio goes before it is pressed rather
          than after. */}
      {listener.available ? (
        <div className="border-edge mt-4 border-t pt-3">
          <Button
            variant={listener.listening ? 'primary' : 'ghost'}
            onClick={() =>
              listener.listening
                ? listener.stop()
                : listener.start(language === 'en' ? 'en-GB' : 'ru-RU')
            }
          >
            {listener.listening ? t('npc.micStop') : t('npc.micStart')}
          </Button>
          <p className="text-ink-faint mt-2 text-[11px] leading-snug">{t('npc.micNotice')}</p>
        </div>
      ) : null}
    </aside>
  );
}
