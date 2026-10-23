import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot } from 'lucide-react';
import type { ApiImpulseScore, ApiDecisionLog } from '@/api/client';
import { FACTOR_META, type FactorDetail } from '@/api/transforms';
import {
  generateSingleEventNarrative,
  generateGroupNarrative,
  generateFactorNarrative,
  generateFlowchartNarrative,
  renderBoldText,
  type NarrativeBubble,
} from '@/api/narrativeEngine';

// ── Selection Types ──────────────────────────────────────────────────

export type DetailSelection =
  | { kind: 'single'; score: ApiImpulseScore }
  | { kind: 'time_cell'; day: string; timeSlot: string; scores: ApiImpulseScore[] }
  | { kind: 'decision_type'; alertType: string; scores: ApiImpulseScore[] }
  | { kind: 'response_type'; response: string; scores: ApiImpulseScore[] }
  | { kind: 'factor'; factorKey: string; allScores: ApiImpulseScore[] }
  | { kind: 'flowchart_node'; nodeId: string; score: ApiImpulseScore; decisionLog: ApiDecisionLog | null };

interface Props {
  selection: DetailSelection | null;
  allScores: ApiImpulseScore[];
  onClose: () => void;
  onSelectionChange: (sel: DetailSelection | null) => void;
}

// ── Alert Color Helper ───────────────────────────────────────────────

function alertColor(type: string): string {
  if (type === 'impulse_pause') return '#E07A5F';
  if (type === 'gentle_nudge') return '#7E6AE6';
  if (type === 'celebrate') return '#11A39A';
  return '#94A3B8';
}

// ── ChatBubble ───────────────────────────────────────────────────────

function ChatBubble({ bubble, index }: { bubble: NarrativeBubble; index: number }) {
  const bgMap: Record<string, string> = {
    neutral: 'bg-slate-50 border-slate-200',
    positive: 'bg-teal-500/5 border-teal-500/20',
    caution: 'bg-coral-500/5 border-coral-500/20',
    celebrate: 'bg-lilac-500/5 border-lilac-500/20',
  };
  const labelMap: Record<string, string> = {
    context: 'Context',
    score: 'Impulse Score',
    factors: 'Factor Analysis',
    decision: 'Decision',
    response: 'Outcome',
    insight: 'Insight',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.3, ease: 'easeOut' }}
      className={`rounded-2xl border px-4 py-3 ${bgMap[bubble.emphasis] ?? bgMap.neutral}`}
    >
      <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400 mb-1.5">
        {labelMap[bubble.type] ?? bubble.type}
      </p>
      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
        {renderBoldText(bubble.text)}
      </div>
    </motion.div>
  );
}

// ── MiniFactorCard ───────────────────────────────────────────────────

function MiniFactorCard({ factors }: { factors: Record<string, FactorDetail> }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-1.5"
    >
      <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400 mb-2">Factor Breakdown</p>
      {FACTOR_META.map((fm) => {
        const w = factors[fm.key]?.impulse_weight ?? 0;
        return (
          <div key={fm.key} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-14 shrink-0">{fm.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${w * 100}%` }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="h-full rounded-full"
                style={{ backgroundColor: w >= 0.6 ? '#E07A5F' : w >= 0.35 ? '#F59E0B' : '#11A39A' }}
              />
            </div>
            <span className="font-mono text-[9px] text-slate-400 w-6 text-right">{w.toFixed(2)}</span>
          </div>
        );
      })}
    </motion.div>
  );
}

// ── EventListSection ─────────────────────────────────────────────────

