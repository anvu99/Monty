import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  value: string | number;
  label: string;
  delta?: string;
  icon?: ReactNode;
  index?: number;
}

export default function StatCard({ value, label, delta, icon, index = 0 }: Props) {
  const isPositive = delta?.startsWith('+') || delta?.startsWith('\u2191');
  const isNeutral = delta === 'Same' || delta?.includes('\u2192') || delta?.includes('steady');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 text-center"
    >
      {icon && <div className="flex justify-center">{icon}</div>}
      <p className="text-2xl font-mono font-bold text-ink mt-1">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mt-1">{label}</p>
      {delta && (
        <p
          className={`text-[10px] font-mono font-semibold mt-1.5 ${
            isNeutral ? 'text-slate-400' : isPositive ? 'text-teal-500' : 'text-coral-500'
          }`}
        >
          {delta}
        </p>
      )}
    </motion.div>
  );
}
