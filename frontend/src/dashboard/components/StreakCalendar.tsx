import { Flame, Trophy } from 'lucide-react';

interface Props {
  currentDays: number;
  longestDays: number;
  calendar: boolean[];
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function StreakCalendar({ currentDays, longestDays, calendar }: Props) {
  // calendar is last 21 days (3 weeks), newest first
  const weeks: boolean[][] = [];
  for (let i = 0; i < calendar.length; i += 7) {
    weeks.push(calendar.slice(i, i + 7));
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-coral-500" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Streak Calendar</p>
        </div>
        <span className="font-mono text-sm font-bold text-coral-500">{currentDays} days</span>
      </div>

      <div className="space-y-1.5 mb-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d, i) => (
            <div key={i} className="text-center text-[10px] uppercase tracking-[0.3em] text-slate-400">
              {d}
            </div>
          ))}
        </div>
        {/* Calendar rows */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((active, di) => (
              <div
                key={di}
                className={`aspect-square rounded-lg flex items-center justify-center ${
                  active
                    ? 'bg-teal-500/15 text-teal-700'
                    : 'bg-slate-50 text-slate-300'
                }`}
              >
                {active ? (
                  <Flame className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          Current: <span className="font-mono font-semibold text-coral-500">{currentDays}d</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Trophy className="w-3 h-3 text-slate-400" />
          Longest: <span className="font-mono font-semibold text-ink">{longestDays}d</span>
        </span>
      </div>
    </div>
  );
}
