import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The frame the sign-in and sign-up forms sit in.
 *
 * The exhibition itself is behind the session, so this page is the front door
 * and for most visitors the first thing they see. A form floating in the
 * middle of a dark field says nothing about what is behind it, so the left
 * column says it: what the place is, in one sentence, and three facts that
 * are true rather than promotional.
 *
 * The form comes first in the source and first on a phone. Somebody who
 * already has an account did not come here to read.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  const facts = [
    { term: t('auth.factWorkTerm'), detail: t('auth.factWorkDetail') },
    { term: t('auth.factShipTerm'), detail: t('auth.factShipDetail') },
    { term: t('auth.factOpenTerm'), detail: t('auth.factOpenDetail') },
  ];

  return (
    <div className="mx-auto grid w-full max-w-5xl items-start gap-10 py-4 lg:grid-cols-[1fr_24rem] lg:gap-16 lg:py-10">
      {/* Second in the layout on a wide screen, first in the source: the form
          is what a returning visitor wants, and nobody should have to scroll
          past a manifesto to reach it on a phone. */}
      <section className="panel order-1 p-6 sm:p-7 lg:order-2">
        <h1 className="text-[1.5rem] leading-tight">{title}</h1>
        <p className="text-ink-muted mt-1.5 text-sm">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </section>

      <section className="order-2 lg:order-1">
        <p className="eyebrow">{t('auth.eyebrow')}</p>
        <h2 className="text-ink mt-3 text-[1.875rem] leading-[1.15] sm:text-[2.5rem]">
          {t('auth.promise')}
        </h2>
        <p className="text-ink-muted mt-4 max-w-md text-sm leading-relaxed sm:text-[0.9375rem]">
          {t('auth.promiseDetail')}
        </p>

        <dl className="mt-8 flex flex-col">
          {facts.map((fact) => (
            <div key={fact.term} className="hairline flex flex-col gap-1 py-4 first:border-t-0">
              <dt className="text-ink text-sm">{fact.term}</dt>
              <dd className="text-ink-faint max-w-md text-[0.8125rem] leading-relaxed">
                {fact.detail}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
