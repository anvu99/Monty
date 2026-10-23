import { useEffect, useState, useMemo, useCallback } from 'react';
import { Flame, Wallet, Trophy, Target, Shield } from 'lucide-react';
import StatCard from '../components/StatCard';
import StreakCalendar from '../components/StreakCalendar';
import BadgeGrid from '../components/BadgeGrid';
import ScoreTimelineChart from '../components/ScoreTimelineChart';
import type { TimelinePoint } from '../components/ScoreTimelineChart';
import EventDetailPanel from '../components/EventDetailPanel';
import type { DetailSelection } from '../components/EventDetailPanel';
import ProactiveAlertBanner from '../components/ProactiveAlertBanner';
import ImplementationIntentions from '../components/ImplementationIntentions';
import {
  fetchChildStreak,
  fetchChildGoals,
  fetchChildImpulseScores,
  fetchCheckRisk,
  dismissAlert,
} from '@/api/client';
import type { ApiImpulseScore, ApiCheckRiskResponse } from '@/api/client';
import { transformStreak, transformGoal, computeScoreTimeline, computeDecisionDistribution } from '@/api/transforms';
import { MOCK_BADGES } from '../mockData';
import type { Goal } from '../mockData';

interface Props {
  kidId?: string;
}

export default function KidStats({ kidId = '' }: Props) {
  const [streak, setStreak] = useState({ currentDays: 0, longestDays: 0, lastActivityDate: '', calendar: [] as boolean[] });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [impulseScores, setImpulseScores] = useState<ApiImpulseScore[]>([]);
  const [riskData, setRiskData] = useState<ApiCheckRiskResponse | null>(null);
  const [detailSelection, setDetailSelection] = useState<DetailSelection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!kidId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetchChildStreak(kidId).then(transformStreak).catch(() => ({ currentDays: 0, longestDays: 0, lastActivityDate: '', calendar: [] as boolean[] })),
      fetchChildGoals(kidId).then((d) => d.goals.map((g) => transformGoal(g))).catch(() => [] as Goal[]),
      fetchChildImpulseScores(kidId).catch(() => [] as ApiImpulseScore[]),
      fetchCheckRisk(kidId).catch(() => null as ApiCheckRiskResponse | null),
    ]).then(([s, g, scores, risk]) => {
      setStreak(s);
      setGoals(g);
      setImpulseScores(scores);
      setRiskData(risk);
      setLoading(false);
    });
  }, [kidId]);

  // Derived data
  const scoreTimeline = useMemo(() => computeScoreTimeline(impulseScores), [impulseScores]);
  const decisionDist = useMemo(() => computeDecisionDistribution(impulseScores), [impulseScores]);
  const waitedCount = useMemo(() => impulseScores.filter((s) => s.child_response === 'waited').length, [impulseScores]);

  // Click handlers
  const handleTimelineDotClick = useCallback((point: TimelinePoint) => {
    const match = impulseScores.find((s) => s.id === point.id);
    if (match) setDetailSelection({ kind: 'single', score: match });
  }, [impulseScores]);

  const handleDismissAlert = useCallback((alertId: string) => {
    dismissAlert(alertId).catch(() => {});
    setRiskData((prev) => prev ? {
      ...prev,
      active_alerts: prev.active_alerts.filter((a) => a.alert_id !== alertId),
    } : prev);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const activeGoals = goals.filter((g) => g.status !== 'completed').length;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Your Stats</h1>
        <p className="mt-0.5 text-xs text-slate-600">
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* Week Summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          value={`$${totalSaved}`}
          label="Saved"
          icon={<Wallet className="h-5 w-5 text-lilac-500" />}
          index={0}
        />
        <StatCard
          value={`${waitedCount}`}
          label="Wins"
          icon={<Trophy className="h-5 w-5 text-lilac-500" />}
          index={1}
        />
        <StatCard
          value={`${streak.currentDays}`}
          label="Day Streak"
          icon={<Flame className="h-5 w-5 text-lilac-500" />}
          index={2}
        />
        <StatCard
          value={`${activeGoals}`}
          label="Active Goals"
          icon={<Target className="h-5 w-5 text-lilac-500" />}
          index={3}
        />
      </div>

      {/* Proactive Alerts */}
      {riskData && (riskData.predictions.length > 0 || riskData.active_alerts.length > 0) && (
        <ProactiveAlertBanner
          predictions={riskData.predictions}
          activeAlerts={riskData.active_alerts}
          onDismissAlert={handleDismissAlert}
          variant="kid"
        />
      )}

      {/* My Impulse Journey (Timeline) */}
      {scoreTimeline.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink mb-3">My Impulse Journey</h2>
          <ScoreTimelineChart data={scoreTimeline} onDotClick={handleTimelineDotClick} />
        </div>
      )}

      {/* My Impulse Wins */}
      {decisionDist.totalDecisions > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-lilac-500" />
            <h2 className="font-display text-base font-semibold text-ink">My Impulse Wins</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-center">
              <p className="font-mono text-2xl font-bold text-lilac-500">{waitedCount}</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Times I Waited</p>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div className="flex-1 text-center">
              <p className="font-mono text-2xl font-bold text-ink">{decisionDist.totalDecisions}</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Total Decisions</p>
            </div>
          </div>
          {waitedCount > 0 && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-lilac-500 transition-all"
                  style={{ width: `${Math.round((waitedCount / decisionDist.totalDecisions) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-center text-[10px] font-mono text-lilac-500 font-semibold">
                {Math.round((waitedCount / decisionDist.totalDecisions) * 100)}% success rate
              </p>
            </div>
          )}
        </div>
      )}

      {/* Streak Calendar */}
      <StreakCalendar
        currentDays={streak.currentDays}
        longestDays={streak.longestDays}
        calendar={streak.calendar}
      />

      {/* Badges */}
      <BadgeGrid badges={MOCK_BADGES} />

      {/* If-Then Plans */}
      {kidId && <ImplementationIntentions childId={kidId} variant="kid" />}

      {/* Personal Records */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Personal Records</h2>
        <div className="space-y-3">
          {[
            { icon: <Flame className="h-4 w-4 text-lilac-500" />, label: 'Longest streak', value: `${streak.longestDays} days` },
            { icon: <Wallet className="h-4 w-4 text-lilac-500" />, label: 'Total saved', value: `$${totalSaved}` },
            { icon: <Target className="h-4 w-4 text-lilac-500" />, label: 'Active goals', value: `${activeGoals}` },
            { icon: <Shield className="h-4 w-4 text-lilac-500" />, label: 'Impulse wins', value: `${waitedCount}` },
          ].map((record) => (
            <div key={record.label} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lilac-500/10">
                {record.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{record.label}</p>
              </div>
              <span className="font-mono text-sm font-semibold text-ink">{record.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Event Detail Panel */}
      <EventDetailPanel
        selection={detailSelection}
        allScores={impulseScores}
        onClose={() => setDetailSelection(null)}
        onSelectionChange={setDetailSelection}
      />
    </div>
  );
}
