import { ShieldCheck, Clock, ShoppingBag, Pause } from 'lucide-react';
import type { Decision } from '../mockData';

const RESPONSE_STYLES: Record<string, { label: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }> = {
  waited: { label: 'Waited', color: 'text-teal-700', bg: 'bg-teal-500/10', Icon: ShieldCheck },
  proceeded: { label: 'Proceeded', color: 'text-lilac-500', bg: 'bg-lilac-500/10', Icon: Clock },
  purchased: { label: 'Purchased', color: 'text-slate-600', bg: 'bg-slate-100', Icon: ShoppingBag },
  delayed: { label: 'Delayed', color: 'text-coral-500', bg: 'bg-coral-500/10', Icon: Pause },
};

interface Props {
  decisions: Decision[];
}

export default function DecisionHistory({ decisions }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-4">Decision History</p>
      <div className="space-y-4">
        {decisions.map((d) => {
          const responseStyle = RESPONSE_STYLES[d.childResponse] || RESPONSE_STYLES.purchased;
          const ResponseIcon = responseStyle.Icon;
          return (
            <div key={d.id} className="border-l-2 border-slate-200 pl-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-1.5">{d.timestamp}</p>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium text-ink">{d.item}</span>
                <span className="font-mono text-sm text-slate-500">${d.amount.toFixed(2)}</span>
              </div>
              <div className="text-xs space-y-1.5">
                <p className="text-slate-500">
                  Monty: <span className="text-slate-600">{d.montyAction}</span>
                  {' \u2014 '}&ldquo;{d.montyMessage}&rdquo;
                </p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full ${responseStyle.bg} ${responseStyle.color} text-[11px]`}>
                    <ResponseIcon className="w-3 h-3" />
                    {responseStyle.label}
                  </span>
                  {d.amountSaved && (
                    <span className="font-mono text-teal-700 font-medium">Saved ${d.amountSaved}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
