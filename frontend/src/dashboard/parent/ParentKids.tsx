import { useState, useEffect, useMemo } from 'react';
import { Users, Moon, Calendar, TrendingDown, TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import HabitStrengthCard from '../components/HabitStrengthCard';
import SavingsGoalCard from '../components/SavingsGoalCard';
import SpendingCategoryChart from '../components/SpendingCategoryChart';
import AgentMemoryLog from '../components/AgentMemoryLog';
import DecisionHistory from '../components/DecisionHistory';
import { useMontyData } from '@/api/MontyDataProvider';
import { fetchChildSpending, fetchChildImpulseScores } from '@/api/client';
import type { ApiSpending, ApiImpulseScore } from '@/api/client';
import {
  transformHabitScore,
  transformOverviewGoal,
  transformMemoryEnhanced,
  transformDecision,
  computeScoreTimeline,
} from '@/api/transforms';
import type { Goal, Decision } from '../mockData';

const KID_COLORS = ['bg-teal-500', 'bg-lilac-500', 'bg-coral-500', 'bg-amber-500'];

export default function ParentKids() {
  const { overview, loading } = useMontyData();
  const children = overview?.children ?? [];

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [spendingData, setSpendingData] = useState<ApiSpending>({});
  const [impulseScores, setImpulseScores] = useState<ApiImpulseScore[]>([]);

  const selectedChild = children[selectedIdx];

  // Fetch spending + impulse scores when kid changes
  useEffect(() => {
    if (!selectedChild) return;
    Promise.all([
      fetchChildSpending(selectedChild.id).catch(() => ({}) as ApiSpending),
      fetchChildImpulseScores(selectedChild.id).catch(() => [] as ApiImpulseScore[]),
    ]).then(([spending, scores]) => {
      setSpendingData(spending);
      setImpulseScores(scores);
    });
  }, [selectedChild?.id]);

  if (loading || !selectedChild) {
    return (
      <div className="space-y-6 pb-24">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  const score = transformHabitScore(selectedChild.habit_score);
  const goals: Goal[] = selectedChild.goals.map((g) =>
    transformOverviewGoal(g, selectedChild.id, selectedChild.name),
  );
  const memories = (selectedChild.memories ?? []).map(transformMemoryEnhanced);
  const decisions: Decision[] = (selectedChild.recent_decisions ?? []).map(transformDecision);

  const spendingCategories = spendingData.categories ?? {};
  const impulseIndicators = spendingData.impulse_indicators;

  const sparklineData = useMemo(() => computeScoreTimeline(impulseScores), [impulseScores]);
  const avgImpulse = useMemo(() => {
    if (impulseScores.length === 0) return 0;
    return impulseScores.reduce((s, d) => s + d.impulse_score, 0) / impulseScores.length;
  }, [impulseScores]);
  const trendDir = useMemo(() => {
    if (sparklineData.length < 4) return 'flat' as const;
    const half = Math.floor(sparklineData.length / 2);
    const firstHalf = sparklineData.slice(0, half).reduce((s, d) => s + d.score, 0) / half;
    const secondHalf = sparklineData.slice(half).reduce((s, d) => s + d.score, 0) / (sparklineData.length - half);
    if (secondHalf > firstHalf + 0.05) return 'up' as const;
    if (secondHalf < firstHalf - 0.05) return 'down' as const;
    return 'flat' as const;
  }, [sparklineData]);

  return (
    <div className="space-y-6 pb-24">
      {/* Header + Kid Selector */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-4 w-4 text-slate-400" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Kid Details</p>
        </div>
        <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl mb-4">
          {selectedChild.name}'s Dashboard
        </h1>
        <div className="flex gap-2">
          {children.map((child, idx) => (
            <button
              key={child.id}
              onClick={() => setSelectedIdx(idx)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                idx === selectedIdx
                  ? 'bg-ink text-mist shadow-lift'
                  : 'border border-ink/20 text-ink hover:border-ink/40'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${KID_COLORS[idx % KID_COLORS.length]}`}>
                {child.name.charAt(0).toUpperCase()}
              </span>
              {child.name}
              <span className="font-mono text-[10px] opacity-60">({child.age})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Habit Score */}
      <HabitStrengthCard
        data={score}
        title={`${selectedChild.name}'s Habit Strength`}
      />

      {/* Goals */}
      {goals.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink mb-4">Goals Progress</h2>
          <div className="space-y-3">
            {goals.map((goal) => (
              <SavingsGoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </div>
      )}

      {/* Spending Patterns */}
      {Object.keys(spendingCategories).length > 0 && (
        <SpendingCategoryChart categories={spendingCategories} />
      )}

      {/* Impulse Indicators */}
      {impulseIndicators && (impulseIndicators.evening_pct > 0 || impulseIndicators.weekend_pct > 0) && (
        <div className="flex gap-3">
          <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lilac-500/10">
              <Moon className="h-4 w-4 text-lilac-500" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Evening Purchases</p>
              <p className="font-mono text-base font-bold text-ink">{impulseIndicators.evening_pct}%</p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-coral-500/10">
              <Calendar className="h-4 w-4 text-coral-500" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Weekend Purchases</p>
              <p className="font-mono text-base font-bold text-ink">{impulseIndicators.weekend_pct}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Agent Memory Log */}
      {memories.length > 0 && <AgentMemoryLog memories={memories} />}

      {/* Decision History */}
      {decisions.length > 0 && <DecisionHistory decisions={decisions} />}

      {/* Impulse Score Sparkline */}
      {sparklineData.length > 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Impulse Score Trend</p>
            <div className="flex items-center gap-1.5">
              {trendDir === 'down' ? (
                <TrendingDown className="h-3.5 w-3.5 text-teal-500" />
              ) : trendDir === 'up' ? (
                <TrendingUp className="h-3.5 w-3.5 text-coral-500" />
              ) : null}
              <span className="font-mono text-xs text-slate-500">
                Avg: <span className="font-bold text-ink">{avgImpulse.toFixed(2)}</span>
                {trendDir === 'down' && <span className="text-teal-600 ml-1">↓ improving</span>}
                {trendDir === 'up' && <span className="text-coral-600 ml-1">↑ rising</span>}
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={sparklineData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E07A5F" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#E07A5F" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <ReferenceLine y={0.6} stroke="#E07A5F" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={0.35} stroke="#11A39A" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#E07A5F"
                strokeWidth={1.5}
                fill="url(#sparkGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
