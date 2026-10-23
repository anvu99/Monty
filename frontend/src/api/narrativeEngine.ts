// Deterministic narrative generation from structured impulse data.
// Produces conversational "chat bubble" text for the EventDetailPanel.

import type { ApiImpulseScore, ApiDecisionLog } from './client';
import { FACTOR_META, type FactorDetail } from './transforms';

export interface NarrativeBubble {
  id: string;
  type: 'context' | 'score' | 'factors' | 'decision' | 'response' | 'insight';
  text: string; // uses **bold** markers for emphasis
  emphasis: 'neutral' | 'positive' | 'caution' | 'celebrate';
}

// ── Helpers ──────────────────────────────────────────────────────────

function fmt(ts: string) {
  const dt = new Date(ts);
  return {
    day: dt.toLocaleDateString('en-US', { weekday: 'long' }),
    date: dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function scoreLabel(s: number): string {
  if (s >= 0.7) return 'very high';
  if (s >= 0.6) return 'high';
  if (s >= 0.45) return 'moderate';
  if (s >= 0.35) return 'mild';
  return 'low';
}

function scoreEmphasis(s: number): NarrativeBubble['emphasis'] {
  if (s >= 0.6) return 'caution';
  if (s >= 0.35) return 'neutral';
  return 'positive';
}

function topFactors(factors: Record<string, FactorDetail>, n = 3) {
  return Object.entries(factors)
    .filter(([, d]) => typeof d?.impulse_weight === 'number')
    .sort((a, b) => b[1].impulse_weight - a[1].impulse_weight)
    .slice(0, n);
}

function factorLabel(key: string): string {
  return FACTOR_META.find((f) => f.key === key)?.label ?? key;
}

function alertLabel(type: string): string {
  const m: Record<string, string> = {
    impulse_pause: 'impulse pause',
    gentle_nudge: 'gentle check-in',
    celebrate: 'celebration',
    suppress: 'silent suppression',
  };
  return m[type] ?? type;
}

function alertExplanation(type: string): string {
  const m: Record<string, string> = {
    impulse_pause: 'Monty stepped in with a full impulse pause — showing a Wait & Win overlay to encourage a 24-hour cool-down before deciding.',
    gentle_nudge: 'Monty sent a gentle check-in — just enough to make them think twice without being heavy-handed.',
    celebrate: "Everything looked intentional and planned, so Monty celebrated the smart decision! No intervention needed.",
    suppress: "Monty's memory bank flagged this as a known routine purchase, so the alert was silently suppressed.",
  };
  return m[type] ?? `Monty decided on: ${type}.`;
}

function responseText(resp: string | null): { text: string; emphasis: NarrativeBubble['emphasis'] } {
  if (resp === 'waited') return { text: 'They **waited** — choosing to sleep on it. That self-control is exactly the habit Monty is helping build.', emphasis: 'positive' };
  if (resp === 'proceeded') return { text: "They went ahead with the purchase. That's okay — each moment is a learning opportunity, and awareness is the first step.", emphasis: 'neutral' };
  if (resp === 'dismissed') return { text: 'They dismissed the notification. Monty will keep the gentle approach and try again next time.', emphasis: 'neutral' };
  return { text: 'No response was needed — this was a positive, planned purchase.', emphasis: 'celebrate' };
}

function factorNarrative(key: string, detail: FactorDetail): string {
  const w = detail.impulse_weight;
  const v = detail.value ?? 'N/A';
  const hasValue = detail.value !== undefined && detail.value !== null && detail.value !== '';

  const lines: Record<string, () => string> = {
    amount_vs_average: () =>
      w >= 0.6 ? `The price${hasValue ? ` (**${v}**)` : ''} is significantly above their typical spending — a big signal.`
      : w >= 0.3 ? `The amount${hasValue ? ` (**${v}**)` : ''} is in their normal range — not a major flag.`
      : `The amount${hasValue ? ` (**${v}**)` : ''} is low relative to their usual purchases.`,
    velocity: () =>
      w >= 0.6 ? `Purchase velocity is high${hasValue ? ` (**${v}**)` : ''} — rapid-fire spending raises a flag.`
      : w >= 0.3 ? `Moderate velocity${hasValue ? ` (**${v}**)` : ''} — not unusual but worth noting.`
      : `Normal purchase cadence${hasValue ? ` (**${v}**)` : ''}.`,
    category_frequency: () =>
      w >= 0.6 ? `Category frequency is elevated${hasValue ? ` (**${v}**)` : ''} — they've been shopping in this category a lot.`
      : w >= 0.3 ? `Category frequency is moderate${hasValue ? ` (**${v}**)` : ''}.`
      : `This category isn't a frequent one for them${hasValue ? ` (**${v}**)` : ''}.`,
    memory_suppression: () =>
      w >= 0.4 ? `Memory check${hasValue ? `: **${v}**` : ''} — past behavior shows a pattern here.`
      : `Memory check${hasValue ? `: **${v}**` : ''} — no concerning patterns stored.`,
    time_of_day: () =>
      w >= 0.6 ? `Late-night browsing${hasValue ? ` (**${v}**)` : ''} tends to correlate with more impulsive decisions.`
      : w >= 0.3 ? `The time${hasValue ? ` (**${v}**)` : ''} is slightly elevated for impulse risk.`
      : `The time${hasValue ? ` (**${v}**)` : ''} is typical — daytime purchases are usually more intentional.`,
    day_of_week: () =>
      w >= 0.6 ? `Weekend spending${hasValue ? ` (**${v}**)` : ''} is a known high-impulse window.`
      : w >= 0.3 ? `The day${hasValue ? ` (**${v}**)` : ''} carries moderate impulse risk.`
      : `The day${hasValue ? ` (**${v}**)` : ''} is low-risk for impulse spending.`,
    goal_impact: () =>
      w >= 0.5 ? `This purchase would impact their savings${hasValue ? `: **${v}**` : ''}.`
      : w >= 0.2 ? `Small impact on goals${hasValue ? `: **${v}**` : ''}.`
      : `No meaningful goal impact${hasValue ? `: **${v}**` : ''}.`,
  };
  return (lines[key] ?? (() => `**${factorLabel(key)}**${hasValue ? `: ${v}` : ''} (weight ${w.toFixed(2)}).`))();
}

// ── Single Event Narrative ───────────────────────────────────────────

export function generateSingleEventNarrative(
  score: ApiImpulseScore,
  allScores: ApiImpulseScore[],
): NarrativeBubble[] {
  const { day, date, time } = fmt(score.timestamp);
  const bubbles: NarrativeBubble[] = [];
  let i = 0;

  // 1. Context
  bubbles.push({
    id: `ctx-${i++}`,
    type: 'context',
    text: `On **${day}**, ${date} at **${time}**, a **$${score.amount.toFixed(2)} ${score.product_name}** purchase was detected at **${score.merchant_name}**.`,
    emphasis: 'neutral',
  });

  // 2. Score
  const sl = scoreLabel(score.impulse_score);
  const se = scoreEmphasis(score.impulse_score);
  bubbles.push({
    id: `score-${i++}`,
    type: 'score',
    text: score.impulse_score >= 0.6
      ? `This triggered a **${sl} impulse score of ${score.impulse_score.toFixed(2)}**. The model thinks this was likely an unplanned, emotionally-driven purchase.`
      : score.impulse_score >= 0.35
      ? `Monty gave this a **${sl} impulse score of ${score.impulse_score.toFixed(2)}** — not alarming, but worth keeping an eye on.`
      : `This got a **${sl} impulse score of ${score.impulse_score.toFixed(2)}** — it looks like a planned, intentional purchase.`,
    emphasis: se,
  });

  // 3. Top factors
  const factors = score.factors as Record<string, FactorDetail> | undefined;
  if (factors) {
    const top = topFactors(factors);
    const lines = top.map(([k, d]) => `• ${factorNarrative(k, d)}`).join('\n');
    bubbles.push({
      id: `factors-${i++}`,
      type: 'factors',
      text: `**Top contributing factors:**\n${lines}`,
      emphasis: 'neutral',
    });
  }

  // 4. Decision
  // Use coaching_message if available, otherwise use default explanation
  const decisionText = (score as any).coaching_message
    ? `Monty's decision: **${alertLabel(score.alert_type)}**.\n\n"${(score as any).coaching_message}"`
    : `Monty's decision: **${alertLabel(score.alert_type)}**. ${alertExplanation(score.alert_type)}`;

  bubbles.push({
    id: `decision-${i++}`,
    type: 'decision',
    text: decisionText,
    emphasis: score.alert_type === 'celebrate' ? 'celebrate' : score.impulse_score >= 0.6 ? 'caution' : 'neutral',
  });

  // 4b. AI Justification (if available)
  if ((score as any).ai_justification) {
    bubbles.push({
      id: `ai-${i++}`,
      type: 'insight',
      text: `**AI's reasoning:** ${(score as any).ai_justification}`,
      emphasis: 'neutral',
    });
  }

  // 5. Response
  const resp = responseText(score.child_response);
  bubbles.push({
    id: `resp-${i++}`,
    type: 'response',
    text: resp.text,
    emphasis: resp.emphasis,
  });

  // 6. Insight — compare to average
  if (allScores.length > 1) {
    const avg = allScores.reduce((s, d) => s + d.impulse_score, 0) / allScores.length;
    const diff = score.impulse_score - avg;
    const comparison = diff > 0.1 ? 'higher than' : diff < -0.1 ? 'lower than' : 'about the same as';
    bubbles.push({
      id: `insight-${i++}`,
      type: 'insight',
      text: `For context, this score is **${comparison}** the average of **${avg.toFixed(2)}** across ${allScores.length} tracked events.`,
      emphasis: diff < -0.1 ? 'positive' : diff > 0.1 ? 'caution' : 'neutral',
    });
  }

  return bubbles;
}

// ── Group Narrative ──────────────────────────────────────────────────

export function generateGroupNarrative(
  scores: ApiImpulseScore[],
  label: string,
  context: string,
): NarrativeBubble[] {
  if (scores.length === 0) return [];
  const bubbles: NarrativeBubble[] = [];
  let i = 0;

  const total = scores.reduce((s, d) => s + d.amount, 0);
  const avgScore = scores.reduce((s, d) => s + d.impulse_score, 0) / scores.length;
  const highCount = scores.filter((s) => s.impulse_score >= 0.6).length;
  const waitedCount = scores.filter((s) => s.child_response === 'waited').length;

  // 1. Summary
  bubbles.push({
    id: `grp-summary-${i++}`,
    type: 'context',
    text: `**${label}**: ${scores.length} purchase${scores.length > 1 ? 's' : ''} totaling **$${total.toFixed(2)}**. ${context}`,
    emphasis: 'neutral',
  });

  // 2. Pattern
  bubbles.push({
    id: `grp-pattern-${i++}`,
    type: 'score',
    text: `Average impulse score: **${avgScore.toFixed(2)}** (${scoreLabel(avgScore)}). ${highCount > 0 ? `**${highCount}** flagged as high-impulse.` : 'No high-impulse events in this group.'}`,
    emphasis: scoreEmphasis(avgScore),
  });

  // 3. Insight
  if (scores.length > 1) {
    const resistPct = scores.filter((s) => s.alert_triggered).length > 0
      ? Math.round((waitedCount / scores.filter((s) => s.alert_triggered).length) * 100)
      : 100;
    bubbles.push({
      id: `grp-insight-${i++}`,
      type: 'insight',
      text: waitedCount > 0
        ? `Waited on **${waitedCount}** out of ${scores.filter((s) => s.alert_triggered).length} prompted events (**${resistPct}%** resistance rate).`
        : 'No impulse pauses were triggered in this group.',
      emphasis: resistPct >= 60 ? 'positive' : 'neutral',
    });
  }

  return bubbles;
}

// ── Factor Narrative ─────────────────────────────────────────────────

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  amount_vs_average: 'This factor measures how the purchase amount compares to the child\'s typical spending. Higher amounts relative to their average signal potential impulse behavior.',
  velocity: 'Velocity tracks how quickly purchases are happening. Multiple purchases in a short window is a strong impulse indicator.',
  category_frequency: 'This measures how often the child shops in this product category. Repeated purchases in the same category (especially entertainment) suggest habitual impulse spending.',
  memory_suppression: "Memory suppression checks Monty's stored observations. If the child has a history of waiting or the parent has flagged certain purchases as routine, this factor adjusts accordingly.",
  time_of_day: 'Time-of-day captures when the purchase happens. Evening and late-night purchases (after 7 PM) consistently show higher impulse rates in behavioral research.',
  day_of_week: 'Day-of-week captures weekly patterns. Weekends (especially Saturday evenings) tend to be peak impulse windows for young spenders.',
  goal_impact: 'Goal impact measures how this purchase would affect active savings goals. A $50 purchase when the child is saving for a skateboard is more significant than when no goals are active.',
};

export function generateFactorNarrative(
  factorKey: string,
  allScores: ApiImpulseScore[],
): NarrativeBubble[] {
  const bubbles: NarrativeBubble[] = [];
  let i = 0;
  const meta = FACTOR_META.find((f) => f.key === factorKey);
  const label = meta?.label ?? factorKey;

  // 1. What it is
  bubbles.push({
    id: `fac-desc-${i++}`,
    type: 'context',
    text: `**${label} Factor** (${meta?.weight ?? '?'} of composite score)\n\n${FACTOR_DESCRIPTIONS[factorKey] ?? 'This factor contributes to the overall impulse score.'}`,
    emphasis: 'neutral',
  });

  // 2. Their pattern
  const weights = allScores
    .map((s) => (s.factors as Record<string, FactorDetail> | undefined)?.[factorKey]?.impulse_weight)
    .filter((w): w is number => typeof w === 'number');

  if (weights.length > 0) {
    const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
    const max = Math.max(...weights);
    const maxScore = allScores.find(
      (s) => (s.factors as Record<string, FactorDetail> | undefined)?.[factorKey]?.impulse_weight === max,
    );

    bubbles.push({
      id: `fac-pattern-${i++}`,
      type: 'score',
      text: `Across **${weights.length}** events, the **${label}** factor averaged **${avg.toFixed(2)}**. The highest was **${max.toFixed(2)}**${maxScore ? ` on a **${maxScore.product_name}** purchase ($${maxScore.amount.toFixed(2)}).` : '.'}`,
      emphasis: avg >= 0.5 ? 'caution' : avg >= 0.3 ? 'neutral' : 'positive',
    });
  }

  return bubbles;
}

// ── Flowchart Node Narrative ─────────────────────────────────────────

const NODE_EXPLANATIONS: Record<string, string> = {
  detect: "**Detection Stage** — When a purchase event comes in from the bank API, Monty immediately identifies the product, merchant, amount, and category. This is the raw input before any analysis begins.",
  memory: "**Memory Check** — Monty checks its memory bank for context. Has the parent flagged purchases at this merchant as routine? Is there a pattern of waiting on similar items? Past behavior shapes how aggressively Monty intervenes.",
  score: "**Impulse Scoring** — This is where the math happens. Monty evaluates 7 different behavioral factors — amount, velocity, category, memory, time, day, and goal impact — each weighted by importance, to compute a composite impulse score between 0 and 1.",
  goal: "**Goal Impact Check** — Monty assesses how this purchase would affect active savings goals. Would buying this set back the Skateboard Fund by weeks? Goal-aligned purchases (like buying skateboard parts) get a pass.",
  decision: "**Decision Engine** — Based on the composite score and goal impact, Monty decides what action to take: a full impulse pause (score > 0.6), a gentle nudge (0.35-0.6), a celebration (< 0.35), or silent suppression for known routines.",
  action: "**Action Delivery** — Finally, Monty delivers the intervention. For impulse pauses, it's a full-screen Wait & Win overlay. For gentle nudges, a brief check-in. For celebrations, positive reinforcement. The coaching message is personalized to the specific purchase and the child's history.",
};

export function generateFlowchartNarrative(
  nodeId: string,
  score: ApiImpulseScore,
  decisionLog: ApiDecisionLog | null,
): NarrativeBubble[] {
  const bubbles: NarrativeBubble[] = [];
  let i = 0;

  // 1. Node explanation
  bubbles.push({
    id: `node-explain-${i++}`,
    type: 'context',
    text: NODE_EXPLANATIONS[nodeId] ?? `This is the **${nodeId}** stage of Monty's decision pipeline.`,
    emphasis: 'neutral',
  });

  // 2. What happened at this stage for the latest event
  const { day, date, time } = fmt(score.timestamp);
  if (nodeId === 'detect') {
    bubbles.push({
      id: `node-detail-${i++}`,
      type: 'context',
      text: `For the latest event: a **$${score.amount.toFixed(2)} ${score.product_name}** at **${score.merchant_name}** was detected on ${day}, ${date} at ${time}.`,
      emphasis: 'neutral',
    });
  } else if (nodeId === 'score') {
    bubbles.push({
      id: `node-detail-${i++}`,
      type: 'score',
      text: `The composite score came out to **${score.impulse_score.toFixed(2)}** (${scoreLabel(score.impulse_score)}).`,
      emphasis: scoreEmphasis(score.impulse_score),
    });
    const factors = score.factors as Record<string, FactorDetail> | undefined;
    if (factors) {
      const top = topFactors(factors);
      const lines = top.map(([k, d]) => `• **${factorLabel(k)}**: ${d.impulse_weight.toFixed(2)} — ${d.value}`).join('\n');
      bubbles.push({
        id: `node-factors-${i++}`,
        type: 'factors',
        text: `Top contributing factors:\n${lines}`,
        emphasis: 'neutral',
      });
    }
  } else if (nodeId === 'decision') {
    bubbles.push({
      id: `node-detail-${i++}`,
      type: 'decision',
      text: `Monty chose: **${alertLabel(score.alert_type)}**. ${alertExplanation(score.alert_type)}`,
      emphasis: score.alert_type === 'celebrate' ? 'celebrate' : 'neutral',
    });
  } else if (nodeId === 'action' && decisionLog?.coaching_message) {
    bubbles.push({
      id: `node-detail-${i++}`,
      type: 'decision',
      text: `Coaching message delivered:\n\n"${decisionLog.coaching_message}"`,
      emphasis: 'neutral',
    });
  } else if (nodeId === 'memory' && decisionLog?.ai_justification) {
    bubbles.push({
      id: `node-detail-${i++}`,
      type: 'insight',
      text: `AI justification: ${decisionLog.ai_justification}`,
      emphasis: 'neutral',
    });
  }

  return bubbles;
}

// ── Bold Text Renderer (React helper) ────────────────────────────────

import { createElement } from 'react';

export function renderBoldText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return createElement('strong', { key: i, className: 'font-semibold text-ink' }, part.slice(2, -2));
    }
    return createElement('span', { key: i }, part);
  });
}
