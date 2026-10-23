import { motion } from 'framer-motion';
import { Bot, Flame } from 'lucide-react';

type MontyState = 'happy' | 'excited' | 'celebrating' | 'encouraging' | 'thinking' | 'neutral';

interface Props {
  state?: MontyState;
  streakDays?: number;
  message?: string;
}

const STATES: Record<MontyState, { defaultMessage: string; gradient: string }> = {
  happy: {
    defaultMessage: "Great job today! I'm so proud of you!",
    gradient: 'from-teal-900 via-teal-700 to-teal-500',
  },
  excited: {
    defaultMessage: "You're on fire! Keep it up!",
    gradient: 'from-coral-700 via-coral-500 to-coral-300',
  },
  celebrating: {
    defaultMessage: 'You did it! Amazing work!',
    gradient: 'from-lilac-500 via-lilac-300 to-teal-300',
  },
  encouraging: {
    defaultMessage: 'Keep going! Small steps count!',
    gradient: 'from-lilac-500 via-coral-500 to-coral-300',
  },
  thinking: {
    defaultMessage: "Hmm, let's think about this...",
    gradient: 'from-teal-700 via-teal-500 to-lilac-300',
  },
  neutral: {
    defaultMessage: "Let's keep going together!",
    gradient: 'from-teal-900 via-teal-700 to-teal-500',
  },
};

export default function MontyCompanion({ state = 'happy', streakDays = 0, message }: Props) {
  const s = STATES[state];

  return (
    <motion.div
      className={`bg-gradient-to-br ${s.gradient} rounded-2xl p-6 text-white shadow-card relative overflow-hidden`}
      animate={{ scale: [1, 1.005, 1] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      <div className="relative flex items-start gap-4">
        <motion.div
          className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Bot className="w-6 h-6 text-white" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-bold text-white">Monty</h3>
          <p className="text-white/80 text-sm mt-1 leading-relaxed">{message || s.defaultMessage}</p>
        </div>
      </div>

      {streakDays > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="relative mt-4 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 inline-flex items-center gap-1.5"
        >
          <Flame className="w-3.5 h-3.5 text-white" />
          <span className="text-sm font-mono font-semibold text-white">
            {streakDays} day streak
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
