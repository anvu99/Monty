import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

interface Props {
  message: string;
  durationSeconds: number;
  onDismiss: () => void;
}

export default function WaitPromptModal({ message, durationSeconds, onDismiss }: Props) {
  const [timeRemaining, setTimeRemaining] = useState(durationSeconds);

  useEffect(() => {
    if (timeRemaining <= 0) {
      onDismiss();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, onDismiss]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="mx-4 max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-coral-500" />
              <h2 className="font-display text-lg font-semibold text-ink">Take a Moment</h2>
            </div>
          </div>

          <p className="mb-6 text-sm text-slate-600">{message}</p>

          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center rounded-2xl bg-lilac-50 px-6 py-4">
              <span className="font-mono text-3xl font-bold text-lilac-600">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500">
            Monty thinks you'll make a better decision after a quick break! 🌟
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
