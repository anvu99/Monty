import { motion } from 'framer-motion';
import { Calendar, Clock, TrendingUp, Repeat } from 'lucide-react';
import type { ApiPrediction } from '@/api/client';

interface Props {
  predictions: ApiPrediction[];
}

const PATTERN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  learned_day_time_combo: Calendar,
  learned_weekly_rhythm: Repeat,
  learned_time_cluster: Clock,
  learned_interval_pattern: TrendingUp,
  evening_spending_risk: Clock,
  weekend_spending_risk: Calendar,
  burst_prevention: TrendingUp,
  recurring_merchant_alert: Repeat,
};

const PATTERN_LABELS: Record<string, string> = {
  learned_day_time_combo: 'Day-Time Pattern',
  learned_weekly_rhythm: 'Weekly Rhythm',
  learned_time_cluster: 'Time Cluster',
  learned_interval_pattern: 'Interval Pattern',
  evening_spending_risk: 'Evening Risk',
  weekend_spending_risk: 'Weekend Risk',
  burst_prevention: 'Burst Risk',
  recurring_merchant_alert: 'Merchant Pattern',
};

function riskDotColor(level: string): string {
  if (level === 'high') return 'bg-coral-500';
  if (level === 'moderate') return 'bg-amber-400';
  return 'bg-teal-500';
}

function confidenceBar(confidence: number): string {
  if (confidence >= 0.7) return 'bg-coral-500';
  if (confidence >= 0.5) return 'bg-amber-400';
  return 'bg-teal-500';
}

function formatWindow(start?: string, end?: string): string | null {
  if (!start) return null;
  const s = new Date(start);
  const day = s.toLocaleDateString('en-US', { weekday: 'short' });
  const time = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (end) {
    const e = new Date(end);
    const endTime = e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${day} ${time} - ${endTime}`;
  }
  return `${day} ${time}`;
}

export default function PredictionTimeline({ predictions }: Props) {
  if (predictions.length === 0) return null;

  // Split into imminent (next 24h) and upcoming (rest)
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const imminent = predictions.filter((p) => {
    if (!p.risk_window_start) return false;
    const diff = new Date(p.risk_window_start).getTime() - now;
    return diff >= 0 && diff < dayMs;
  });

  const upcoming = predictions.filter((p) => {
    if (!p.risk_window_start) return true;
    const diff = new Date(p.risk_window_start).getTime() - now;
    return diff >= dayMs;
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-4 w-4 text-teal-700" />
        <h2 className="font-display text-base font-semibold text-ink">Predicted Patterns</h2>
        <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-slate-400">
          Learned from history
        </span>
      </div>

      {/* Imminent predictions */}
      {imminent.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] uppercase tracking-[0.25em] text-coral-500 font-medium mb-2">Next 24 Hours</p>
          <div className="space-y-2">
            {imminent.map((pred, i) => (
              <PredictionCard key={`imm-${i}`} pred={pred} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming predictions */}
      {upcoming.length > 0 && (
        <div>
          {imminent.length > 0 && (
            <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400 font-medium mb-2">This Week</p>
          )}
          <div className="space-y-2">
            {upcoming.map((pred, i) => (
              <PredictionCard key={`up-${i}`} pred={pred} index={imminent.length + i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PredictionCard({ pred, index }: { pred: ApiPrediction; index: number }) {
  const IconComp = PATTERN_ICONS[pred.type] ?? Clock;
  const label = PATTERN_LABELS[pred.type] ?? pred.type;
  const window = formatWindow(pred.risk_window_start, pred.risk_window_end);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5"
    >
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <div className={`h-2.5 w-2.5 rounded-full ${riskDotColor(pred.risk_level)}`} />
        {index < 4 && <div className="w-px flex-1 bg-slate-200" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <IconComp className="h-3 w-3 text-slate-400" />
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400">{label}</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">{pred.message}</p>
        {window && (
          <p className="mt-1 text-[10px] font-mono text-slate-400">{window}</p>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1 pt-1">
        <span className="font-mono text-[9px] text-slate-400">{Math.round(pred.confidence * 100)}%</span>
        <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${confidenceBar(pred.confidence)}`}
            style={{ width: `${pred.confidence * 100}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}
