import { useEffect, useState, useMemo, useCallback } from 'react';
import { PiggyBank, Shield, Award, Pause, Target, Flame, BarChart3 } from 'lucide-react';
import StatCard from '../components/StatCard';
import WeeklyTrendChart from '../components/WeeklyTrendChart';
import DecisionFlowchart from '../components/DecisionFlowchart';
import ImpulseFactorBreakdown from '../components/ImpulseFactorBreakdown';
import ImpulseRadarChart from '../components/ImpulseRadarChart';
import DecisionOutcomeChart from '../components/DecisionOutcomeChart';
import TimePatternGrid from '../components/TimePatternGrid';
import ScoreTimelineChart from '../components/ScoreTimelineChart';
import EventDetailPanel from '../components/EventDetailPanel';
import type { DetailSelection } from '../components/EventDetailPanel';
import type { TimelinePoint } from '../components/ScoreTimelineChart';
import RiskGauge from '../components/RiskGauge';
import ProactiveAlertBanner from '../components/ProactiveAlertBanner';
import MoneyFlowSankey from '../components/MoneyFlowSankey';
import { useMontyData } from '@/api/MontyDataProvider';
import {
  fetchChildSpending,
  fetchDecisionLog,
  fetchChildImpulseScores,
  fetchCheckRisk,
  dismissAlert,
} from '@/api/client';
import type { ApiImpulseScore, ApiDecisionLog, ApiCheckRiskResponse } from '@/api/client';
import {
  transformOverviewGoal,
  computeStatsOverview,
  aggregateImpulseFactors,
  computeDecisionDistribution,
  computeTimePatterns,
  computeScoreTimeline,
  hourToSlot,
  DAY_NAMES,
  type FactorDetail,
} from '@/api/transforms';

const STAT_ICONS: Record<string, React.ReactNode> = {
  'Total Saved': <PiggyBank className="h-4 w-4 text-teal-500" />,
  'Impulse Resist': <Shield className="h-4 w-4 text-coral-500" />,
  'Badges Earned': <Award className="h-4 w-4 text-lilac-500" />,
  'Impulse Pauses': <Pause className="h-4 w-4 text-teal-700" />,
  'Active Goals': <Target className="h-4 w-4 text-coral-700" />,
  'Streak Rate': <Flame className="h-4 w-4 text-teal-500" />,
};

const KID_COLORS = [
  'bg-teal-500',
  'bg-purple-400',
  'bg-coral-500',
  'bg-amber-400'
];

type NodeType = 'input' | 'check' | 'process' | 'decision' | 'output';

