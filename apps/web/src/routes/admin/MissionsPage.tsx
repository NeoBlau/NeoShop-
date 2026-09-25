import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authoredToMission, missionSeconds } from '@3dsfera/shared';
import { adminApi, type PendingMissionView } from '../../features/admin/api.js';
import { ApiError } from '../../api/client.js';
import { formatDateTime } from '../../lib/format.js';
import { Alert } from '../../ui/Alert.js';
import { Button, Spinner } from '../../ui/Button.js';
import { Badge, Textarea } from '../../ui/Form.js';
import { Panel } from '../../ui/Panel.js';

/**
 * Missions waiting on a decision.
 *
 * The script is shown in full — every step, in order, with what the buyer is
 * asked to do and what they are told afterwards — because that is the whole of
 * what is being judged. Two things a moderator is really looking for: whether
 * the closing line claims something the product does not do, and whether the
 * discount is proportionate to the work. Both need the words, so the words are
 * here rather than behind a link.
 */
function MissionCard({
  mission,
  onDecided,
}: {
  mission: PendingMissionView;
  onDecided: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const script = mission.script;
  const seconds = Math.round(
    missionSeconds(authoredToMission(mission.id, mission.productSlug, script)),
  );

  async function decide(approve: boolean): Promise<void> {
    setPending(true);
    setErrorCode(null);
    try {
      if (approve) await adminApi.approveMission(mission.id);
      else await adminApi.rejectMission(mission.id, reason.trim());
      onDecided();
    } catch (cause) {
      setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-ink text-base font-medium">{script.titleRu}</h2>
          <p className="text-ink-faint mt-1 text-xs">
            {t('adminMissions.forProduct', {
              product: mission.productTitle,
              supplier: mission.supplierName,
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone="accent">{t('adminMissions.percent', { percent: script.percentOff })}</Badge>
          <span className="text-ink-faint text-[11px]">
            {t('adminMissions.inRoom', { room: t(`zones.${script.zone}`) })}
          </span>
        </div>
      </div>

      <div className="text-ink-muted flex flex-col gap-1.5 text-sm leading-relaxed">
        <p>{script.introRu}</p>
        <p className="text-ink-faint text-xs italic">{script.outroRu}</p>
      </div>

      <ol className="flex flex-col gap-2">
        {script.steps.map((step, index) => (
          <li key={index} className="border-edge rounded-lg border px-3 py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-ink text-sm">
                {index + 1}. {step.promptRu}
              </span>
              <span className="text-ink-faint text-[11px]">
                {t(`missionBuilder.kind_${step.kind}`)}
                {step.kind === 'play' && step.clipName ? ` · ${step.clipName}` : ''}
                {step.kind === 'approach' && step.metres !== undefined ? ` · ${step.metres} м` : ''}
                {step.kind !== 'approach' && step.seconds !== undefined
                  ? ` · ${step.seconds} с`
                  : ''}
              </span>
            </div>
            <p className="text-ink-faint mt-1 text-xs leading-relaxed">{step.doneRu}</p>
          </li>
        ))}
      </ol>

      <p className="text-ink-faint text-xs">
        {t('adminMissions.length', { seconds })}
        {mission.submittedAt
          ? ` · ${t('adminMissions.submitted', {
              when: formatDateTime(mission.submittedAt, i18n.language),
            })}`
          : ''}
      </p>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      <div className="flex flex-col gap-2">
        <Textarea
          label={t('adminMissions.reason')}
          hint={t('adminMissions.reasonHint')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button loading={pending} onClick={() => void decide(true)}>
            {t('adminMissions.approve')}
          </Button>
          <Button
            variant="ghost"
            loading={pending}
            disabled={reason.trim().length < 5}
            onClick={() => void decide(false)}
          >
            {t('adminMissions.reject')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

export function MissionsPage() {
  const { t } = useTranslation();
  const [missions, setMissions] = useState<PendingMissionView[] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorCode(null);
    setMissions(null);
    try {
      const response = await adminApi.pendingMissions();
      setMissions(response.missions);
    } catch (cause) {
      setErrorCode(cause instanceof ApiError ? cause.code : 'ERR_INTERNAL');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t('adminMissions.title')}</h1>
          <p className="text-ink-muted mt-1 max-w-2xl text-sm leading-relaxed">
            {t('adminMissions.hint')}
          </p>
        </div>
        <Link to="/admin" className="text-ink-faint hover:text-ink text-sm">
          {t('admin.back')}
        </Link>
      </div>

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      {missions === null ? (
        <div className="text-ink-muted flex items-center gap-2 text-sm">
          <Spinner />
          {t('common.loading')}
        </div>
      ) : missions.length === 0 ? (
        <Alert tone="info">{t('adminMissions.empty')}</Alert>
      ) : (
        <div className="flex flex-col gap-4">
          {missions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} onDecided={() => void load()} />
          ))}
        </div>
      )}
    </div>
  );
}
