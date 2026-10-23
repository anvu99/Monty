import { motion } from 'framer-motion';
import type { Goal } from '../mockData';

interface Props {
  goal: Goal;
  showChild?: boolean;
  compact?: boolean;
}

export default function SavingsGoalCard({ goal, showChild = false, compact = false }: Props) {
  const pct = goal.currentAmount && goal.targetAmount
    ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
    : 0;
  const remaining = goal.targetAmount - goal.currentAmount;
  const weeksLeft =
    goal.weeklyContribution > 0 ? Math.ceil(remaining / goal.weeklyContribution) : null;

  const barColor =
    pct >= 90 ? 'bg-teal-500' : pct >= 50 ? 'bg-teal-500' : 'bg-lilac-500';

  const statusColor =
    goal.status === 'on_track'
      ? 'text-teal-500'
      : goal.status === 'behind'
        ? 'text-coral-500'
        : goal.status === 'completed'
          ? 'text-teal-700'
          : 'text-coral-700';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl border border-slate-200 shadow-card ${compact ? 'p-3' : 'p-5'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {showChild && (
            <div className="w-7 h-7 rounded-full bg-teal-500/10 text-teal-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {goal.childName.charAt(0)}
            </div>
          )}
          <div>
            <h3 className={`font-semibold text-ink ${compact ? 'text-sm' : ''}`}>
              {showChild && <span className="text-slate-400 font-normal">{goal.childName} &middot; </span>}
              {goal.name}
            </h3>
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-[0.3em] font-medium ${statusColor}`}>
          {pct >= 90 ? 'Almost there' : goal.status === 'behind' ? 'Behind' : ''}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
        <motion.div
          className={`h-2 rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-mono font-medium text-ink">
          ${goal.currentAmount} <span className="text-slate-400 font-sans font-normal">of</span> ${goal.targetAmount}
          <span className="text-slate-400 font-sans ml-1">({pct.toFixed(0)}%)</span>
        </span>
        {weeksLeft !== null && (
          <span className="text-slate-400">{weeksLeft > 0 ? `~${weeksLeft} weeks left` : 'Complete!'}</span>
        )}
      </div>
    </motion.div>
  );
}
