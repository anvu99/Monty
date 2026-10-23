import { useEffect, useState, useCallback } from 'react';
import { Flame, PiggyBank } from 'lucide-react';
import MontyCompanion from '../components/MontyCompanion';
import SavingsGoalCard from '../components/SavingsGoalCard';
import ProactiveAlertBanner from '../components/ProactiveAlertBanner';
import ProactiveNudgeCard from '../components/ProactiveNudgeCard';
import WaitPromptModal from '../components/WaitPromptModal';
import { fetchChildGoals, fetchChildStreak, fetchChildImpulseScores, fetchCheckRisk, dismissAlert } from '@/api/client';
import type { ApiImpulseScore, ApiCheckRiskResponse } from '@/api/client';
import { transformGoal, transformStreak } from '@/api/transforms';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import type { Goal } from '../mockData';

interface Props {
  kidName?: string;
  kidId?: string;
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Hi, ${name}`;
  if (hour < 22) return `Good evening, ${name}`;
  return `Night owl, ${name}`;
}

export default function KidHome({ kidName = 'Emma', kidId = '' }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [streak, setStreak] = useState({ currentDays: 0, longestDays: 0, lastActivityDate: '', calendar: [] as boolean[] });
  const [impulseScores, setImpulseScores] = useState<ApiImpulseScore[]>([]);
  const [riskData, setRiskData] = useState<ApiCheckRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time polling for impulse scores and wait prompts
  const liveFeed = useRealtimeUpdates(kidId, true);

  useEffect(() => {
    if (!kidId) { setLoading(false); return; }
    setLoading(true);

    Promise.all([
      fetchChildGoals(kidId)
        .then((data) => data.goals.map((g) => transformGoal(g, kidName)))
        .catch(() => [] as Goal[]),
      fetchChildStreak(kidId)
        .then(transformStreak)
        .catch(() => ({ currentDays: 0, longestDays: 0, lastActivityDate: '', calendar: [] as boolean[] })),
      fetchChildImpulseScores(kidId).catch(() => [] as ApiImpulseScore[]),
      fetchCheckRisk(kidId).catch(() => null as ApiCheckRiskResponse | null),
    ]).then(([g, s, scores, risk]) => {
      setGoals(g);
      setStreak(s);
      setImpulseScores(scores);
      setRiskData(risk);
      setLoading(false);
    });
  }, [kidId, kidName]);

  const handleDismissAlert = useCallback((alertId: string) => {
    dismissAlert(alertId).catch(() => {});
    setRiskData((prev) => prev ? {
      ...prev,
      active_alerts: prev.active_alerts.filter((a) => a.alert_id !== alertId),
    } : prev);
  }, []);

  const highRisk = riskData && riskData.current_risk_score.risk_score > 60;
  const montyState =
    highRisk ? 'thinking' : streak.currentDays >= 14 ? 'excited' : streak.currentDays >= 7 ? 'happy' : 'encouraging';
  const montyMessage =
    highRisk
      ? "I see some spending vibes ahead. Let's stay focused on your goals!"
      : streak.currentDays >= 14
        ? `${streak.currentDays} day streak! You're incredible!`
        : streak.currentDays >= 7
          ? "Great job today! I'm so proud of you!"
          : 'Keep going! Small steps count!';

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  return (
    <>
      {/* Wait Prompt Modal */}
      {liveFeed?.should_wait && liveFeed.wait_message && (
        <WaitPromptModal
          message={liveFeed.wait_message}
          durationSeconds={liveFeed.wait_duration_seconds || 300}
          onDismiss={() => {
            // User waited - could reward here in the future
          }}
        />
      )}

      <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">
            {getGreeting(kidName)}
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">{dateStr}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-lilac-300/40 bg-lilac-500/10 px-3 py-1.5">
          <Flame className="h-4 w-4 text-lilac-500" />
          <span className="font-mono text-sm font-semibold text-lilac-500">
            {streak.currentDays}
          </span>
        </div>
      </div>

      {/* Monty Companion */}
      <MontyCompanion
        state={montyState as 'happy' | 'excited' | 'encouraging' | 'thinking'}
        streakDays={streak.currentDays}
        message={montyMessage}
      />

      {/* Proactive Nudge — Daily Check-in */}
      <ProactiveNudgeCard childId={kidId} childName={kidName} />

      {/* Proactive Alerts */}
      {riskData && (riskData.predictions.length > 0 || riskData.active_alerts.length > 0) && (
        <ProactiveAlertBanner
          predictions={riskData.predictions}
          activeAlerts={riskData.active_alerts}
          onDismissAlert={handleDismissAlert}
          variant="kid"
        />
      )}

      {/* Goals */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Your Goals</h2>
          <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            {goals.length} active
          </span>
        </div>
        <div className="space-y-3">
          {goals.map((goal) => (
            <SavingsGoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      </div>

      {/* Recent Wins */}
      {(() => {
        const recentWins = impulseScores
          .filter((s) => s.child_response === 'waited')
          .slice(0, 4)
          .map((s) => ({
            id: s.id,
            text: `Waited on ${s.product_name}`,
            reward: '+$2',
            timestamp: new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          }));

        if (recentWins.length === 0) return null;

        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold text-ink mb-4">Recent Wins</h2>
            <div className="space-y-3">
              {recentWins.map((win) => (
                <div key={win.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lilac-500/10">
                    <PiggyBank className="h-4 w-4 text-lilac-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{win.text}</p>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                      {win.timestamp}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-lilac-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-lilac-500">
                    {win.reward}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      </div>
    </>
  );
}
