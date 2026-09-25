import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AUTHORED_GOALS,
  AUTHORED_LIMITS,
  DEMO_ZONES,
  authoredMissionSchema,
  authoredToMission,
  missionSeconds,
  type AuthoredGoal,
  type AuthoredMissionInput,
  type AuthoredStepInput,
} from '@3dsfera/shared';
import { ApiError } from '../../api/client.js';
import {
  missionAuthoringApi,
  type AuthoredMissionView,
} from '../../features/missions/authoring.js';
import { useZoneIndex } from '../../features/zones/useZone.js';
import { Alert } from '../../ui/Alert.js';
import { Button, Spinner } from '../../ui/Button.js';
import { Field } from '../../ui/Field.js';
import { Panel } from '../../ui/Panel.js';
import { Badge } from '../../ui/Form.js';

/**
 * Where a supplier writes the mission for their own product.
 *
 * The same thing the platform's missions are, authored instead of coded: a
 * room, a handful of steps, and a discount at the end. Three constraints are
 * enforced here as well as on the server, because hearing about them while
 * typing is worth more than hearing about them on submit:
 *
 *   a `play` step may only name a clip the uploaded model actually contains,
 *   so a mission cannot ask a buyer to press a button that does nothing;
 *   the discount is capped, because it is a promise the platform keeps on the
 *   supplier's behalf; and saving puts the mission back into draft, because a
 *   published mission is one buyers are playing and it does not change without
 *   somebody looking at it.
 */

const BLANK_STEP: AuthoredStepInput = {
  kind: 'approach',
  metres: 2,
  promptRu: '',
  promptEn: '',
  doneRu: '',
  doneEn: '',
};

function blankScript(zone: string): AuthoredMissionInput {
  return {
    zone,
    percentOff: 5,
    titleRu: '',
    titleEn: '',
    introRu: '',
    introEn: '',
    outroRu: '',
    outroEn: '',
    // Two steps, because that is the minimum and an empty list is not a form
    // anybody can start filling in.
    steps: [{ ...BLANK_STEP }, { ...BLANK_STEP, kind: 'watch', seconds: 5, metres: undefined }],
  };
}

/** The defaults a step needs when its kind changes, so nothing is left unset. */
function withKind(step: AuthoredStepInput, kind: AuthoredGoal): AuthoredStepInput {
  const base = { ...step, kind };

  switch (kind) {
    case 'approach':
      return { ...base, metres: step.metres ?? 2, seconds: undefined, clipName: undefined };
    case 'watch':
      return { ...base, seconds: step.seconds ?? 5, metres: undefined, clipName: undefined };
    case 'play':
      return { ...base, seconds: step.seconds ?? 3, metres: undefined };
  }
}

