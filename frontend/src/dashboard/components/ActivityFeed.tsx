import { ShieldCheck, PiggyBank, Flame, Award, Eye } from 'lucide-react';
import type { Activity } from '../mockData';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  impulse_resisted: <ShieldCheck className="w-4 h-4 text-teal-500" />,
  goal_contribution: <PiggyBank className="w-4 h-4 text-lilac-500" />,
  streak_milestone: <Flame className="w-4 h-4 text-coral-500" />,
  challenge_completed: <Award className="w-4 h-4 text-teal-700" />,
  browsing: <Eye className="w-4 h-4 text-slate-400" />,
};

interface Props {
  activities: Activity[];
  maxItems?: number;
  title?: string;
}

export default function ActivityFeed({ activities, maxItems, title = 'Recent Activity' }: Props) {
  const items = maxItems ? activities.slice(0, maxItems) : activities;

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-4">{title}</p>
      <div className="space-y-2">
        {items.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 border border-slate-100"
          >
            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              {TYPE_ICONS[a.type] || <Eye className="w-4 h-4 text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">
                {a.childName} {a.title.toLowerCase().startsWith(a.childName.toLowerCase()) ? a.title.slice(a.childName.length) : a.title}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{a.subtitle} &middot; {a.timestamp}</p>
            </div>
            {a.amountSaved && (
              <span className="text-xs font-mono font-semibold text-teal-700 bg-teal-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                +${a.amountSaved}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
