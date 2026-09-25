import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { missionIn, type MissionStep } from '@3dsfera/shared';
import { Button, Spinner } from '../ui/Button.js';
import { Alert } from '../ui/Alert.js';
import { useWorld } from '../features/world/useWorld.js';
import { useZone } from '../features/zones/useZone.js';
import { useMissionRunner } from '../features/missions/runner.js';
import {
  detectCapabilities,
  pickQualityTier,
  webglUnavailable,
  type QualityTier,
} from '../scene/quality.js';
import { useCart } from '../stores/cart.js';
import { priceFormatter } from '../lib/format.js';

/**
 * One mission, start to discount code.
 *
 * The page owns three things the scene and the runner should not: which clip
 * is playing, how far the buyer is from the product, and the answer to a quiz
 * step. Everything else is delegated — the room and the product to the scene,
 * the step order and the code to the runner, which is to say to the server.
 */

const ZoneScene = lazy(async () => {
  const module = await import('../scene/zone/ZoneScene.js');
  return { default: module.ZoneScene };
});

/** Whether a step is satisfied by walking, by watching or by pressing. */
function stepNeedsButton(step: MissionStep): boolean {
  return step.goal.kind === 'play';
}

export function MissionPage() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ id: string }>();

  const { world, loading: worldLoading } = useWorld();

  // A mission may be one of ours or one a supplier wrote and an administrator
  // published; the latter arrive with the world, so the lookup waits for it.
  const definition = useMemo(
    () => (params.id ? missionIn(params.id, world?.missions ?? []) : null),
    [params.id, world],
  );
  const { zone, loading: zoneLoading, failed: zoneFailed } = useZone(definition?.zone ?? null);

  const [tier, setTier] = useState<QualityTier>('high');
  const [noWebgl, setNoWebgl] = useState(false);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const [distance, setDistance] = useState(Infinity);
  const [answered, setAnswered] = useState<number | null>(null);

  const add = useCart((state) => state.add);
  const formatPrice = useMemo(() => priceFormatter(i18n.language), [i18n.language]);
  const locale = i18n.language.startsWith('en') ? 'en' : 'ru';

  useEffect(() => {
    const capabilities = detectCapabilities();
    if (webglUnavailable(capabilities)) {
      setNoWebgl(true);
      return;
    }
    setTier(pickQualityTier(capabilities));
  }, []);

  const product = useMemo(() => {
    if (!world || !definition) return null;
    for (const pavilion of world.pavilions) {
      const match = pavilion.products.find((entry) => entry.slug === definition.productSlug);
      if (match) return match;
    }
    return null;
  }, [world, definition]);

  // The runner needs a mission object; calling the hook conditionally is not
  // an option, so a missing one is handled after it rather than before.
  const runner = useMissionRunner(definition ?? FALLBACK_MISSION);
  const step = runner.step;

  // Walking up to the product satisfies its step on its own.
  useEffect(() => {
    if (!step || step.goal.kind !== 'approach') return;
    if (distance <= step.goal.metres) runner.finishStep(step.id);
  }, [step, distance, runner]);

  // A watch step is a timer, and only starts once it is the step on screen.
  useEffect(() => {
    if (!step || step.goal.kind !== 'watch') return;
    const timer = window.setTimeout(() => runner.finishStep(step.id), step.goal.seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [step, runner]);

  useEffect(() => {
    setAnswered(null);
  }, [step?.id]);

  const onClipEnd = useCallback(
    (clip: string) => {
      setActiveClip(null);
      if (step && step.goal.kind === 'play' && step.goal.clip === clip) runner.finishStep(step.id);
    },
    [step, runner],
  );

  if (!definition) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="danger">{t('mission.unknown')}</Alert>
        <Link to="/" className="text-accent mt-4 inline-block text-sm hover:underline">
          {t('mission.backToStreet')}
        </Link>
      </div>
    );
  }

  if (noWebgl) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="info">{t('mission.needsWebgl')}</Alert>
        <Link to="/catalog" className="text-accent mt-4 inline-block text-sm hover:underline">
          {t('world.openCatalog')}
        </Link>
      </div>
    );
  }

  if (worldLoading || zoneLoading) {
    return (
      <div className="text-ink-muted flex items-center justify-center gap-2 py-24 text-sm">
        <Spinner />
        {t('mission.loading')}
      </div>
    );
  }

  if (zoneFailed || !zone) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="info">{t('mission.zoneMissing')}</Alert>
        <Link to="/" className="text-accent mt-4 inline-block text-sm hover:underline">
          {t('mission.backToStreet')}
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="info">{t('mission.productMissing')}</Alert>
        <Link to="/catalog" className="text-accent mt-4 inline-block text-sm hover:underline">
          {t('world.openCatalog')}
        </Link>
      </div>
    );
  }

  const panelOpen = runner.phase !== 'running' || step === null;

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden">
      <Suspense
        fallback={
          <div className="text-ink-muted flex h-full items-center justify-center gap-2 text-sm">
            <Spinner />
            {t('mission.loading')}
          </div>
        }
      >
        <ZoneScene
          zone={zone}
          product={product}
          tier={tier}
          onTierChange={setTier}
          activeClip={activeClip}
          onClipEnd={onClipEnd}
          onDistance={setDistance}
          controlsEnabled={!panelOpen}
        />
      </Suspense>

      {/* Crosshair while walking, the same as on the street. */}
      {!panelOpen ? (
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <div className="bg-void/70 border-edge text-ink-muted pointer-events-auto max-w-[22rem] rounded-lg border px-3 py-2 text-xs backdrop-blur">
          <p className="text-ink text-sm">{definition.title[locale]}</p>
          <p className="text-ink-faint mt-0.5">
            {zone.manifest.title[locale]} ·{' '}
            {t('mission.stepOf', {
              step: Math.min(runner.index + 1, definition.steps.length),
              total: definition.steps.length,
            })}
          </p>

          {/* The credit belongs to whoever built the room, and CC-BY asks for
              it wherever the work is shown. */}
          <a
            href={zone.manifest.credit.url}
            target="_blank"
            rel="noreferrer"
            className="text-ink-faint hover:text-ink mt-1 block truncate"
            title={`${zone.manifest.credit.title} — ${zone.manifest.credit.author}`}
          >
            {zone.manifest.credit.author} · {zone.manifest.credit.licence}
          </a>
        </div>

        <Link
          to="/"
          className="bg-void/70 border-edge text-ink-muted hover:text-ink pointer-events-auto rounded-lg border px-3 py-2 text-xs backdrop-blur"
        >
          {t('mission.leave')}
        </Link>
      </div>

      {/* The script. One card, bottom of the screen on a phone and to the side
          on a desktop, so the room stays visible while it is read. */}
      <aside className="panel pointer-events-auto absolute inset-x-3 bottom-3 z-10 max-h-[60vh] overflow-y-auto p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[24rem]">
        {runner.phase === 'idle' ? (
          <>
            <p className="text-ink-muted text-sm leading-relaxed">{definition.intro[locale]}</p>
            <p className="text-ink-faint mt-2 text-xs">
              {t('mission.reward', { percent: definition.percentOff })}
            </p>
            <Button className="mt-3 w-full" onClick={runner.begin}>
              {t('mission.begin')}
            </Button>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() =>
                add({
                  productId: product.id,
                  slug: product.slug,
                  title: product.title,
                  priceCents: product.priceCents,
                  currency: product.currency,
                  previewUrl: product.previewUrl,
                })
              }
            >
              {t('mission.buyAnyway', {
                price: formatPrice(product.priceCents, product.currency),
              })}
            </Button>
          </>
        ) : null}

        {runner.phase === 'intro' || runner.phase === 'sending' ? (
          <p className="text-ink-muted flex items-center gap-2 text-sm">
            <Spinner />
            {t('mission.working')}
          </p>
        ) : null}

        {runner.phase === 'running' && step ? (
          <>
            {runner.justDone ? (
              <p className="text-ink-faint mb-2 text-xs">{runner.justDone.done[locale]}</p>
            ) : null}

            <p className="text-ink text-sm font-medium">{step.prompt[locale]}</p>

            {step.goal.kind === 'approach' ? (
              <p className="text-ink-faint mt-1.5 text-xs">
                {Number.isFinite(distance)
                  ? t('mission.metresAway', { metres: distance.toFixed(1) })
                  : t('mission.walkOver')}
              </p>
            ) : null}

            {step.goal.kind === 'watch' ? (
              <p className="text-ink-faint mt-1.5 text-xs">{t('mission.watching')}</p>
            ) : null}

            {stepNeedsButton(step) && step.goal.kind === 'play' ? (
              <Button
                className="mt-3 w-full"
                disabled={activeClip !== null}
                onClick={() => setActiveClip(step.goal.kind === 'play' ? step.goal.clip : null)}
              >
                {activeClip ? t('mission.playing') : t('mission.press')}
              </Button>
            ) : null}

            {step.goal.kind === 'answer' ? (
              <div className="mt-3 space-y-1.5">
                {step.goal.options.map((option, index) => {
                  const chosen = answered === index;
                  const correct = step.goal.kind === 'answer' && index === step.goal.correct;

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setAnswered(index);
                        if (correct) runner.finishStep(step.id);
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        chosen && correct
                          ? 'border-accent bg-accent/10 text-ink'
                          : chosen
                            ? 'border-danger/50 text-danger'
                            : 'border-edge text-ink-muted hover:border-edge-strong'
                      }`}
                    >
                      {option[locale]}
                    </button>
                  );
                })}
                {answered !== null &&
                step.goal.kind === 'answer' &&
                answered !== step.goal.correct ? (
                  <p className="text-ink-faint text-xs">{t('mission.tryAgain')}</p>
                ) : null}
              </div>
            ) : null}

            <div className="border-edge mt-3 h-1 overflow-hidden rounded-full border">
              <div
                className="bg-accent h-full transition-all"
                style={{ width: `${(runner.index / definition.steps.length) * 100}%` }}
              />
            </div>
          </>
        ) : null}

        {runner.phase === 'done' ? (
          <>
            <p className="text-ink-muted text-sm leading-relaxed">{definition.outro[locale]}</p>

            {runner.promo ? (
              <div className="border-accent/40 bg-accent/10 mt-3 rounded-lg border p-3">
                <p className="text-ink-faint text-xs">
                  {t('mission.codeFor', { percent: runner.promo.percentOff })}
                </p>
                <p className="text-ink mt-1 font-mono text-lg tracking-wider">
                  {runner.promo.code}
                </p>
                <p className="text-ink-faint mt-1 text-[11px]">
                  {t('mission.codeUntil', {
                    date: new Date(runner.promo.expiresAt).toLocaleDateString(i18n.language),
                  })}
                </p>
              </div>
            ) : null}

            <Button
              className="mt-3 w-full"
              onClick={() =>
                add({
                  productId: product.id,
                  slug: product.slug,
                  title: product.title,
                  priceCents: product.priceCents,
                  currency: product.currency,
                  previewUrl: product.previewUrl,
                })
              }
            >
              {t('mission.addToCart', {
                price: formatPrice(product.priceCents, product.currency),
              })}
            </Button>
            <Link to="/cart" className="text-accent mt-2 inline-block text-sm hover:underline">
              {t('mission.toCart')}
            </Link>
          </>
        ) : null}

        {runner.phase === 'failed' ? (
          <>
            <Alert tone="danger">{t('mission.failed')}</Alert>
            <Button variant="ghost" className="mt-3 w-full" onClick={runner.reset}>
              {t('common.retry')}
            </Button>
          </>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * Stands in while the route has no mission, so the runner hook can be called
 * unconditionally. Never begun: the page returns before that.
 */
const FALLBACK_MISSION = {
  id: '',
  where: 'zone',
  productSlug: '',
  zone: '',
  title: { ru: '', en: '' },
  intro: { ru: '', en: '' },
  outro: { ru: '', en: '' },
  steps: [],
  percentOff: 0,
} as const;
