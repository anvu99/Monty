import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import clsx from 'clsx';

export function StepShell({
  title,
  subtitle,
  children,
  footer,
  accent = 'teal'
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  accent?: 'teal' | 'coral' | 'lilac';
}) {
  const accentMap = {
    teal: 'from-teal-700/20 via-transparent to-transparent',
    coral: 'from-coral-500/20 via-transparent to-transparent',
    lilac: 'from-lilac-500/20 via-transparent to-transparent'
  };

  return (
    <motion.section
      key={title}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-3 sm:gap-8 sm:px-6 sm:py-10"
    >
      <div
        className={clsx(
          'absolute -right-12 top-6 h-32 w-32 rounded-full bg-gradient-to-br blur-3xl sm:-right-16 sm:top-10 sm:h-44 sm:w-44',
          accentMap[accent]
        )}
      />
      <header className="relative z-10 flex flex-col gap-1 sm:gap-3">
        <p className="hidden text-xs uppercase tracking-[0.4em] text-teal-700/70 sm:block">Parent onboarding</p>
        <h1 className="font-display text-xl font-semibold text-ink sm:text-3xl md:text-4xl">{title}</h1>
        {subtitle ? <p className="max-w-2xl text-xs text-slate-600 sm:text-base sm:text-slate-700">{subtitle}</p> : null}
      </header>
      <div className="relative z-10">{children}</div>
      {footer ? <div className="relative z-10">{footer}</div> : null}
    </motion.section>
  );
}
