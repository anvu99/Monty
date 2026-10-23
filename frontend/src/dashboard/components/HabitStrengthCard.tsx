import { motion } from 'framer-motion';
import { Flame, Shield, Target, CheckCircle } from 'lucide-react';
import type { HabitScore } from '../mockData';

interface Props {
  data: HabitScore;
  title?: string;
  showComponents?: boolean;
}

export default function HabitStrengthCard({ data, title = 'Financial Habit Strength', showComponents = true }: Props) {
  const { score, label, trend, components } = data;

  const getColor = (s: number) => (s >= 70 ? '#11A39A' : s >= 40 ? '#f59e0b' : '#ef4444');
  const color = getColor(score);
  const circumference = 2 * Math.PI * 54;
  const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-6 text-center">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-4">{title}</p>

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative w-36 h-36 mx-auto mb-3"
      >
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-mono font-bold"
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
        </div>
      </motion.div>

      <p className="text-slate-600 text-sm font-medium">{label}</p>
      {trend && <p className="text-xs text-slate-400 mt-0.5">{trend}</p>}

      {showComponents && components && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
            <span>Streak: <span className="font-mono font-medium text-ink">{components.savings_streak_days}d</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
            <span>Resist: <span className="font-mono font-medium text-ink">{(components.impulse_resistance_rate * 100).toFixed(0)}%</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
            <span>Velocity: <span className="font-mono font-medium text-ink">{(components.goal_progress_velocity * 100).toFixed(0)}%</span></span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
            <span>Plans: <span className="font-mono font-medium text-ink">{components.implementation_intentions_completed}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
