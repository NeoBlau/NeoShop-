import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { UserRole } from '@3dsfera/shared';
import { useSession } from '../stores/session.js';
import { Spinner } from '../ui/Button.js';

function FullPageLoader() {
  const { t } = useTranslation();
  return (
    <div className="text-ink-muted flex items-center justify-center gap-2 py-24 text-sm">
      <Spinner />
      {t('common.loading')}
    </div>
  );
}

/**
 * Route guard. Until the session is resolved it renders a loader rather than
 * redirecting — otherwise a page reload would bounce a signed-in user to the
 * login screen for a moment.
 */
export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const status = useSession((state) => state.status);
  const user = useSession((state) => state.user);
  const location = useLocation();

  if (status !== 'ready') return <FullPageLoader />;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  return <RequireRole roles={['BUYER', 'SUPPLIER', 'ADMIN']}>{children}</RequireRole>;
}
