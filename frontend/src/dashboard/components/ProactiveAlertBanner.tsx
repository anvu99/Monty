import { motion } from 'framer-motion';
import { Bot, Shield, AlertTriangle, X, Clock, Lightbulb } from 'lucide-react';
import type { ApiPrediction, ApiActiveAlert } from '@/api/client';

interface Props {
  predictions: ApiPrediction[];
  activeAlerts: ApiActiveAlert[];
  onDismissAlert: (alertId: string) => void;
  variant: 'parent' | 'kid';
}

function riskColor(level: string): string {
  if (level === 'high') return '#E07A5F';
  if (level === 'moderate') return '#F59E0B';
  return '#11A39A';
}

function riskBorder(level: string): string {
  if (level === 'high') return 'border-l-coral-500';
  if (level === 'moderate') return 'border-l-amber-400';
  return 'border-l-teal-500';
}

function riskBadge(level: string): string {
  if (level === 'high') return 'bg-coral-500/10 text-coral-700';
  if (level === 'moderate') return 'bg-amber-100 text-amber-700';
  return 'bg-teal-500/10 text-teal-700';
}

function timeUntil(isoDate?: string): string | null {
  if (!isoDate) return null;
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff < 0) return 'Now';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function kidFriendlyMessage(message: string): string {
  return message
    .replace(/\d+\.\d+%/g, (m) => {
      const n = parseFloat(m);
      return n > 70 ? 'a lot of the time' : n > 40 ? 'sometimes' : 'a little';
    });
}

// ── Kid Variant Cards ─────────────────────────────────────────────────

function KidPredictionCard({ pred, index }: { pred: ApiPrediction; index: number }) {
  const countdown = timeUntil(pred.risk_window_start);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-2xl bg-gradient-to-br from-lilac-500/10 to-lilac-500/5 border border-lilac-300/30 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lilac-500/15">
          <Bot className="h-4 w-4 text-lilac-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[9px] uppercase tracking-[0.25em] text-lilac-500 font-medium">Monty&apos;s Heads Up</p>
            {countdown && (
              <span className="inline-flex items-center gap-1 rounded-full bg-lilac-500/15 px-2 py-0.5 text-[9px] font-mono font-bold text-lilac-600">
                <Clock className="h-2.5 w-2.5" />
                {countdown}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{kidFriendlyMessage(pred.message)}</p>
          {pred.action_suggestion && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-lilac-500 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white">
              <Lightbulb className="h-3 w-3" />
              {pred.action_suggestion}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function KidAlertCard({ alert, index, onDismiss }: { alert: ApiActiveAlert; index: number; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-2xl bg-gradient-to-br from-coral-500/10 to-amber-500/5 border border-coral-300/30 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-coral-500/15">
          <AlertTriangle className="h-4 w-4 text-coral-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.25em] text-coral-500 font-medium mb-1">Watch Out!</p>
          <p className="text-sm text-slate-700 leading-relaxed">{kidFriendlyMessage(alert.message)}</p>
          {alert.action_suggestion && (
            <p className="mt-1.5 text-xs text-slate-500">{alert.action_suggestion}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="h-3 w-3 text-slate-400" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Parent Variant Cards ──────────────────────────────────────────────

function ParentPredictionCard({ pred, index }: { pred: ApiPrediction; index: number }) {
  const countdown = timeUntil(pred.risk_window_start);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`rounded-xl border border-slate-200 border-l-4 ${riskBorder(pred.risk_level)} bg-white p-4 shadow-card`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50">
          <Shield className="h-3.5 w-3.5" style={{ color: riskColor(pred.risk_level) }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${riskBadge(pred.risk_level)}`}>
              {pred.risk_level}
            </span>
            <span className="font-mono text-[9px] text-slate-400">
              {Math.round(pred.confidence * 100)}% confidence
            </span>
            {countdown && (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-400">
                <Clock className="h-2.5 w-2.5" />
                {countdown}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{pred.message}</p>
          {pred.action_suggestion && (
            <p className="mt-1.5 text-xs text-slate-500">{pred.action_suggestion}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ParentAlertCard({ alert, index, onDismiss }: { alert: ApiActiveAlert; index: number; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`rounded-xl border border-slate-200 border-l-4 ${riskBorder(alert.risk_level)} bg-white p-4 shadow-card`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-coral-500/10">
          <AlertTriangle className="h-3.5 w-3.5 text-coral-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${riskBadge(alert.risk_level)}`}>
              Active Alert
            </span>
            <span className="font-mono text-[9px] text-slate-400">
              {Math.round(alert.confidence * 100)}%
            </span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{alert.message}</p>
          {alert.action_suggestion && (
            <p className="mt-1.5 text-xs text-slate-500">{alert.action_suggestion}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function ProactiveAlertBanner({ predictions, activeAlerts, onDismissAlert, variant }: Props) {
  if (predictions.length === 0 && activeAlerts.length === 0) return null;

  const isKid = variant === 'kid';
  const Icon = isKid ? Bot : Shield;
  const title = isKid ? 'Monty\'s Predictions' : 'Proactive Alerts';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isKid ? 'text-lilac-500' : 'text-teal-700'}`} />
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-slate-400">
          {predictions.length + activeAlerts.length} alert{predictions.length + activeAlerts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Active alerts first */}
      {activeAlerts.map((alert, i) =>
        isKid ? (
          <KidAlertCard key={alert.alert_id} alert={alert} index={i} onDismiss={() => onDismissAlert(alert.alert_id)} />
        ) : (
          <ParentAlertCard key={alert.alert_id} alert={alert} index={i} onDismiss={() => onDismissAlert(alert.alert_id)} />
        ),
      )}

      {/* Predictions */}
      {predictions.slice(0, 3).map((pred, i) =>
        isKid ? (
          <KidPredictionCard key={`pred-${i}`} pred={pred} index={activeAlerts.length + i} />
        ) : (
          <ParentPredictionCard key={`pred-${i}`} pred={pred} index={activeAlerts.length + i} />
        ),
      )}
    </div>
  );
}