export default function ParentStats() {
  const { overview, loading } = useMontyData();
  const children = overview?.children ?? [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedChild = children[selectedIdx];

  const [weeklySpending, setWeeklySpending] = useState<{ week: string; amount: number }[]>([]);
  const [impulseIndicators, setImpulseIndicators] = useState<{ evening_pct: number; weekend_pct: number } | null>(null);
  const [spendingCategories, setSpendingCategories] = useState<Record<string, { sum: number; count: number; mean: number }> | null>(null);
  const [pipeline, setPipeline] = useState<{ nodes: { id: string; label: string; type: NodeType }[]; edges: { from: string; to: string }[] } | null>(null);
  const [latestDecision, setLatestDecision] = useState<ApiDecisionLog | null>(null);
  const [impulseScores, setImpulseScores] = useState<ApiImpulseScore[]>([]);
  const [riskData, setRiskData] = useState<ApiCheckRiskResponse | null>(null);

  // Detail panel selection state
  const [detailSelection, setDetailSelection] = useState<DetailSelection | null>(null);

  useEffect(() => {
    if (!selectedChild) return;

    fetchChildSpending(selectedChild.id)
      .then((data) => {
        if (data.weekly_trend) {
          setWeeklySpending(data.weekly_trend.map((w) => ({
            week: w.week,
            amount: w.total,
          })));
        }
        if (data.impulse_indicators) {
          setImpulseIndicators(data.impulse_indicators);
        }
        if (data.categories) {
          setSpendingCategories(data.categories);
        }
      })
      .catch(() => {});

    fetchDecisionLog(selectedChild.id)
      .then((data) => {
        if (data.latest) {
          setLatestDecision(data.latest);
          if (data.latest.pipeline_nodes && data.latest.pipeline_edges) {
            setPipeline({
              nodes: data.latest.pipeline_nodes as { id: string; label: string; type: NodeType }[],
              edges: data.latest.pipeline_edges as { from: string; to: string }[],
            });
          }
        }
      })
      .catch(() => {});

    fetchChildImpulseScores(selectedChild.id)
      .then(setImpulseScores)
      .catch(() => {});

    fetchCheckRisk(selectedChild.id)
      .then(setRiskData)
      .catch(() => {});
  }, [selectedChild?.id]);

  // Derived data
  const radarAgg = useMemo(() => aggregateImpulseFactors(impulseScores), [impulseScores]);
  const decisionDist = useMemo(() => computeDecisionDistribution(impulseScores), [impulseScores]);
  const timePatterns = useMemo(() => computeTimePatterns(impulseScores), [impulseScores]);
  const scoreTimeline = useMemo(() => computeScoreTimeline(impulseScores), [impulseScores]);

  // Transform spending categories into Sankey format
  const sankeyData = useMemo(() => {
    if (!spendingCategories) return null;

    const entries = Object.entries(spendingCategories);
    if (entries.length === 0) return null;

    const totalSpent = entries.reduce((sum, [, data]) => sum + data.sum, 0);

    // Create nodes: Total Spending + all categories
    const nodes: Array<{ name: string; category?: string }> = [
      { name: 'Total Spending', category: 'income' },
    ];

    // Add category nodes
    entries.forEach(([category]) => {
      const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
      nodes.push({ name: categoryName, category: 'category' });
    });

    // Create links from Total Spending to each category
    const links: Array<{ source: number; target: number; value: number }> = [];
    entries.forEach(([, data], idx) => {
      links.push({
        source: 0, // Total Spending
        target: idx + 1, // Category node
        value: Math.round(data.sum * 100) / 100, // Round to 2 decimals
      });
    });

    return { nodes, links };
  }, [spendingCategories]);

  // ── Click Handlers ─────────────────────────────────────────────────

  const handleTimelineDotClick = useCallback((point: TimelinePoint) => {
    const match = impulseScores.find((s) => s.id === point.id);
    if (match) setDetailSelection({ kind: 'single', score: match });
  }, [impulseScores]);

  const handleTimeCellClick = useCallback((day: string, timeSlot: string) => {
    const matching = impulseScores.filter((s) => {
      const dt = new Date(s.timestamp);
      const dayIdx = (dt.getDay() + 6) % 7;
      const dayName = DAY_NAMES[dayIdx];
      const slot = hourToSlot(dt.getHours());
      return dayName === day && slot === timeSlot;
    });
    if (matching.length > 0) {
      setDetailSelection({ kind: 'time_cell', day, timeSlot, scores: matching });
    }
  }, [impulseScores]);

  const handleOutcomeClick = useCallback((rawKey: string) => {
    const matching = impulseScores.filter((s) => s.alert_type === rawKey);
    if (matching.length > 0) {
      setDetailSelection({ kind: 'decision_type', alertType: rawKey, scores: matching });
    }
  }, [impulseScores]);

  const handleResponseClick = useCallback((rawKey: string) => {
    const resp = rawKey === 'no_response' ? null : rawKey;
    const matching = impulseScores.filter((s) => s.child_response === resp);
    if (matching.length > 0) {
      setDetailSelection({ kind: 'response_type', response: rawKey === 'no_response' ? 'Pending' : rawKey, scores: matching });
    }
  }, [impulseScores]);

  const handleFactorClick = useCallback((factorKey: string) => {
    setDetailSelection({ kind: 'factor', factorKey, allScores: impulseScores });
  }, [impulseScores]);

  const handleDismissAlert = useCallback((alertId: string) => {
    dismissAlert(alertId).catch(() => {});
    setRiskData((prev) => prev ? {
      ...prev,
      active_alerts: prev.active_alerts.filter((a) => a.alert_id !== alertId),
    } : prev);
  }, []);

  const handleFlowchartNodeClick = useCallback((nodeId: string) => {
    const latestScore = impulseScores[0];
    if (latestScore) {
      setDetailSelection({
        kind: 'flowchart_node',
        nodeId,
        score: latestScore,
        decisionLog: latestDecision,
      });
    }
  }, [impulseScores, latestDecision]);

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  // Compute stats from real data - per selected child only
  const childGoals = selectedChild
    ? selectedChild.goals.map((g) => transformOverviewGoal(g, selectedChild.id, selectedChild.name))
    : [];
  const streakData = selectedChild ? { current_days: selectedChild.streak.current_days, longest_days: 0, companion_state: selectedChild.streak.companion_state } : null;
  const s = computeStatsOverview(impulseScores, streakData, childGoals);

  const stats = [
    { value: `$${s.totalSaved}`, label: 'Total Saved', delta: s.totalSavedDelta },
    { value: `${s.impulseResist}%`, label: 'Impulse Resist', delta: s.impulseResistDelta },
    { value: String(s.badgesEarned), label: 'Badges Earned', delta: s.badgesEarnedDelta },
    { value: String(s.impulsePauses), label: 'Impulse Pauses', delta: s.impulsePausesDelta },
    { value: String(s.activeGoals), label: 'Active Goals', delta: s.activeGoalsDelta },
    { value: `${s.streakRate}%`, label: 'Streak Rate', delta: s.streakRateDelta },
  ];

  // Get factors for the latest decision
  const latestFactors: Record<string, FactorDetail> | null =
    latestDecision?.factors
      ? (latestDecision.factors as Record<string, FactorDetail>)
      : radarAgg.latestFactors;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Last 30 days</p>
        </div>
        <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">
          {selectedChild ? `${selectedChild.name}'s Statistics` : 'Family Statistics'}
        </h1>
      </div>

      {/* Kid Selector */}
      {children.length > 1 && (
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
            </button>
          ))}
        </div>
      )}

      {/* Risk Gauge */}
      {riskData && riskData.current_risk_score.risk_score > 0 && (
        <RiskGauge
          score={riskData.current_risk_score.risk_score}
          riskLevel={riskData.current_risk_score.risk_level}
          factors={riskData.current_risk_score.factors}
          variant="parent"
        />
      )}

      {/* Proactive Alerts */}
      {riskData && (riskData.predictions.length > 0 || riskData.active_alerts.length > 0) && (
        <ProactiveAlertBanner
          predictions={riskData.predictions}
          activeAlerts={riskData.active_alerts}
          onDismissAlert={handleDismissAlert}
          variant="parent"
        />
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            value={stat.value}
            label={stat.label}
            delta={stat.delta}
            icon={STAT_ICONS[stat.label]}
            index={index}
          />
        ))}
      </div>

      {/* Impulse Score Timeline */}
      {scoreTimeline.length > 0 && (
        <ScoreTimelineChart data={scoreTimeline} onDotClick={handleTimelineDotClick} />
      )}

      {/* Impulse Factor Profile (Radar) */}
      {radarAgg.radarData.some((d) => d.avgWeight > 0) && (
        <ImpulseRadarChart data={radarAgg.radarData} onFactorClick={handleFactorClick} />
      )}

      {/* Money Flow Visualization */}
      {sankeyData && <MoneyFlowSankey data={sankeyData} childName={selectedChild?.name} />}

      {/* Decision Outcomes */}
      {decisionDist.totalDecisions > 0 && (
        <DecisionOutcomeChart
          outcomeData={decisionDist.outcomeData}
          responseData={decisionDist.responseData}
          totalDecisions={decisionDist.totalDecisions}
          onOutcomeClick={handleOutcomeClick}
          onResponseClick={handleResponseClick}
        />
      )}

      {/* Purchase Timing Patterns */}
      {timePatterns.some((c) => c.count > 0) && (
        <TimePatternGrid
          data={timePatterns}
          impulseIndicators={impulseIndicators ?? undefined}
          onCellClick={handleTimeCellClick}
        />
      )}

      {/* Weekly Spending Trend */}
      {weeklySpending.length > 0 && (
        <WeeklyTrendChart
          data={weeklySpending}
          lines={[{ key: 'amount', color: '#D1654B', name: 'Spending' }]}
          title="Weekly Spending Trend"
          formatValue={(v) => `$${v}`}
        />
      )}

      {/* Decision Pipeline + Factor Deep Dive */}
      {pipeline && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-ink">Latest Decision Deep Dive</h2>
          <DecisionFlowchart
            data={pipeline}
            factors={latestFactors ?? undefined}
            coachingMessage={latestDecision?.coaching_message ?? latestDecision?.ai_justification}
            childResponse={latestDecision?.child_response}
            impulseScore={latestDecision?.impulse_score}
            onNodeClick={handleFlowchartNodeClick}
          />
          {latestFactors && latestDecision && (
            <ImpulseFactorBreakdown
              factors={latestFactors}
              compositeScore={latestDecision.impulse_score ?? 0}
              trigger={latestDecision.trigger}
              decision={latestDecision.decision}
              coachingMessage={latestDecision.coaching_message ?? latestDecision.ai_justification}
              childResponse={latestDecision.child_response ?? undefined}
              onBarClick={handleFactorClick}
            />
          )}
        </div>
      )}

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
