import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

const controlClass =
  'bg-panel-raised border-edge focus:border-accent/60 placeholder:text-ink-faint rounded-lg ' +
  'border px-3 py-2.5 text-sm outline-none transition-colors';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}

export function Select({ label, error, className = '', children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink-muted text-sm">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${controlClass} ${error ? 'border-danger/70' : ''} ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );
}

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string | undefined;
  hint?: string;
}

export function Textarea({ label, error, hint, className = '', ...rest }: TextareaProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink-muted text-sm">
        {label}
      </label>
      <textarea
        id={id}
        rows={5}
        aria-invalid={error ? true : undefined}
        className={`${controlClass} resize-y ${error ? 'border-danger/70' : ''} ${className}`}
        {...rest}
      />
      {error ? (
        <p className="text-danger text-xs">{error}</p>
      ) : hint ? (
        <p className="text-ink-faint text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'border-edge-strong text-ink-faint',
  accent: 'border-accent/50 text-accent',
  success: 'border-success/50 text-success',
  warning: 'border-warning/50 text-warning',
  danger: 'border-danger/50 text-danger',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[11px] whitespace-nowrap ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Horizontal progress through the wizard. Collapses to a counter on mobile. */
export function Steps({
  steps,
  current,
  onSelect,
}: {
  steps: { id: string; label: string; reachable: boolean }[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
      {steps.map((step, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <li key={step.id} className="flex items-center gap-1">
            <button
              type="button"
              disabled={!step.reachable}
              onClick={() => onSelect(index)}
              aria-current={active ? 'step' : undefined}
              className={`rounded-md px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? 'bg-panel-raised text-ink'
                  : done
                    ? 'text-ink-muted hover:text-ink'
                    : 'text-ink-faint hover:text-ink-muted'
              }`}
            >
              {/* Decorative: without aria-hidden the accessible name becomes
                  "4Оживление", because the number sits directly against the
                  label with no whitespace between them. */}
              <span aria-hidden="true" className="text-ink-faint mr-1.5 tabular-nums">
                {index + 1}
              </span>
              {step.label}
            </button>
            {index < steps.length - 1 ? <span className="text-ink-faint">·</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
