import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export function CardOption({
  title,
  description,
  icon,
  active,
  onClick
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={clsx(
        'flex w-full flex-col gap-3 rounded-2xl border px-5 py-4 text-left shadow-card transition',
        active
          ? 'border-ink bg-ink text-mist'
          : 'border-slate-200 bg-white text-ink hover:border-slate-300'
      )}
    >
      <div className="flex items-center gap-3">
        {icon ? <div className="h-10 w-10">{icon}</div> : null}
        <div>
          <p className="text-base font-semibold">{title}</p>
          {description ? <p className={clsx('text-sm', active ? 'text-mist/80' : 'text-slate-600')}>{description}</p> : null}
        </div>
      </div>
    </motion.button>
  );
}
