import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign } from 'lucide-react';

interface Props {
  goalName?: string;
  onSubmit: (amount: number) => Promise<void>;
  onClose: () => void;
}

export default function AddMoneyModal({ goalName, onSubmit, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(numAmount);
      onClose();
    } catch (err) {
      setError('Failed to add money. Please try again.');
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
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-lilac-500" />
              <h2 className="font-display text-lg font-semibold text-ink">Add Money</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {goalName && (
            <p className="mb-4 text-sm text-slate-600">
              Adding money to <span className="font-semibold text-ink">{goalName}</span>
            </p>
          )}

          {/* Amount Input */}
          <div className="mb-6">
            <label htmlFor="amount" className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg text-slate-400">$</span>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-8 font-mono text-lg text-ink placeholder-slate-300 transition focus:border-lilac-500 focus:outline-none focus:ring-2 focus:ring-lilac-500/20"
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-coral-500">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-full border border-ink/20 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-ink/40 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !amount}
              className="flex-1 rounded-full bg-lilac-500 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-lilac-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Money'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
