import { BarChart2, MessageCircle, Target, Brain, BellOff } from 'lucide-react';
import type { MemoryEnhanced } from '@/api/transforms';
import type { Memory } from '../mockData';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  spending_pattern: BarChart2,
  user_response: MessageCircle,
  goal_update: Target,
  habit_observation: Brain,
};

const TYPE_LABELS: Record<string, string> = {
  spending_pattern: 'Spending Pattern',
  user_response: 'User Response',
  goal_update: 'Goal Update',
  habit_observation: 'Habit Observation',
};

function isEnhanced(m: Memory | MemoryEnhanced): m is MemoryEnhanced {
  return 'confidence' in m;
}

function confidenceColor(c: number): string {
  if (c >= 0.7) return 'bg-teal-500';
  if (c >= 0.4) return 'bg-amber-400';
  return 'bg-coral-400';
}

interface Props {
  memories: (Memory | MemoryEnhanced)[];
}

export default function AgentMemoryLog({ memories }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-4 h-4 text-lilac-500" />
        <h2 className="font-display text-ink text-base font-semibold">What Monty Learned</h2>
      </div>
      <div className="space-y-2">
        {memories.map((m) => {
          const IconComponent = TYPE_ICONS[m.type] || Brain;
          const enhanced = isEnhanced(m);
          return (
            <div key={m.id} className="flex items-start gap-3 p-3 bg-slate-50/60 border border-slate-100 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <IconComponent className="w-4 h-4 text-lilac-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{TYPE_LABELS[m.type] || m.type}</p>
                  {enhanced && m.category && (
                    <span className="rounded-full bg-lilac-500/10 px-1.5 py-0.5 text-[9px] font-medium text-lilac-500">
                      {m.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">&ldquo;{m.content}&rdquo;</p>
                {enhanced && m.merchantName && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Merchant: {m.merchantName}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <p className="text-xs text-slate-400">
                    {new Date(m.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  {m.suppressAlerts && (
                    <span className="inline-flex items-center gap-1 text-coral-500 bg-coral-500/10 px-1.5 py-0.5 rounded-full text-[10px]">
                      <BellOff className="w-3 h-3" /> Alerts suppressed
                    </span>
                  )}
                </div>
              </div>
              {/* Confidence bar */}
              {enhanced && m.confidence > 0 && (
                <div className="flex flex-col items-end gap-0.5 shrink-0 mt-1">
                  <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${confidenceColor(m.confidence)}`}
                      style={{ width: `${m.confidence * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-slate-400">{Math.round(m.confidence * 100)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
