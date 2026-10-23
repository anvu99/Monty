import { motion } from 'framer-motion';
import { Cpu, CheckCircle, XCircle, Clock } from 'lucide-react';
import { FACTOR_META, type FactorDetail } from '@/api/transforms';

const FACTOR_ORDER = FACTOR_META;

function barColor(weight: number): string {
  if (weight >= 0.6) return '#E07A5F';
  if (weight >= 0.35) return '#F59E0B';
  return '#11A39A';
}

function scoreBadgeColor(score: number): string {
  if (score >= 0.6) return 'bg-coral-500/10 text-coral-700 border-coral-200';
  if (score >= 0.35) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-teal-500/10 text-teal-700 border-teal-200';
}

const RESPONSE_BADGES: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  waited: { label: 'Waited', color: 'bg-teal-500/10 text-teal-700', Icon: CheckCircle },
  proceeded: { label: 'Proceeded', color: 'bg-coral-500/10 text-coral-700', Icon: XCircle },
  dismissed: { label: 'Dismissed', color: 'bg-slate-100 text-slate-600', Icon: Clock },
};

interface Props {
  factors: Record<string, FactorDetail>;
  compositeScore: number;
  trigger: string;
  decision: string;
  coachingMessage?: string;
  childResponse?: string | null;
  onBarClick?: (factorKey: string) => void;
}

export default function ImpulseFactorBreakdown({
  factors,
  compositeScore,
  trigger,
  decision,
  coachingMessage,
  childResponse,
  onBarClick,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50">
            <Cpu className="h-4 w-4 text-lilac-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">Factor Decomposition</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">{trigger}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-sm font-bold ${scoreBadgeColor(compositeScore)}`}>
          {compositeScore.toFixed(2)}
        </span>
      </div>

      {/* Factor bars */}
      <div className="space-y-2.5">
        {FACTOR_ORDER.map((fm, i) => {
          const detail = factors[fm.key];
          const weight = detail?.impulse_weight ?? 0;
          return (
            <div
              key={fm.key}
              className={`flex items-center gap-3 ${onBarClick ? 'cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 py-0.5 transition-colors' : ''}`}
              onClick={() => onBarClick?.(fm.key)}
            >
              {/* Label */}
              <div className="w-[100px] shrink-0">
                <p className="text-xs font-medium text-slate-600">{fm.label}</p>
                <p className="font-mono text-[9px] text-slate-400">{fm.weight}</p>
              </div>
              {/* Bar */}
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${weight * 100}%` }}
                  transition={{ delay: i * 0.08, duration: 0.5, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: barColor(weight) }}
                />
              </div>
              {/* Value */}
              <p className="w-[120px] shrink-0 truncate text-right font-mono text-[10px] text-slate-500">
                {detail?.value ?? '—'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Composite bar */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-ink">Composite Score</span>
          <span className="font-mono text-xs font-bold" style={{ color: barColor(compositeScore) }}>
            {(compositeScore * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${compositeScore * 100}%` }}
            transition={{ delay: 0.6, duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: barColor(compositeScore) }}
          />
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-slate-400">
          {decision === 'impulse_pause' ? 'Impulse Pause Triggered' : decision === 'gentle_nudge' ? 'Gentle Nudge Sent' : decision === 'celebrate' ? 'Good Behavior Celebrated' : 'Alert Suppressed'}
        </p>
      </div>

      {/* Coaching message */}
      {coachingMessage && (
        <div className="mt-4 rounded-xl bg-teal-500/5 border border-teal-500/15 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-teal-600 mb-1">AI Coaching Message</p>
          <p className="text-sm text-teal-800 leading-relaxed">{coachingMessage}</p>
        </div>
      )}

      {/* Child response */}
      {childResponse && RESPONSE_BADGES[childResponse] && (
        <div className="mt-3 flex items-center gap-2">
          {(() => {
            const badge = RESPONSE_BADGES[childResponse];
            return (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badge.color}`}>
                <badge.Icon className="h-3.5 w-3.5" />
                Child {badge.label}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}
