import { motion } from 'framer-motion';
import { Search, CheckCircle, Cpu, Target, Send, MessageSquare } from 'lucide-react';
import type { FactorDetail } from '@/api/transforms';
import { FACTOR_META } from '@/api/transforms';

interface PipelineNode {
  id: string;
  label: string;
  type: 'input' | 'check' | 'process' | 'decision' | 'output';
}

interface PipelineEdge {
  from: string;
  to: string;
}

interface Props {
  data: {
    nodes: PipelineNode[];
    edges: PipelineEdge[];
  };
  factors?: Record<string, FactorDetail>;
  coachingMessage?: string;
  childResponse?: string | null;
  impulseScore?: number;
  onNodeClick?: (nodeId: string) => void;
}

const NODE_STYLES: Record<string, { bg: string; border: string; iconColor: string }> = {
  input: { bg: 'bg-white', border: 'border-slate-200', iconColor: 'text-teal-500' },
  check: { bg: 'bg-white', border: 'border-slate-200', iconColor: 'text-coral-500' },
  process: { bg: 'bg-white', border: 'border-slate-200', iconColor: 'text-lilac-500' },
  decision: { bg: 'bg-white', border: 'border-slate-200', iconColor: 'text-teal-700' },
  output: { bg: 'bg-white', border: 'border-slate-200', iconColor: 'text-teal-500' },
};

const NODE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  input: Search,
  check: CheckCircle,
  process: Cpu,
  decision: Target,
  output: Send,
};

function scoreBorder(score?: number): string {
  if (score == null) return 'border-slate-200';
  if (score >= 0.6) return 'border-coral-400';
  if (score >= 0.35) return 'border-amber-400';
  return 'border-teal-400';
}

function factorPillColor(weight: number): string {
  if (weight >= 0.6) return 'bg-coral-500/10 text-coral-700';
  if (weight >= 0.35) return 'bg-amber-100 text-amber-700';
  return 'bg-teal-500/10 text-teal-700';
}

export default function DecisionFlowchart({ data, factors, coachingMessage, childResponse, impulseScore, onNodeClick }: Props) {
  // Get top 3 contributing factors
  const topFactors = factors
    ? Object.entries(factors)
        .filter(([, d]) => typeof d?.impulse_weight === 'number')
        .sort((a, b) => b[1].impulse_weight - a[1].impulse_weight)
        .slice(0, 3)
        .map(([key, d]) => ({
          label: FACTOR_META.find((f) => f.key === key)?.label ?? key,
          weight: d.impulse_weight,
        }))
    : [];

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-5">
        <Cpu className="w-4 h-4 text-lilac-500" />
        <h2 className="font-display text-ink text-base font-semibold">AI Decision Pipeline</h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400 ml-auto">Last Alert</span>
      </div>
      <div className="flex flex-col items-center gap-0">
        {data.nodes.map((node, i) => {
          const style = NODE_STYLES[node.type] || NODE_STYLES.process;
          const IconComponent = NODE_TYPE_ICONS[node.type] || Cpu;
          const isDecisionNode = node.id === 'decision';
          const isScoreNode = node.id === 'score';
          const isActionNode = node.id === 'action' || node.type === 'output';

          return (
            <div key={node.id} className="flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.15 }}
                className={`${style.bg} border ${isDecisionNode ? scoreBorder(impulseScore) : style.border} rounded-xl px-5 py-3 max-w-sm flex items-center gap-3 ${isDecisionNode ? 'border-2' : ''} ${onNodeClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                onClick={() => onNodeClick?.(node.id)}
              >
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                  <IconComponent className={`w-3.5 h-3.5 ${style.iconColor}`} />
                </div>
                <p className="text-sm text-slate-600">{node.label}</p>
              </motion.div>

              {/* Top 3 factors under the score node */}
              {isScoreNode && topFactors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.15 + 0.2 }}
                  className="flex flex-wrap justify-center gap-1 mt-1.5"
                >
                  {topFactors.map((f) => (
                    <span
                      key={f.label}
                      className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-medium ${factorPillColor(f.weight)}`}
                    >
                      {f.label}: {f.weight.toFixed(2)}
                    </span>
                  ))}
                </motion.div>
              )}

              {/* Coaching message under the action node */}
              {isActionNode && coachingMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 + 0.2 }}
                  className="mt-2 max-w-sm rounded-xl bg-teal-500/5 border border-teal-500/15 px-3 py-2"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageSquare className="h-3 w-3 text-teal-600" />
                    <p className="text-[9px] uppercase tracking-[0.3em] text-teal-600">Coaching</p>
                  </div>
                  <p className="text-xs text-teal-800 leading-relaxed">{coachingMessage}</p>
                </motion.div>
              )}

              {i < data.nodes.length - 1 && (
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.15 + 0.1 }}
                  className="w-px h-6 bg-slate-200 origin-top"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Child response outcome */}
      {childResponse && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: data.nodes.length * 0.15 }}
          className="mt-4 pt-3 border-t border-slate-100 flex justify-center"
        >
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              childResponse === 'waited'
                ? 'bg-teal-500/10 text-teal-700'
                : childResponse === 'proceeded'
                  ? 'bg-coral-500/10 text-coral-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            Outcome: {childResponse.charAt(0).toUpperCase() + childResponse.slice(1)}
          </span>
        </motion.div>
      )}
    </div>
  );
}
