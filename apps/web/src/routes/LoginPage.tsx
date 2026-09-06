import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '../stores/session.js';
import { Button } from '../ui/Button.js';
import { Field } from '../ui/Field.js';
import { Alert } from '../ui/Alert.js';
import {
  describeFailure,
  landingRouteFor,
  validateLogin,
  validationMessageKey,
  type FieldErrors,
} from '../features/auth/model.js';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const login = useSession((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFailure(null);

    const { errors: formErrors, input } = validateLogin({ email, password });
    setErrors(formErrors);
    if (!input) return;

    setPending(true);
    try {
      await login(input);
      const next = params.get('next');
      const user = useSession.getState().user;
      navigate(next ?? (user ? landingRouteFor(user.role) : '/'), { replace: true });
    } catch (error) {
      const described = describeFailure(error);
      setFailure(described.code);
      setErrors(described.fields);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-xl font-semibold">{t('auth.loginTitle')}</h1>
      <p className="text-ink-muted mt-1 text-sm">{t('auth.loginSubtitle')}</p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 flex flex-col gap-4">
        {failure ? <Alert tone="danger">{t(`errors.${failure}`)}</Alert> : null}

        <Field
          label={t('common.email')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors['email'] ? t(validationMessageKey(errors['email'])) : undefined}
          required
        />
        <Field
          label={t('common.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors['password'] ? t(validationMessageKey(errors['password'])) : undefined}
          required
        />

        <Button type="submit" loading={pending}>
          {t('auth.submitLogin')}
        </Button>
      </form>

      <p className="text-ink-muted mt-6 text-sm">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="text-accent hover:underline">
          {t('common.signUp')}
        </Link>
      </p>
    </div>
  );
}