function EventListSection({
  scores,
  onSelectSingle,
}: {
  scores: ApiImpulseScore[];
  onSelectSingle: (s: ApiImpulseScore) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
      <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400 mb-2">Individual Events</p>
      <div className="space-y-1.5">
        {scores.slice(0, 12).map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-xl bg-white border border-slate-100 px-3 py-2 cursor-pointer hover:border-teal-300 transition-colors"
            onClick={() => onSelectSingle(s)}
          >
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: alertColor(s.alert_type) }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ink truncate">{s.product_name}</p>
              <p className="text-[10px] text-slate-400">
                ${s.amount.toFixed(2)} — {new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <span className="font-mono text-xs font-semibold" style={{ color: alertColor(s.alert_type) }}>
              {s.impulse_score.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Panel Title ──────────────────────────────────────────────────────

function panelTitle(sel: DetailSelection): string {
  switch (sel.kind) {
    case 'single': return sel.score.product_name;
    case 'time_cell': return `${sel.day} ${sel.timeSlot}`;
    case 'decision_type': {
      const labels: Record<string, string> = { impulse_pause: 'Impulse Pause', gentle_nudge: 'Gentle Nudge', celebrate: 'Celebrated', suppress: 'Suppressed' };
      return `${labels[sel.alertType] ?? sel.alertType} Events`;
    }
    case 'response_type': return `"${sel.response}" Responses`;
    case 'factor': return `${FACTOR_META.find((f) => f.key === sel.factorKey)?.label ?? sel.factorKey} Factor`;
    case 'flowchart_node': {
      const labels: Record<string, string> = { detect: 'Detection', memory: 'Memory Check', score: 'Scoring', goal: 'Goal Impact', decision: 'Decision', action: 'Action' };
      return labels[sel.nodeId] ?? sel.nodeId;
    }
  }
}

// ── Main Panel Component ─────────────────────────────────────────────

export default function EventDetailPanel({ selection, allScores, onClose, onSelectionChange }: Props) {
  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Body scroll lock
  useEffect(() => {
    if (selection) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [selection]);

  // Generate narratives
  const bubbles = useMemo((): NarrativeBubble[] => {
    if (!selection) return [];
    switch (selection.kind) {
      case 'single':
        return generateSingleEventNarrative(selection.score, allScores);
      case 'time_cell':
        return generateGroupNarrative(selection.scores, `${selection.day} ${selection.timeSlot}`, `Purchases made on ${selection.day}s during ${selection.timeSlot.toLowerCase()} hours.`);
      case 'decision_type':
        return generateGroupNarrative(selection.scores, panelTitle(selection), `All events where Monty decided on this intervention type.`);
      case 'response_type':
        return generateGroupNarrative(selection.scores, panelTitle(selection), `All events with this child response.`);
      case 'factor':
        return generateFactorNarrative(selection.factorKey, selection.allScores);
      case 'flowchart_node':
        return generateFlowchartNarrative(selection.nodeId, selection.score, selection.decisionLog);
    }
  }, [selection, allScores]);

  // Extract scores for group views
  const groupScores = selection && 'scores' in selection ? selection.scores : null;

  // Extract factors for single view
  const singleFactors = selection?.kind === 'single'
    ? (selection.score.factors as Record<string, FactorDetail> | undefined)
    : null;

  return (
    <AnimatePresence>
      {selection && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => { if (info.offset.x > 100) onClose(); }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-white shadow-xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 shrink-0">
                  <Bot className="h-4 w-4 text-teal-500" />
                </div>
                <h2 className="font-display text-sm font-semibold text-ink truncate">
                  {panelTitle(selection)}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* Scrollable Chat Area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {bubbles.map((bubble, i) => (
                <ChatBubble key={bubble.id} bubble={bubble} index={i} />
              ))}

              {/* Mini factor card for single events */}
              {singleFactors && <MiniFactorCard factors={singleFactors} />}

              {/* Event list for group views */}
              {groupScores && groupScores.length > 0 && (
                <EventListSection
                  scores={groupScores}
                  onSelectSingle={(s) => onSelectionChange({ kind: 'single', score: s })}
                />
              )}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t border-slate-100 shrink-0">
              <p className="text-[10px] text-slate-400 text-center">
                Tap any chart element to explore — swipe right to close
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
