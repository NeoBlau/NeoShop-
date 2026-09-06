import type { ReactNode } from 'react';

type Tone = 'danger' | 'warning' | 'info' | 'success';

const tones: Record<Tone, string> = {
  danger: 'border-danger/40 bg-danger/10 text-danger',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  info: 'border-edge-strong bg-panel-raised text-ink-muted',
  success: 'border-success/40 bg-success/10 text-success',
};

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`rounded-lg border px-3.5 py-3 text-sm ${tones[tone]}`}
    >
      {children}
    </div>
  );
}
