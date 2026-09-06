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

      <Link to="/supplier/products" className="text-accent text-sm hover:underline">
        {t('wizard.backToList')}
      </Link>
    </div>
  );
}
