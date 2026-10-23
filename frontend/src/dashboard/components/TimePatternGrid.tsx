import { motion } from 'framer-motion';
import { Clock, Moon, Sun } from 'lucide-react';
import { TIME_SLOTS, DAY_NAMES } from '@/api/transforms';

interface HeatmapCell {
  day: string;
  timeSlot: string;
  count: number;
  avgScore: number;
}

interface Props {
  data: HeatmapCell[];
  impulseIndicators?: { evening_pct: number; weekend_pct: number };
  onCellClick?: (day: string, timeSlot: string) => void;
}

function cellBg(count: number, avgScore: number): string {
  if (count === 0) return 'bg-slate-50';
  if (avgScore >= 0.6) return 'bg-coral-500/20';
  if (avgScore >= 0.35) return 'bg-amber-400/20';
  return 'bg-teal-500/15';
}

function cellText(count: number, avgScore: number): string {
  if (count === 0) return 'text-slate-300';
  if (avgScore >= 0.6) return 'text-coral-700';
  if (avgScore >= 0.35) return 'text-amber-700';
  return 'text-teal-700';
}

export default function TimePatternGrid({ data, impulseIndicators, onCellClick }: Props) {
  if (data.every((c) => c.count === 0)) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-teal-700" />
        <h2 className="font-display text-base font-semibold text-ink">Purchase Timing Patterns</h2>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[340px]">
          {/* Column headers */}
          <div className="grid grid-cols-[48px_repeat(5,1fr)] gap-1 mb-1">
            <div />
            {TIME_SLOTS.map((slot) => (
              <div key={slot} className="text-center text-[9px] uppercase tracking-wider text-slate-400 font-medium">
                {slot}
              </div>
            ))}
          </div>

          {/* Rows */}
          {DAY_NAMES.map((day, dayIdx) => (
            <div key={day} className="grid grid-cols-[48px_repeat(5,1fr)] gap-1 mb-1">
              <div className="flex items-center text-[10px] font-medium text-slate-500 pr-1">
                {day}
              </div>
              {TIME_SLOTS.map((slot, slotIdx) => {
                const cell = data.find((c) => c.day === day && c.timeSlot === slot);
                const count = cell?.count ?? 0;
                const score = cell?.avgScore ?? 0;
                return (
                  <motion.div
                    key={slot}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (dayIdx * 5 + slotIdx) * 0.02 }}
                    className={`flex h-8 items-center justify-center rounded-lg ${cellBg(count, score)} transition-colors ${count > 0 && onCellClick ? 'cursor-pointer hover:ring-2 hover:ring-teal-300' : ''}`}
                    title={count > 0 ? `${count} purchase${count > 1 ? 's' : ''}, avg score: ${score.toFixed(2)}` : 'No purchases'}
                    onClick={() => count > 0 && onCellClick?.(day, slot)}
                  >
                    {count > 0 && (
                      <span className={`font-mono text-[10px] font-bold ${cellText(count, score)}`}>
                        {count}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + Indicators */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-teal-500/15" />
          <span className="text-[9px] text-slate-500">Low impulse</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-amber-400/20" />
          <span className="text-[9px] text-slate-500">Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-coral-500/20" />
          <span className="text-[9px] text-slate-500">High impulse</span>
        </div>
      </div>

      {impulseIndicators && (impulseIndicators.evening_pct > 0 || impulseIndicators.weekend_pct > 0) && (
        <div className="mt-3 flex gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-600">
            <Moon className="h-3 w-3" />
            Evening: <span className="font-mono font-bold">{impulseIndicators.evening_pct}%</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-600">
            <Sun className="h-3 w-3" />
            Weekend: <span className="font-mono font-bold">{impulseIndicators.weekend_pct}%</span>
          </span>
        </div>
      )}
    </div>
  );
}
