import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '../stores/session.js';
import { LanguageSwitch } from './LanguageSwitch.js';
import { landingRouteFor } from '../features/auth/model.js';

function navClass({ isActive }: { isActive: boolean }): string {
  return `whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors ${
    isActive ? 'text-ink bg-panel-raised' : 'text-ink-muted hover:text-ink'
  }`;
}

export function AppShell() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const logout = useSession((state) => state.logout);
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate('/');
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-edge bg-void/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex shrink-0 items-baseline gap-2">
            <span className="text-ink text-base font-semibold tracking-wide">
              {t('common.appName')}
            </span>
            <span className="text-ink-faint hidden text-xs sm:inline">{t('common.tagline')}</span>
          </Link>

          <nav className="-mx-1 flex flex-1 items-center gap-0.5 overflow-x-auto px-1">
            <NavLink to="/" end className={navClass}>
              {t('nav.world')}
            </NavLink>
            <NavLink to="/catalog" className={navClass}>
              {t('nav.catalog')}
            </NavLink>
            <NavLink to="/cart" className={navClass}>
              {t('nav.cart')}
            </NavLink>
            {user?.role === 'SUPPLIER' ? (
              <NavLink to="/supplier" className={navClass}>
                {t('nav.supplier')}
              </NavLink>
            ) : null}
            {user?.role === 'ADMIN' ? (
              <NavLink to="/admin" className={navClass}>
                {t('nav.admin')}
              </NavLink>
            ) : null}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitch />
            {user ? (
              <>
                <Link
                  to={landingRouteFor(user.role)}
                  className="text-ink-muted hover:text-ink hidden max-w-[14ch] truncate text-sm md:inline"
                  title={user.email}
                >
                  {user.email}
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="text-ink-faint hover:text-ink text-sm"
                >
                  {t('common.signOut')}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-ink-muted hover:text-ink text-sm">
                  {t('common.signIn')}
                </Link>
                <Link
                  to="/register"
                  className="bg-accent text-accent-ink hover:bg-accent-hover rounded-lg px-3 py-1.5 text-sm font-medium"
                >
                  {t('common.signUp')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-edge text-ink-faint border-t px-4 py-5 text-xs">
        <div className="mx-auto max-w-6xl">
          {t('common.appName')} — {t('common.tagline')}
        </div>
      </footer>
    </div>
  );
}
