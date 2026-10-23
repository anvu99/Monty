import { motion } from 'framer-motion';
import { Target, Shield, Flame, Star, Trophy, Gem, TrendingUp, Award, Lock } from 'lucide-react';
import type { Badge } from '../mockData';

// Map badge names to Lucide icons
const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'First Goal': Target,
  'Wait & Win': Shield,
  'Week Warrior': Flame,
  'Super Saver': Star,
  'Goal Crusher': Trophy,
  'Diamond Hands': Gem,
  'Momentum': TrendingUp,
  'Big Win': Award,
};

interface Props {
  badges: Badge[];
}

export default function BadgeGrid({ badges }: Props) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-teal-500" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Badges</p>
        </div>
        <span className="text-xs text-slate-400">
          <span className="font-mono text-ink">{earned.length}</span> earned &middot; <span className="font-mono text-ink">{locked.length}</span> locked
        </span>
      </div>

      {/* Earned badges */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {earned.map((b, i) => {
          const IconComponent = BADGE_ICONS[b.name] || Award;
          return (
            <motion.div
              key={b.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-200 shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center">
                <IconComponent className="w-4 h-4 text-teal-500" />
              </div>
              <span className="text-[10px] font-medium text-slate-600 text-center leading-tight">
                {b.name}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Locked badges */}
      {locked.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">Locked</p>
          <div className="grid grid-cols-4 gap-3">
            {locked.map((b) => (
              <div
                key={b.id}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100 opacity-40"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-[10px] font-medium text-slate-400 text-center leading-tight">
                  {b.name}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
