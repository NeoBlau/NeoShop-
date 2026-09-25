import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProductDetail } from '@3dsfera/shared';
import { ApiError } from '../../../api/client.js';
import { productsApi } from '../../../features/products/api.js';
import { Alert } from '../../../ui/Alert.js';
import { Button } from '../../../ui/Button.js';
import { Badge } from '../../../ui/Form.js';

/** Step 6. Draft goes to the moderation queue; the status is the receipt. */
export function SubmitStep({
  product,
  onSubmitted,
}: {
  product: ProductDetail;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  async function submit(): Promise<void> {
    setSending(true);
    setErrorCode(null);
    setIssues([]);

    try {
      await productsApi.submit(product.id);
      onSubmitted();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorCode(error.code);
        setIssues((error.issues ?? []).map((issue) => issue.path));
      } else {
        setErrorCode('ERR_INTERNAL');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-ink-muted text-sm">{t('supplier.statusLabel')}:</span>
        <Badge
          tone={
            product.status === 'PUBLISHED'
              ? 'success'
              : product.status === 'PENDING'
                ? 'warning'
                : product.status === 'REJECTED'
                  ? 'danger'
                  : 'neutral'
          }
        >
          {t(`moderation.${product.status}`)}
        </Badge>
      </div>

      {product.status === 'REJECTED' && product.rejectionReason ? (
        <Alert tone="danger">{t('wizard.rejected', { reason: product.rejectionReason })}</Alert>
      ) : null}

      {product.status === 'PENDING' ? (
        <Alert tone="success">{t('wizard.submitted')}</Alert>
      ) : (
        <>
          <p className="text-ink-muted text-sm">{t('wizard.submitHint')}</p>
          {errorCode ? (
            <Alert tone="danger">
              {t(`errors.${errorCode}`)}
              {issues.length > 0 ? ` — ${issues.join(', ')}` : ''}
            </Alert>
          ) : null}
          <div>
            <Button loading={sending} onClick={() => void submit()}>
              {t('wizard.submitButton')}
            </Button>
          </div>
        </>
      )}

      {/* The optional extra: a mission of their own. Offered here rather than
          made a wizard step, because a product sells perfectly well without
          one and a required step would say otherwise. */}
      <div className="border-edge flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div>
          <p className="text-ink text-sm">{t('wizard.missionOffer')}</p>
          <p className="text-ink-faint mt-1 max-w-md text-xs leading-relaxed">
            {t('wizard.missionOfferHint')}
          </p>
        </div>
        <Link
          to={`/supplier/products/${product.id}/mission`}
          className="border-edge-strong text-ink-muted hover:text-ink shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-colors"
        >
          {t('wizard.missionOfferAction')}
        </Link>
      </div>

      <Link to="/supplier/products" className="text-accent text-sm hover:underline">
        {t('wizard.backToList')}
      </Link>
    </div>
  );
}
