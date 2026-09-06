import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CURRENCIES, PRODUCT_CATEGORIES, type ProductDetail } from '@3dsfera/shared';
import { ApiError } from '../../../api/client.js';
import { productsApi } from '../../../features/products/api.js';
import { centsToInput, inputToCents } from '../../../features/products/wizard.js';
import { validationMessageKey } from '../../../features/auth/model.js';
import { Alert } from '../../../ui/Alert.js';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Select, Textarea } from '../../../ui/Form.js';

interface CardForm {
  title: string;
  description: string;
  category: ProductDetail['category'];
  price: string;
  currency: ProductDetail['currency'];
  stock: string;
  weightGrams: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
}

function toForm(product: ProductDetail): CardForm {
  return {
    title: product.title,
    description: product.description,
    category: product.category,
    price: centsToInput(product.priceCents),
    currency: product.currency,
    stock: product.stock > 0 ? String(product.stock) : '',
    weightGrams: product.weightGrams > 0 ? String(product.weightGrams) : '',
    lengthMm: product.lengthMm > 0 ? String(product.lengthMm) : '',
    widthMm: product.widthMm > 0 ? String(product.widthMm) : '',
    heightMm: product.heightMm > 0 ? String(product.heightMm) : '',
  };
}

const integer = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Step 5. Everything the buyer reads, plus what the courier needs to know. */
export function CardStep({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CardForm>(() => toForm(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(toForm(product));
  }, [product]);

  function update<K extends keyof CardForm>(key: K, value: CardForm[K]): void {
    setSaved(false);
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function fieldError(name: string): string | undefined {
    const code = errors[name];
    return code ? t(validationMessageKey(code)) : undefined;
  }

  async function save(): Promise<void> {
    setSaving(true);
    setErrorCode(null);
    setErrors({});

    try {
      await productsApi.update(product.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        priceCents: inputToCents(form.price),
        currency: form.currency,
        stock: integer(form.stock),
        weightGrams: integer(form.weightGrams),
        lengthMm: integer(form.lengthMm),
        widthMm: integer(form.widthMm),
        heightMm: integer(form.heightMm),
      });
      setSaved(true);
      onSaved();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorCode(error.code);
        setErrors(error.fieldErrors());
      } else {
        setErrorCode('ERR_INTERNAL');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted text-sm">{t('wizard.cardHint')}</p>

      {product.status === 'PUBLISHED' ? (
        <Alert tone="warning">{t('wizard.republishNotice')}</Alert>
      ) : null}

      {errorCode ? <Alert tone="danger">{t(`errors.${errorCode}`)}</Alert> : null}

      <Field
        label={t('wizard.fieldTitle')}
        value={form.title}
        onChange={(event) => update('title', event.target.value)}
        error={fieldError('title')}
      />

      <Textarea
        label={t('wizard.fieldDescription')}
        value={form.description}
        onChange={(event) => update('description', event.target.value)}
        error={fieldError('description')}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          label={t('wizard.fieldCategory')}
          value={form.category}
          onChange={(event) => update('category', event.target.value as ProductDetail['category'])}
          error={fieldError('category')}
        >
          {PRODUCT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {t(`category.${value}`)}
            </option>
          ))}
        </Select>

        <Field
          label={t('wizard.fieldPrice')}
          inputMode="decimal"
          value={form.price}
          onChange={(event) => update('price', event.target.value)}
          error={fieldError('priceCents')}
        />

        <Select
          label={t('wizard.fieldCurrency')}
          value={form.currency}
          onChange={(event) => update('currency', event.target.value as ProductDetail['currency'])}
        >
          {CURRENCIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field
          label={t('wizard.fieldStock')}
          inputMode="numeric"
          value={form.stock}
          onChange={(event) => update('stock', event.target.value)}
          error={fieldError('stock')}
        />
        <Field
          label={t('wizard.fieldWeight')}
          inputMode="numeric"
          value={form.weightGrams}
          onChange={(event) => update('weightGrams', event.target.value)}
          error={fieldError('weightGrams')}
        />
        <Field
          label={t('wizard.fieldLength')}
          inputMode="numeric"
          value={form.lengthMm}
          onChange={(event) => update('lengthMm', event.target.value)}
          error={fieldError('lengthMm')}
        />
        <Field
          label={t('wizard.fieldWidth')}
          inputMode="numeric"
          value={form.widthMm}
          onChange={(event) => update('widthMm', event.target.value)}
          error={fieldError('widthMm')}
        />
        <Field
          label={t('wizard.fieldHeight')}
          inputMode="numeric"
          value={form.heightMm}
          onChange={(event) => update('heightMm', event.target.value)}
          error={fieldError('heightMm')}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button loading={saving} onClick={() => void save()}>
          {t('common.save')}
        </Button>
        {saved ? <span className="text-success text-xs">{t('wizard.saved')}</span> : null}
      </div>
    </div>
  );
}
