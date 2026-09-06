import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '../stores/session.js';
import { Button } from '../ui/Button.js';
import { Field } from '../ui/Field.js';
import { Alert } from '../ui/Alert.js';
import {
  describeFailure,
  emptyRegisterForm,
  landingRouteFor,
  validateRegister,
  validationMessageKey,
  type FieldErrors,
  type RegisterFormValues,
} from '../features/auth/model.js';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useSession((state) => state.register);

  const [values, setValues] = useState<RegisterFormValues>(emptyRegisterForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update<K extends keyof RegisterFormValues>(key: K, value: RegisterFormValues[K]): void {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function fieldError(name: string): string | undefined {
    const code = errors[name];
    return code ? t(validationMessageKey(code)) : undefined;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFailure(null);

    const { errors: formErrors, input } = validateRegister(values);
    setErrors(formErrors);
    if (!input) return;

    setPending(true);
    try {
      await register(input);
      const user = useSession.getState().user;
      navigate(user ? landingRouteFor(user.role) : '/', { replace: true });
    } catch (error) {
      const described = describeFailure(error);
      setFailure(described.code);
      setErrors(described.fields);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-semibold">{t('auth.registerTitle')}</h1>
      <p className="text-ink-muted mt-1 text-sm">{t('auth.registerSubtitle')}</p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 flex flex-col gap-4">
        {failure ? <Alert tone="danger">{t(`errors.${failure}`)}</Alert> : null}

        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">{t('auth.registerTitle')}</legend>
          {(['BUYER', 'SUPPLIER'] as const).map((role) => {
            const selected = values.role === role;
            return (
              <label
                key={role}
                className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                  selected
                    ? 'border-accent bg-panel-raised'
                    : 'border-edge hover:border-edge-strong'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  checked={selected}
                  onChange={() => update('role', role)}
                  className="sr-only"
                />
                <span className="block text-sm font-medium">
                  {role === 'BUYER' ? t('auth.iAmBuyer') : t('auth.iAmSupplier')}
                </span>
                <span className="text-ink-faint mt-1 block text-xs">
                  {role === 'BUYER' ? t('auth.iAmBuyerHint') : t('auth.iAmSupplierHint')}
                </span>
              </label>
            );
          })}
        </fieldset>

        <Field
          label={t('common.email')}
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          error={fieldError('email')}
          required
        />
        <Field
          label={t('common.password')}
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => update('password', event.target.value)}
          error={fieldError('password')}
          hint={t('auth.passwordHint')}
          required
        />

        {values.role === 'SUPPLIER' ? (
          <>
            <Field
              label={t('auth.companyName')}
              value={values.companyName}
              onChange={(event) => update('companyName', event.target.value)}
              error={fieldError('companyName')}
              required
            />
            <Field
              label={`${t('auth.legalName')} (${t('common.optional')})`}
              value={values.legalName}
              onChange={(event) => update('legalName', event.target.value)}
              error={fieldError('legalName')}
            />
            <Field
              label={`${t('auth.taxId')} (${t('common.optional')})`}
              value={values.taxId}
              onChange={(event) => update('taxId', event.target.value)}
              error={fieldError('taxId')}
            />
          </>
        ) : null}

        <Button type="submit" loading={pending}>
          {t('auth.submitRegister')}
        </Button>
      </form>

      <p className="text-ink-muted mt-6 text-sm">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="text-accent hover:underline">
          {t('common.signIn')}
        </Link>
      </p>
    </div>
  );
}
