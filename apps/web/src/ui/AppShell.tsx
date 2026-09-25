import { useMemo } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '../stores/session.js';
import { useCart } from '../stores/cart.js';
import { LanguageSwitch } from './LanguageSwitch.js';
import { landingRouteFor } from '../features/auth/model.js';

/**
 * The frame every page sits in.
 *
 * Two navigations rather than one, because the same row cannot serve both: on
 * a desktop the links belong in the header beside the wordmark, and on a phone
 * a horizontally scrolling strip of them is a row nobody can see the end of.
 * Below the small breakpoint the primary destinations move to a bar along the
 * bottom — where a thumb is — and the header keeps only identity and account.
 *
 * The bar is fixed, so every page needs bottom padding to clear it. That is
 * `pb-24 sm:pb-8` on the main element rather than a magic number in each page.
 */

interface Destination {
  to: string;
  label: string;
  /** SVG path for the bottom bar. Line icons, one weight, no fills. */
  icon: string;
  end?: boolean;
  badge?: number;
}

function DesktopLink({ destination }: { destination: Destination }) {
  return (
    <NavLink
      to={destination.to}
      end={destination.end ?? false}
      className={({ isActive }) =>
        `relative rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors duration-150 ${
          isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {destination.label}
          {destination.badge ? (
            <span className="bg-accent text-accent-ink ml-1.5 rounded px-1.5 py-0.5 text-[11px] tabular-nums">
              {destination.badge}
            </span>
          ) : null}
          {/* The current page is marked by a rule under it rather than a filled
              pill: one line is quieter and survives a long label. */}
          {isActive ? (
            <span className="bg-accent absolute inset-x-2.5 -bottom-0.5 h-px" aria-hidden="true" />
          ) : null}
        </>
      )}
    </NavLink>
  );
}

function BottomLink({ destination }: { destination: Destination }) {
  return (
    <NavLink
      to={destination.to}
      end={destination.end ?? false}
      className={({ isActive }) =>
        `relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors duration-150 ${
          isActive ? 'text-ink' : 'text-ink-faint'
        }`
      }
    >
      <span className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d={destination.icon} />
        </svg>
        {destination.badge ? (
          <span className="bg-accent text-accent-ink absolute -top-1.5 -right-2.5 rounded px-1 text-[10px] tabular-nums">
            {destination.badge}
          </span>
        ) : null}
      </span>
      {destination.label}
    </NavLink>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const logout = useSession((state) => state.logout);
  const cartLines = useCart((state) => state.lines);
  const cartCount = cartLines.reduce((total, line) => total + line.quantity, 0);
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate('/');
  }

  /**
   * Where a visitor can go.
   *
   * The exhibition is offered only to members: the route needs a session, and
   * a link that bounces somebody to the sign-in reads as a fault rather than
   * as a door.
   */
  const primary = useMemo<Destination[]>(() => {
    const list: Destination[] = [];

    if (user) {
      list.push({
        to: '/',
        end: true,
        label: t('nav.world'),
        icon: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
      });
    }

    list.push(
      { to: '/catalog', label: t('nav.catalog'), icon: 'M4 6h16M4 12h16M4 18h10' },
      {
        to: '/food',
        label: t('nav.food'),
        icon: 'M4 11h16a8 8 0 0 1-8 8 8 8 0 0 1-8-8ZM6 8c0-1.7 2.7-3 6-3s6 1.3 6 3',
      },
      {
        to: '/guide',
        label: t('nav.guide'),
        icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4v-.5m0-3V12a2.5 2.5 0 1 0-2.5-2.5',
      },
      {
        to: '/cart',
        label: t('nav.cart'),
        icon: 'M4 5h2l2.2 10.4A2 2 0 0 0 10.2 17h7.4a2 2 0 0 0 2-1.6L21 8H7M10 21h.01M17 21h.01',
        ...(cartCount > 0 ? { badge: cartCount } : {}),
      },
    );

    return list;
  }, [user, cartCount, t]);

  /** The cabinets. Header only: a supplier is not browsing on a phone. */
  const cabinets = useMemo<Destination[]>(() => {
    const list: Destination[] = [];
    if (user) list.push({ to: '/orders', label: t('nav.orders'), icon: '' });
    if (user?.role === 'SUPPLIER')
      list.push({ to: '/supplier', label: t('nav.supplier'), icon: '' });
    if (user?.role === 'ADMIN') list.push({ to: '/admin', label: t('nav.admin'), icon: '' });
    return list;
  }, [user, t]);

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <header className="border-hairline bg-void/80 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3.5">
          <Link to="/" className="flex shrink-0 items-baseline gap-2.5">
            {/* The wordmark is the one place the display face is allowed to be
                loud. Wide tracking, because six capitals set tight read as an
                acronym rather than a name. */}
            <span className="font-display text-ink text-[1.0625rem] leading-none tracking-[0.18em]">
              {t('common.appName')}
            </span>
            <span className="text-ink-faint hidden text-[0.6875rem] tracking-wide lg:inline">
              {t('common.tagline')}
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 sm:flex" aria-label={t('nav.primary')}>
            {primary.map((destination) => (
              <DesktopLink key={destination.to} destination={destination} />
            ))}
            {cabinets.length > 0 ? (
              <span className="bg-hairline mx-1.5 h-4 w-px" aria-hidden="true" />
            ) : null}
            {cabinets.map((destination) => (
              <DesktopLink key={destination.to} destination={destination} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2.5 sm:ml-0">
            <LanguageSwitch />
            {user ? (
              <>
                <Link
                  to={landingRouteFor(user.role)}
                  className="text-ink-muted hover:text-ink hidden max-w-[16ch] truncate text-sm md:inline"
                  title={user.email}
                >
                  {user.email}
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="text-ink-faint hover:text-ink text-sm transition-colors duration-150"
                >
                  {t('common.signOut')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-ink-muted hover:text-ink text-sm transition-colors duration-150"
                >
                  {t('common.signIn')}
                </Link>
                <Link
                  to="/register"
                  className="bg-accent text-accent-ink hover:bg-accent-hover rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150"
                >
                  {t('common.signUp')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-24 sm:pb-10">
        <Outlet />
      </main>

      <footer className="border-hairline text-ink-faint hidden border-t px-4 py-6 text-xs sm:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <span className="font-display tracking-[0.14em]">{t('common.appName')}</span>
          <span>{t('common.tagline')}</span>
        </div>
      </footer>

      {/* The phone's navigation. Fixed, thumb-height, and padded for the home
          indicator on a notched screen. */}
      <nav
        aria-label={t('nav.primary')}
        className="border-hairline bg-void/90 fixed inset-x-0 bottom-0 z-20 flex border-t px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        {primary.map((destination) => (
          <BottomLink key={destination.to} destination={destination} />
        ))}
      </nav>
    </div>
  );
}
