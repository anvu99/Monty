// Transform backend API responses → frontend types used by components

import type {
  ApiFamilyMember,
  ApiSavingsGoal,
  ApiMemory,
  ApiDecisionLog,
  ApiStreak,
  ApiImpulseScore,
} from './client';
import type {
  Goal,
  HabitScore,
  Memory,
  Decision,
  Activity,
  Insight,
} from '@/dashboard/mockData';

// ---- Goals ----

const GOAL_EMOJI: Record<string, string> = {
  Skateboard: '\u{1F6F9}',
  'Skateboard Fund': '\u{1F6F9}',
  Gaming: '\u{1F3AE}',
  'Gaming Fund': '\u{1F3AE}',
  College: '\u{1F393}',
  'College Fund': '\u{1F393}',
  LEGO: '\u{1F9F1}',
};

function goalStatus(current: number, target: number): Goal['status'] {
  const pct = target > 0 ? current / target : 0;
  if (pct >= 1) return 'completed';
  if (pct >= 0.4) return 'on_track';
  if (pct >= 0.15) return 'behind';
  return 'at_risk';
}

export function transformGoal(
  g: ApiSavingsGoal,
  childName = '',
  childAvatar = 'fox',
): Goal {
  return {
    id: g.id,
    childId: g.child_id,
    childName,
    childAvatar,
    name: g.name,
    emoji: GOAL_EMOJI[g.name] ?? '\u{1F3AF}',
    currentAmount: g.current_amount,
    targetAmount: g.target_amount,
    weeklyContribution: g.weekly_contribution ?? 0,
    startDate: g.created_at ?? '',
    targetDate: '',
    status: goalStatus(g.current_amount, g.target_amount),
  };
}

export function transformOverviewGoal(
  g: { name: string; current_amount: number; target_amount: number; pct_complete?: number; weeks_remaining?: number },
  childId: string,
  childName: string,
  childAvatar = 'fox',
): Goal {
  return {
    id: `${childId}-${g.name}`,
    childId,
    childName,
    childAvatar,
    name: g.name,
    emoji: GOAL_EMOJI[g.name] ?? '\u{1F3AF}',
    currentAmount: g.current_amount ?? 0,
    targetAmount: g.target_amount ?? 0,
    weeklyContribution: 0,
    startDate: '',
    targetDate: '',
    status: goalStatus(g.current_amount ?? 0, g.target_amount ?? 0),
  };
}

// ---- Habit Score ----

function habitLabel(score: number): string {
  if (score >= 70) return 'Excellent habits!';
  if (score >= 50) return 'Building momentum';
  if (score >= 30) return 'Getting started';
  return 'Needs attention';
}

export function transformHabitScore(
  api: ApiFamilyMember['habit_score'],
): HabitScore {
  return {
    score: api.score,
    label: habitLabel(api.score),
    trend: '',
    components: {
      savings_streak_days: api.components.savings_streak_days,
      impulse_resistance_rate: api.components.impulse_resistance_rate,
      goal_progress_velocity: api.components.goal_progress_velocity,
      spending_consistency: api.components.spending_consistency,
      implementation_intentions_completed:
        api.components.implementation_intentions_completed,
    },
  };
}

// ---- Memories ----

export function transformMemory(m: ApiMemory): Memory {
  return {
    id: m.id,
    childId: m.child_id,
    type: m.memory_type as Memory['type'],
    content: m.content,
    createdAt: m.created_at,
    suppressAlerts: m.suppress_alerts,
  };
}

// ---- Decisions (from decision logs) ----

export const ACTION_LABELS: Record<string, string> = {
  impulse_pause: 'Impulse pause',
  gentle_nudge: 'Gentle check-in',
  celebrate: 'No intervention',
  suppress: 'Suppressed',
};

