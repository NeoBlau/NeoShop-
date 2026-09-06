import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProductDetail } from '@3dsfera/shared';
import { ApiError } from '../../api/client.js';
import { productsApi } from '../../features/products/api.js';
import {
  WIZARD_STEPS,
  evaluateStep,
  stepIndex,
  type WizardStep,
} from '../../features/products/wizard.js';
import { Alert } from '../../ui/Alert.js';
import { Button, Spinner } from '../../ui/Button.js';
import { Field } from '../../ui/Field.js';
import { Steps } from '../../ui/Form.js';
import { Panel } from '../../ui/Panel.js';
import { ModelStep } from './steps/ModelStep.js';
import { ProcessingStep } from './steps/ProcessingStep.js';
import { PreviewStep } from './steps/PreviewStep.js';
import { InteractionsStep } from './steps/InteractionsStep.js';
import { CardStep } from './steps/CardStep.js';
import { SubmitStep } from './steps/SubmitStep.js';

/** Creating a draft needs one field; everything else happens in the wizard. */
function NewProductForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setErrorCode(null);

    try {
      const { id } = await productsApi.create({ title: title.trim() });
      navigate(`/supplier/products/${id}`, { replace: true });
    } catch (error) {
      setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-semibold">{t('wizard.newTitle')}</h1>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 flex flex-col gap-4">
        {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

        <Field
          label={t('wizard.namePrompt')}
          hint={t('wizard.namePromptHint')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={3}
        />

        <Button type="submit" loading={pending}>
          {t('wizard.createDraft')}
        </Button>
      </form>

      <Link
        to="/supplier/products"
        className="text-ink-muted mt-6 inline-block text-sm hover:underline"
      >
        {t('wizard.backToList')}
      </Link>
    </div>
  );
}

export function ProductWizardPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [step, setStep] = useState<WizardStep>('model');
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const detail = await productsApi.detail(id);
      setProduct(detail);
      setErrorCode(null);
    } catch (error) {
      setErrorCode(error instanceof ApiError ? error.code : 'ERR_INTERNAL');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Land on the first step that still needs attention, so re-opening a product
  // does not start over from the upload every time.
  const [positioned, setPositioned] = useState(false);
  useEffect(() => {
    if (!product || positioned) return;
    const firstUnfinished =
      WIZARD_STEPS.find((candidate) => !evaluateStep(candidate, product).canAdvance) ?? 'submit';
    setStep(
      firstUnfinished === 'processing' && product.job?.status === 'READY'
        ? 'preview'
        : firstUnfinished,
    );
    setPositioned(true);
  }, [product, positioned]);

  // While the pipeline runs, poll. Nothing else in the app polls; this is the
  // one place where the answer genuinely changes without user action.
  useEffect(() => {
    const status = product?.job?.status;
    if (status !== 'PENDING' && status !== 'RUNNING') return;

    const timer = setInterval(() => void reload(), 1500);
    return () => clearInterval(timer);
  }, [product?.job?.status, reload]);

  if (!id) return <NewProductForm />;

  if (loading) {
    return (
      <div className="text-ink-muted flex items-center gap-2 py-20 text-sm">
        <Spinner />
        {t('common.loading')}
      </div>
    );
  }

  if (!product) {
    return <Alert tone="danger">{t(`errors.${errorCode ?? 'ERR_NOT_FOUND'}`)}</Alert>;
  }

  const current = stepIndex(step);
  const availability = evaluateStep(step, product);

  const steps = WIZARD_STEPS.map((candidate, index) => ({
    id: candidate,
    label: t(`wizard.step_${candidate}`),
    // A later step is reachable only once everything before it is settled.
    reachable: WIZARD_STEPS.slice(0, index).every(
      (previous) => evaluateStep(previous, product).canAdvance,
    ),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {t('wizard.editTitle', { title: product.title })}
          </h1>
          <p className="text-ink-faint mt-1 text-sm">
            {t('wizard.stepOf', { current: current + 1, total: WIZARD_STEPS.length })}
          </p>
        </div>
        <Link to="/supplier/products" className="text-ink-muted text-sm hover:underline">
          {t('wizard.backToList')}
        </Link>
      </div>

      <Steps
        steps={steps}
        current={current}
        onSelect={(index) => {
          const target = WIZARD_STEPS[index];
          if (target) setStep(target);
        }}
      />

      <Panel>
        {step === 'model' ? <ModelStep product={product} onUploaded={() => void reload()} /> : null}
        {step === 'processing' ? <ProcessingStep product={product} /> : null}
        {step === 'preview' ? (
          <PreviewStep product={product} onSaved={() => void reload()} />
        ) : null}
        {step === 'interactions' ? (
          <InteractionsStep product={product} onSaved={() => void reload()} />
        ) : null}
        {step === 'card' ? <CardStep product={product} onSaved={() => void reload()} /> : null}
        {step === 'submit' ? (
          <SubmitStep product={product} onSubmitted={() => void reload()} />
        ) : null}
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          disabled={current === 0}
          onClick={() => {
            const previous = WIZARD_STEPS[current - 1];
            if (previous) setStep(previous);
          }}
        >
          {t('common.back')}
        </Button>

        <div className="flex items-center gap-3">
          {!availability.canAdvance && availability.blockedBy ? (
            <span className="text-ink-faint text-xs">{t(availability.blockedBy)}</span>
          ) : null}
          <Button
            disabled={!availability.canAdvance || current === WIZARD_STEPS.length - 1}
            onClick={() => {
              const next = WIZARD_STEPS[current + 1];
              if (next) setStep(next);
            }}
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
