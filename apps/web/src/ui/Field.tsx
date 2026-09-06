import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Dictionary key of the validation issue, already resolved to a message. */
  error?: string | undefined;
  hint?: ReactNode;
}

export function Field({ label, error, hint, className = '', ...rest }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink-muted text-sm">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`bg-panel-raised border-edge focus:border-accent/60 placeholder:text-ink-faint rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors ${
          error ? 'border-danger/70' : ''
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="text-danger text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-ink-faint text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