export function transformDecision(d: ApiDecisionLog): Decision {
  // Extract item name and amount from trigger string (e.g. "Amazon purchase - phone case")
  const trigger = d.trigger ?? '';
  return {
    id: d.id,
    childId: '',
    timestamp: new Date(d.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    item: trigger,
    icon: '\u{1F6D2}',
    amount: d.impulse_score ?? 0,
    montyAction: ACTION_LABELS[d.decision] ?? d.decision,
    montyMessage: d.coaching_message ?? '',
    childResponse: (d.child_response as Decision['childResponse']) ?? 'proceeded',
  };
}

// ---- Activity (derived from decisions) ----

export function decisionsToActivity(
  decisions: ApiDecisionLog[],
  childId: string,
  childName: string,
  childAvatar = 'fox',
): Activity[] {
  return decisions.slice(0, 5).map((d) => {
    const waited = d.child_response === 'waited';
    return {
      id: d.id,
      childId,
      childName,
      childAvatar,
      type: waited ? 'impulse_resisted' : 'browsing',
      icon: waited ? '\u{1F4AA}' : '\u{1F440}',
      title: waited ? `Waited on purchase` : d.trigger ?? 'Purchase detected',
      subtitle: d.coaching_message ?? d.decision ?? '',
      timestamp: new Date(d.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    };
  });
}

// ---- Insights (backend returns string[], frontend needs Insight[]) ----

const INSIGHT_TYPES: Insight['type'][] = [
  'positive',
  'pattern',
  'opportunity',
  'learning',
];

export function transformInsights(
  texts: string[],
  childId: string,
  childName: string,
): Insight[] {
  return texts.map((text, i) => ({
    id: `insight-${childId}-${i}`,
    childId,
    childName,
    type: INSIGHT_TYPES[i % INSIGHT_TYPES.length],
    icon: i % 4 === 0 ? '\u{1F3AF}' : i % 4 === 1 ? '\u{1F4CA}' : i % 4 === 2 ? '\u{1F4A1}' : '\u{1F4D6}',
    title: INSIGHT_TYPES[i % INSIGHT_TYPES.length].charAt(0).toUpperCase() + INSIGHT_TYPES[i % INSIGHT_TYPES.length].slice(1),
    description: text,
    impact: 'Medium',
    confidence: 80,
    action: 'View Details',
  }));
}

// ---- Streak ----

export function transformStreak(s: ApiStreak) {
  // Build a calendar array: last 21 days, true = active day within streak
  const calendar: boolean[] = [];
  for (let i = 20; i >= 0; i--) {
    calendar.push(i < s.current_days);
  }
  return {
    currentDays: s.current_days,
    longestDays: s.longest_days ?? s.current_days,
    lastActivityDate: s.last_updated ?? new Date().toISOString().split('T')[0],
    calendar,
  };
}

// ---- Impulse Factor Aggregation (for radar chart) ----

const FACTOR_META: { key: string; label: string; weight: string }[] = [
  { key: 'amount_vs_average', label: 'Amount', weight: '20%' },
  { key: 'velocity', label: 'Velocity', weight: '20%' },
  { key: 'category_frequency', label: 'Category', weight: '15%' },
  { key: 'memory_suppression', label: 'Memory', weight: '15%' },
  { key: 'time_of_day', label: 'Time', weight: '10%' },
  { key: 'day_of_week', label: 'Day', weight: '10%' },
  { key: 'goal_impact', label: 'Goal Impact', weight: '10%' },
];

export { FACTOR_META };

export interface FactorDetail {
  value: string;
  impulse_weight: number;
}

export function aggregateImpulseFactors(scores: ApiImpulseScore[]) {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const s of scores) {
    if (!s.factors) continue;
    for (const [key, detail] of Object.entries(s.factors)) {
      const d = detail as FactorDetail;
      if (typeof d?.impulse_weight !== 'number') continue;
      sums[key] = (sums[key] ?? 0) + d.impulse_weight;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  const radarData = FACTOR_META.map((fm) => ({
    factor: fm.key,
    label: fm.label,
    avgWeight: counts[fm.key] ? Math.round((sums[fm.key] / counts[fm.key]) * 100) / 100 : 0,
    fullMark: 1,
  }));

  const latest = scores[0];
  const latestFactors = latest?.factors
    ? (latest.factors as Record<string, FactorDetail>)
    : null;

  return { radarData, latestFactors };
}

// ---- Decision Distribution (for donut + bar charts) ----

export function computeDecisionDistribution(scores: ApiImpulseScore[]) {
  const outcomeCounts: Record<string, number> = {};
  const responseCounts: Record<string, number> = {};

  for (const s of scores) {
    const atype = s.alert_type || 'unknown';
    outcomeCounts[atype] = (outcomeCounts[atype] ?? 0) + 1;
    const resp = s.child_response || 'no_response';
    responseCounts[resp] = (responseCounts[resp] ?? 0) + 1;
  }

  const OUTCOME_COLORS: Record<string, string> = {
    impulse_pause: '#E07A5F',
    gentle_nudge: '#7E6AE6',
    celebrate: '#11A39A',
    suppress: '#94A3B8',
  };
  const RESPONSE_COLORS: Record<string, string> = {
    waited: '#11A39A',
    proceeded: '#E07A5F',
    dismissed: '#94A3B8',
    no_response: '#CBD5E1',
  };

  const outcomeData = Object.entries(outcomeCounts).map(([name, value]) => ({
    name: ACTION_LABELS[name] ?? name,
    rawKey: name,
    value,
    color: OUTCOME_COLORS[name] ?? '#CBD5E1',
  }));

  const responseData = Object.entries(responseCounts).map(([name, value]) => ({
    name: name === 'no_response' ? 'Pending' : name.charAt(0).toUpperCase() + name.slice(1),
    rawKey: name,
    value,
    color: RESPONSE_COLORS[name] ?? '#CBD5E1',
  }));

  return { outcomeData, responseData, totalDecisions: scores.length };
}

// ---- Time Pattern Heatmap ----

const TIME_SLOTS = ['Morning', 'Midday', 'Afternoon', 'Evening', 'Night'] as const;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function hourToSlot(hour: number): string {
  if (hour >= 6 && hour < 10) return 'Morning';
  if (hour >= 10 && hour < 14) return 'Midday';
  if (hour >= 14 && hour < 18) return 'Afternoon';
  if (hour >= 18 && hour < 22) return 'Evening';
  return 'Night';
}

export { TIME_SLOTS, DAY_NAMES };

export function computeTimePatterns(scores: ApiImpulseScore[]) {
  const cells: Record<string, { count: number; totalScore: number }> = {};

  for (const s of scores) {
    const dt = new Date(s.timestamp);
    const dayIdx = (dt.getDay() + 6) % 7; // Mon=0
    const day = DAY_NAMES[dayIdx];
    const slot = hourToSlot(dt.getHours());
    const key = `${day}-${slot}`;
    if (!cells[key]) cells[key] = { count: 0, totalScore: 0 };
    cells[key].count++;
    cells[key].totalScore += s.impulse_score;
  }

  const result: { day: string; timeSlot: string; count: number; avgScore: number }[] = [];
  for (const day of DAY_NAMES) {
    for (const slot of TIME_SLOTS) {
      const key = `${day}-${slot}`;
      const cell = cells[key];
      result.push({
        day,
        timeSlot: slot,
        count: cell?.count ?? 0,
        avgScore: cell ? Math.round((cell.totalScore / cell.count) * 100) / 100 : 0,
      });
    }
  }
  return result;
}

// ---- Score Timeline (for area chart) ----

export function computeScoreTimeline(scores: ApiImpulseScore[]) {
  return [...scores]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((s) => ({
      id: s.id,
      date: new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: Math.round(s.impulse_score * 100) / 100,
      product: s.product_name,
      amount: s.amount,
      alertType: s.alert_type,
    }));
}

// ---- Enhanced Memory (preserves confidence/category) ----

export interface MemoryEnhanced extends Memory {
  confidence: number;
  category: string | null;
  merchantName: string | null;
}

export function transformMemoryEnhanced(m: ApiMemory): MemoryEnhanced {
  return {
    ...transformMemory(m),
    confidence: m.confidence ?? 0,
    category: m.category ?? null,
    merchantName: m.merchant_name ?? null,
  };
}

// ---- Stats Overview (computed from impulse scores + streak + goals) ----

export function computeStatsOverview(
  impulseScores: ApiImpulseScore[],
  streak: ApiStreak | null,
  goals: Goal[],
) {
  const totalAlerts = impulseScores.filter((s) => s.alert_triggered).length;
  const waited = impulseScores.filter(
    (s) => s.alert_triggered && s.child_response === 'waited',
  ).length;
  const resistPct = totalAlerts > 0 ? Math.round((waited / totalAlerts) * 100) : 0;
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  return {
    totalSaved: Math.round(totalSaved),
    totalSavedDelta: '',
    impulseResist: resistPct,
    impulseResistDelta: '',
    badgesEarned: 4,
    badgesEarnedDelta: '',
    impulsePauses: totalAlerts,
    impulsePausesDelta: '',
    activeGoals: goals.filter((g) => g.status !== 'completed').length,
    activeGoalsDelta: '',
    streakRate: streak ? Math.min(100, streak.current_days * 5) : 0,
    streakRateDelta: '',
  };
}
