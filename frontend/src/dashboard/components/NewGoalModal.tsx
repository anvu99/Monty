import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target } from 'lucide-react';

interface Props {
  onSubmit: (name: string, targetAmount: number, weeklyContribution: number) => Promise<void>;
  onClose: () => void;
}

export default function NewGoalModal({ onSubmit, onClose }: Props) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [weeklyContribution, setWeeklyContribution] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter a goal name');
      return;
    }

    const numTarget = parseFloat(targetAmount);
    const numWeekly = parseFloat(weeklyContribution || '0');

    if (isNaN(numTarget) || numTarget <= 0) {
      setError('Please enter a valid target amount');
      return;
    }

    if (isNaN(numWeekly) || numWeekly < 0) {
      setError('Please enter a valid weekly contribution');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(name.trim(), numTarget, numWeekly);
      onClose();
    } catch (err) {
      setError('Failed to create goal. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="mx-4 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-lilac-500" />
              <h2 className="font-display text-lg font-semibold text-ink">New Goal</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="mb-6 text-sm text-slate-600">
            What would you like to save for? Let's set a goal!
          </p>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Goal Name */}
            <div>
              <label htmlFor="name" className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Goal Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Nintendo Switch"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink placeholder-slate-300 transition focus:border-lilac-500 focus:outline-none focus:ring-2 focus:ring-lilac-500/20"
                disabled={isSubmitting}
              />
            </div>

            {/* Target Amount */}
            <div>
              <label htmlFor="target" className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Target Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-slate-400">$</span>
                <input
                  id="target"
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-8 font-mono text-sm text-ink placeholder-slate-300 transition focus:border-lilac-500 focus:outline-none focus:ring-2 focus:ring-lilac-500/20"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Weekly Contribution (Optional) */}
            <div>
              <label htmlFor="weekly" className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Weekly Contribution <span className="text-slate-400">(Optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-slate-400">$</span>
                <input
                  id="weekly"
                  type="number"
                  step="0.01"
                  min="0"
                  value={weeklyContribution}
                  onChange={(e) => setWeeklyContribution(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-8 font-mono text-sm text-ink placeholder-slate-300 transition focus:border-lilac-500 focus:outline-none focus:ring-2 focus:ring-lilac-500/20"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-coral-500">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-full border border-ink/20 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-ink/40 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim() || !targetAmount}
              className="flex-1 rounded-full bg-lilac-500 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-lilac-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Goal'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
