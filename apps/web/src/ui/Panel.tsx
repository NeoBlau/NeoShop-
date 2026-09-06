import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel p-5 ${className}`}>{children}</section>;
}

/**
 * Card for a section that is not built yet. Being explicit about what is
 * missing beats an empty page that looks broken.
 */
export function SectionCard({
  title,
  hint,
  to,
  badge,
}: {
  title: string;
  hint: string;
  to?: string;
  badge?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-ink text-base font-medium">{title}</h3>
        {badge ? (
          <span className="border-edge-strong text-ink-faint rounded border px-1.5 py-0.5 text-[11px] whitespace-nowrap">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="text-ink-muted mt-1.5 text-sm">{hint}</p>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="panel hover:border-edge-strong block p-5 transition-colors">
        {content}
      </Link>
    );
  }
  return <div className="panel p-5 opacity-70">{content}</div>;
}
