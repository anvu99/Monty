import { motion } from 'framer-motion';
import { Target, AlertTriangle, Lightbulb, BarChart2, Brain } from 'lucide-react';
import type { Insight } from '../mockData';

const TYPE_STYLES: Record<string, { border: string; iconColor: string; badge: string; Icon: React.ComponentType<{ className?: string }> }> = {
  positive: { border: 'border-l-teal-500', iconColor: 'text-teal-500', badge: 'bg-teal-500/10 text-teal-700', Icon: Target },
  risk: { border: 'border-l-coral-500', iconColor: 'text-coral-500', badge: 'bg-coral-500/10 text-coral-700', Icon: AlertTriangle },
  opportunity: { border: 'border-l-lilac-500', iconColor: 'text-lilac-500', badge: 'bg-lilac-500/10 text-lilac-500', Icon: Lightbulb },
  pattern: { border: 'border-l-teal-700', iconColor: 'text-teal-700', badge: 'bg-teal-500/10 text-teal-700', Icon: BarChart2 },
  learning: { border: 'border-l-lilac-500', iconColor: 'text-lilac-500', badge: 'bg-lilac-500/10 text-lilac-500', Icon: Brain },
};

interface Props {
  insight: Insight;
  index?: number;
}

export default function InsightCard({ insight, index = 0 }: Props) {
  const style = TYPE_STYLES[insight.type] || TYPE_STYLES.pattern;
  const IconComponent = style.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${style.border} shadow-card p-5`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0`}>
            <IconComponent className={`w-4.5 h-4.5 ${style.iconColor}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">{insight.title}</h3>
            <p className="text-xs text-slate-400">{insight.childName}</p>
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-[0.3em] font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
          {insight.impact}
        </span>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed mb-4">&ldquo;{insight.description}&rdquo;</p>

      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
          Confidence: <span className="font-mono text-ink">{insight.confidence}%</span>
        </span>
        <button className="text-xs font-medium text-teal-700 hover:text-teal-900 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1 rounded-full transition-colors">
          {insight.action}
        </button>
      </div>
    </motion.div>
  );
}
