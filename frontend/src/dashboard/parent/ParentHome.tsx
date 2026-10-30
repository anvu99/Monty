import { Target, Activity, DollarSign } from 'lucide-react';
import SavingsGoalCard from '../components/SavingsGoalCard';
import ActivityFeed from '../components/ActivityFeed';
import PurchaseNotifications from '../components/PurchaseNotifications';
import FamilyPurchaseUpdates from '../components/FamilyPurchaseUpdates';
import { useMontyData } from '@/api/MontyDataProvider';
import { transformOverviewGoal, decisionsToActivity } from '@/api/transforms';

interface Props { familyName?: string }

export default function ParentHome({ familyName = 'The Thompsons' }: Props) {
  const { familyId, overview, loading, error, refetch } = useMontyData();
  const children = overview?.children ?? [];
  const goals = children.flatMap(child => child.goals
    .map(goal => transformOverviewGoal(goal, child.id, child.name)))
    .filter(goal => goal.status !== 'completed');
  const activities = children.flatMap(child => child.recent_decisions.map(decision => ({ child, decision })))
    .sort((a, b) => Date.parse(b.decision.timestamp) - Date.parse(a.decision.timestamp))
    .flatMap(({ child, decision }) => decisionsToActivity([decision], child.id, child.name));

  if (loading) return <div className="space-y-6 pb-24" aria-label="Loading dashboard"><div className="h-32 animate-pulse rounded-2xl bg-slate-200" /></div>;
  if (error) return <p role="alert">{error} <button onClick={refetch}>Retry</button></p>;

  return (
    <div className="space-y-6 pb-24">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Family Dashboard</p>
        <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">{familyName}</h1>
      </div>
      {familyId && <PurchaseNotifications key={`notifications-${familyId}`} familyId={familyId} />}
      {familyId && <FamilyPurchaseUpdates key={familyId} familyId={familyId} />}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-slate-400" />
          <h2 className="font-display text-lg font-semibold text-ink">Active Goals</h2>
          <span className="rounded-full border border-slate-200 bg-mist px-2 py-0.5 font-mono text-[10px] text-slate-500">{goals.length}</span>
        </div>
        <div className="space-y-3">
          {goals.length ? goals.map(goal => <SavingsGoalCard key={goal.id} goal={goal} showChild />)
            : <p className="text-sm text-slate-500">No active goals yet.</p>}
        </div>
      </section>
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-400" />
          <h2 className="font-display text-lg font-semibold text-ink">Recent Activity</h2>
        </div>
        {activities.length ? <ActivityFeed activities={activities} maxItems={4} />
          : <p className="text-sm text-slate-500">No recent activity yet.</p>}
      </section>
      <button type="button" disabled title="Coming soon" className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-mist opacity-60 disabled:cursor-not-allowed">
        <DollarSign className="h-4 w-4" />Add Bonus
      </button>
    </div>
  );
}
