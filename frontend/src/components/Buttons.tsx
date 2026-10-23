import clsx from 'clsx';
import type { ReactNode } from 'react';

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button'
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex flex-1 items-center justify-center rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] transition sm:flex-none sm:px-6 sm:py-3 sm:text-sm',
        disabled
          ? 'cursor-not-allowed bg-slate-200 text-slate-400'
          : 'bg-ink text-mist shadow-lift hover:-translate-y-0.5 hover:shadow-card'
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = 'button'
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-ink/40"
    >
      {children}
    </button>
  );
}