function StepRow({
  step,
  index,
  total,
  clips,
  onChange,
  onMove,
  onRemove,
}: {
  step: AuthoredStepInput;
  index: number;
  total: number;
  clips: readonly string[];
  onChange: (patch: Partial<AuthoredStepInput>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  return (
    <li className="border-edge rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink-faint text-xs">
          {t('missionBuilder.stepNumber', { index: index + 1 })}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={t('missionBuilder.moveUp')}
            className="text-ink-faint hover:text-ink disabled:opacity-30 px-1.5 text-sm"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={t('missionBuilder.moveDown')}
            className="text-ink-faint hover:text-ink disabled:opacity-30 px-1.5 text-sm"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total <= AUTHORED_LIMITS.stepsMin}
            aria-label={t('missionBuilder.removeStep')}
            className="text-ink-faint hover:text-danger disabled:opacity-30 px-1.5 text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink-faint">{t('missionBuilder.kind')}</span>
          <select
            value={step.kind}
            onChange={(event) => onChange(withKind(step, event.target.value as AuthoredGoal))}
            className="bg-panel-raised border-edge rounded-lg border px-2 py-1.5 text-sm outline-none"
          >
            {AUTHORED_GOALS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`missionBuilder.kind_${kind}`)}
              </option>
            ))}
          </select>
        </label>

        {step.kind === 'play' ? (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">{t('missionBuilder.clip')}</span>
            <select
              value={step.clipName ?? ''}
              onChange={(event) => onChange({ clipName: event.target.value })}
              className="bg-panel-raised border-edge rounded-lg border px-2 py-1.5 text-sm outline-none"
            >
              <option value="">{t('missionBuilder.pickClip')}</option>
              {clips.map((clip) => (
                <option key={clip} value={clip}>
                  {clip}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {step.kind === 'approach' ? (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">{t('missionBuilder.metres')}</span>
            <input
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              value={step.metres ?? 2}
              onChange={(event) => onChange({ metres: Number(event.target.value) })}
              className="bg-panel-raised border-edge w-20 rounded-lg border px-2 py-1.5 text-sm outline-none"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">{t('missionBuilder.seconds')}</span>
            <input
              type="number"
              min={0.5}
              max={60}
              step={0.5}
              value={step.seconds ?? 3}
              onChange={(event) => onChange({ seconds: Number(event.target.value) })}
              className="bg-panel-raised border-edge w-20 rounded-lg border px-2 py-1.5 text-sm outline-none"
            />
          </label>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field
          label={t('missionBuilder.promptRu')}
          value={step.promptRu}
          onChange={(event) => onChange({ promptRu: event.target.value })}
        />
        <Field
          label={t('missionBuilder.promptEn')}
          value={step.promptEn}
          onChange={(event) => onChange({ promptEn: event.target.value })}
        />
        <Field
          label={t('missionBuilder.doneRu')}
          hint={t('missionBuilder.doneHint')}
          value={step.doneRu}
          onChange={(event) => onChange({ doneRu: event.target.value })}
        />
        <Field
          label={t('missionBuilder.doneEn')}
          value={step.doneEn}
          onChange={(event) => onChange({ doneEn: event.target.value })}
        />
      </div>
    </li>
  );
}

export function MissionBuilderPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const productId = params.id ?? '';

  const { zones } = useZoneIndex();
  const [script, setScript] = useState<AuthoredMissionInput | null>(null);
  const [stored, setStored] = useState<AuthoredMissionView | null>(null);
  const [clips, setClips] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      const state = await missionAuthoringApi.get(productId);
      setStored(state.mission);
      setClips(state.availableClips);
      setScript(state.mission?.script ?? blankScript(DEMO_ZONES[0]));
    } catch (error) {
      setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const problems = useMemo(() => {
    if (!script) return [];
    const parsed = authoredMissionSchema.safeParse(script);
    if (parsed.success) return [];
    // Field paths rather than messages: the messages are for the server log,
    // and a supplier needs to know which box to look at.
    return parsed.error.issues.map((issue) => issue.path.join('.') || '—');
  }, [script]);

  // How long the mission will take, so the discount can be judged against the
  // work it asks for. Computed from the same function the pace check uses.
  const minutes = useMemo(() => {
    if (!script || problems.length > 0) return null;
    const preview = authoredToMission('preview', 'preview', script);
    return Math.round(missionSeconds(preview));
  }, [script, problems.length]);

  const patch = (next: Partial<AuthoredMissionInput>): void => {
    setSaved(false);
    setScript((current) => (current ? { ...current, ...next } : current));
  };

  const patchStep = (index: number, next: Partial<AuthoredStepInput>): void => {
    setSaved(false);
    setScript((current) =>
      current
        ? {
            ...current,
            steps: current.steps.map((step, position) =>
              position === index ? { ...step, ...next } : step,
            ),
          }
        : current,
    );
  };

  async function save(): Promise<void> {
    if (!script) return;

    setSaving(true);
    setErrorCode(null);
    try {
      const view = await missionAuthoringApi.save(productId, script);
      setStored(view);
      setSaved(true);
    } catch (error) {
      setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
    } finally {
      setSaving(false);
    }
  }

  async function submit(): Promise<void> {
    setSaving(true);
    setErrorCode(null);
    try {
      const view = await missionAuthoringApi.submit(productId);
      setStored(view);
    } catch (error) {
      setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !script) {
    return (
      <div className="text-ink-muted flex items-center justify-center gap-2 py-24 text-sm">
        <Spinner />
        {t('common.loading')}
      </div>
    );
  }

  const missingZone = !zones.includes(script.zone);
  const canSubmit = problems.length === 0 && stored !== null && saved;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('missionBuilder.title')}</h1>
          <p className="text-ink-muted mt-1 max-w-xl text-sm leading-relaxed">
            {t('missionBuilder.intro')}
          </p>
        </div>
        {stored ? (
          <Badge tone={stored.status === 'PUBLISHED' ? 'success' : 'neutral'}>
            {t(`moderation.${stored.status}`)}
          </Badge>
        ) : null}
      </header>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {stored?.status === 'REJECTED' && stored.rejectionReason ? (
        <Alert tone="warning">
          {t('missionBuilder.rejected', { reason: stored.rejectionReason })}
        </Alert>
      ) : null}

      {clips.length === 0 ? <Alert tone="info">{t('missionBuilder.noClips')}</Alert> : null}

      <Panel>
        <h2 className="text-ink mb-3 text-sm font-medium">{t('missionBuilder.roomTitle')}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">{t('missionBuilder.zone')}</span>
            <select
              value={script.zone}
              onChange={(event) => patch({ zone: event.target.value })}
              className="bg-panel-raised border-edge rounded-lg border px-2 py-1.5 text-sm outline-none"
            >
              {DEMO_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {t(`zones.${zone}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink-faint">{t('missionBuilder.percentOff')}</span>
            <input
              type="number"
              min={AUTHORED_LIMITS.percentMin}
              max={AUTHORED_LIMITS.percentMax}
              value={script.percentOff}
              onChange={(event) => patch({ percentOff: Number(event.target.value) })}
              className="bg-panel-raised border-edge w-20 rounded-lg border px-2 py-1.5 text-sm outline-none"
            />
          </label>

          {minutes !== null ? (
            <p className="text-ink-faint text-xs">
              {t('missionBuilder.length', { seconds: minutes })}
            </p>
          ) : null}
        </div>

        {/* A room the build has not produced is not an error — `make zones` is
            optional — but a mission set in one would open onto nothing. */}
        {missingZone ? (
          <p className="text-ink-faint mt-3 text-xs">{t('missionBuilder.zoneMissing')}</p>
        ) : null}
      </Panel>

      <Panel>
        <h2 className="text-ink mb-3 text-sm font-medium">{t('missionBuilder.wordsTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('missionBuilder.titleRu')}
            value={script.titleRu}
            onChange={(event) => patch({ titleRu: event.target.value })}
          />
          <Field
            label={t('missionBuilder.titleEn')}
            value={script.titleEn}
            onChange={(event) => patch({ titleEn: event.target.value })}
          />
          <Field
            label={t('missionBuilder.introRu')}
            hint={t('missionBuilder.introHint')}
            value={script.introRu}
            onChange={(event) => patch({ introRu: event.target.value })}
          />
          <Field
            label={t('missionBuilder.introEn')}
            value={script.introEn}
            onChange={(event) => patch({ introEn: event.target.value })}
          />
          <Field
            label={t('missionBuilder.outroRu')}
            hint={t('missionBuilder.outroHint')}
            value={script.outroRu}
            onChange={(event) => patch({ outroRu: event.target.value })}
          />
          <Field
            label={t('missionBuilder.outroEn')}
            value={script.outroEn}
            onChange={(event) => patch({ outroEn: event.target.value })}
          />
        </div>
      </Panel>

      <Panel>
        <h2 className="text-ink mb-3 text-sm font-medium">{t('missionBuilder.stepsTitle')}</h2>
        <ul className="flex flex-col gap-3">
          {script.steps.map((step, index) => (
            <StepRow
              key={index}
              step={step}
              index={index}
              total={script.steps.length}
              clips={clips}
              onChange={(next) => patchStep(index, next)}
              onMove={(direction) => {
                const target = index + direction;
                if (target < 0 || target >= script.steps.length) return;
                const next = [...script.steps];
                const moved = next[index];
                const replaced = next[target];
                if (!moved || !replaced) return;
                next[index] = replaced;
                next[target] = moved;
                patch({ steps: next });
              }}
              onRemove={() =>
                patch({ steps: script.steps.filter((_, position) => position !== index) })
              }
            />
          ))}
        </ul>

        <div className="mt-3">
          <Button
            variant="ghost"
            disabled={script.steps.length >= AUTHORED_LIMITS.stepsMax}
            onClick={() => patch({ steps: [...script.steps, { ...BLANK_STEP }] })}
          >
            {t('missionBuilder.addStep')}
          </Button>
        </div>
      </Panel>

      {problems.length > 0 ? (
        <Alert tone="warning">
          {t('missionBuilder.incomplete', { fields: problems.slice(0, 6).join(', ') })}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button loading={saving} disabled={problems.length > 0} onClick={() => void save()}>
          {saved ? t('missionBuilder.saved') : t('missionBuilder.save')}
        </Button>

        <Button
          variant="ghost"
          loading={saving}
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {t('missionBuilder.submit')}
        </Button>

        <Link
          to={`/supplier/products/${productId}`}
          className="text-ink-muted text-sm hover:underline"
        >
          {t('missionBuilder.backToProduct')}
        </Link>
      </div>

      <p className="text-ink-faint text-xs leading-relaxed">{t('missionBuilder.moderationNote')}</p>
    </div>
  );
}
