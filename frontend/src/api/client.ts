// API client — all backend fetch functions

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

// ---- Discovery ----

export interface ApiChild {
  id: string;
  name: string;
  age: number;
}

export interface ApiFamily {
  id: string;
  children: ApiChild[];
}

export function fetchFamilies() {
  return get<{ families: ApiFamily[] }>('/families');
}

export function selectFamilyByKidCount(kidCount: number) {
  return get<{ family_id: string; children: ApiChild[] }>(`/families/select-by-kid-count/${kidCount}`);
}

// ---- Family Overview (parent dashboard) ----

export interface ApiGoalResponse {
  name: string;
  current_amount: number;
  target_amount: number;
  pct_complete?: number;
  weeks_remaining?: number;
}

export interface ApiFamilyMember {
  id: string;
  name: string;
  age: number;
  habit_score: {
    score: number;
    components: {
      savings_streak_days: number;
      impulse_resistance_rate: number;
      goal_progress_velocity: number;
      spending_consistency: number;
      implementation_intentions_completed: number;
    };
  };
  goals: ApiGoalResponse[];
  streak: { current_days: number; companion_state: string };
  recent_decisions: ApiDecisionLog[];
  memories: ApiMemory[];
}

export interface ApiFamilyOverview {
  family_id: string;
  children: ApiFamilyMember[];
}

export function fetchFamilyOverview(familyId: string) {
  return get<ApiFamilyOverview>(`/family/${familyId}/overview`);
}

// ---- Child endpoints ----

export interface ApiSavingsGoal {
  id: string;
  child_id: string;
  nessie_account_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  weekly_contribution: number;
  created_at: string;
}

export function fetchChildGoals(childId: string) {
  return get<{ goals: ApiSavingsGoal[] }>(`/child/${childId}/goals`);
}

export function createGoal(childId: string, name: string, targetAmount: number, weeklyContribution: number) {
  return post<ApiSavingsGoal>(`/child/${childId}/goals`, {
    name,
    target_amount: targetAmount,
    weekly_contribution: weeklyContribution,
  });
}

export function updateGoal(childId: string, goalId: string, updates: Partial<{name: string; target_amount: number; weekly_contribution: number}>) {
  return post<ApiSavingsGoal>(`/child/${childId}/goals/${goalId}`, updates);
}

export function addMoneyToGoal(childId: string, goalId: string, amount: number) {
  return post<ApiSavingsGoal>(`/child/${childId}/goals/${goalId}/add-money`, { amount });
}

export interface ApiSpending {
  child_id?: string;
  categories?: Record<string, { sum: number; count: number; mean: number }>;
  weekly_trend?: { week: string; total: number }[];
  bursts?: unknown[];
  recurring?: unknown[];
  impulse_indicators?: { evening_pct: number; weekend_pct: number };
}

export function fetchChildSpending(childId: string) {
  return get<ApiSpending>(`/child/${childId}/spending`);
}

export function fetchChildInsights(childId: string) {
  return get<{ insights: string[] }>(`/child/${childId}/insights`);
}

export interface ApiStreak {
  id?: string;
  child_id?: string;
  current_days: number;
  longest_days: number;
  last_updated?: string;
  last_reset_date?: string | null;
  companion_state: string;
}

export function fetchChildStreak(childId: string) {
  return get<ApiStreak>(`/child/${childId}/streak`);
}

export interface ApiImpulseScore {
  id: string;
  child_id: string;
  timestamp: string;
  product_name: string;
  amount: number;
  merchant_name: string;
  merchant_category: string;
  impulse_score: number;
  factors: Record<string, { value: string; impulse_weight: number }>;
  alert_triggered: boolean;
  alert_type: string;
  child_response: string | null;
}

export function fetchChildImpulseScores(childId: string) {
  return get<ApiImpulseScore[]>(`/child/${childId}/impulse-scores`);
}

export interface ApiMemory {
  id: string;
  child_id: string;
  created_at: string;
  memory_type: string;
  content: string;
  category?: string;
  merchant_name?: string;
  suppress_alerts: boolean;
  suppress_until?: string | null;
  confidence?: number;
}

export function fetchChildMemories(childId: string) {
  return get<{ memories: ApiMemory[] }>(`/child/${childId}/memories`);
}

export interface ApiDecisionLog {
  id: string;
  timestamp: string;
  trigger: string;
  impulse_score?: number;
  decision: string;
  coaching_message?: string;
  ai_justification?: string;
  child_response: string | null;
  factors?: Record<string, { value: string; impulse_weight: number }>;
  pipeline_nodes?: unknown;
  pipeline_edges?: unknown;
}

export function fetchDecisionLog(childId: string) {
  return get<{ latest: ApiDecisionLog | null; history: ApiDecisionLog[] }>(
    `/flowchart/${childId}/decision-log`,
  );
}

// ---- Coaching ----

export interface ApiChatResponse {
  message: string;
  suggested_intention?: { trigger_situation: string; planned_action: string } | null;
  memory_updated: boolean;
}

export function sendChatMessage(childId: string, message: string, context?: string) {
  return post<ApiChatResponse>('/coaching/chat', { child_id: childId, message, context });
}

// ---- Proactive Nudge ----

export interface ApiProactiveNudge {
  has_nudge: boolean;
  message: string | null;
  saving_tip: string | null;
  prediction: {
    item: string;
    merchant: string;
    amount: number;
    confidence: number;
  } | null;
}

export function fetchProactiveNudge(childId: string) {
  return get<ApiProactiveNudge>(`/coaching/proactive-nudge/${childId}`);
}

// ---- Proactive Risk Check ----

export interface ApiRiskFactor {
  factor: string;
  contribution: number;
  description: string;
}

export interface ApiRiskScore {
  risk_score: number;
  risk_level: string;
  factors: ApiRiskFactor[];
  timestamp?: string;
}

export interface ApiPrediction {
  type: string;
  risk_level: string;
  confidence: number;
  message: string;
  action_suggestion: string;
  risk_window_start?: string;
  risk_window_end?: string;
  pattern_data?: Record<string, unknown>;
}

export interface ApiActiveAlert {
  alert_id: string;
  type: string;
  risk_level: string;
  confidence: number;
  message: string;
  action_suggestion?: string;
}

export interface ApiCheckRiskResponse {
  current_risk_score: ApiRiskScore;
  predictions: ApiPrediction[];
  active_alerts: ApiActiveAlert[];
}

export function fetchCheckRisk(childId: string) {
  return get<ApiCheckRiskResponse>(`/extension/check-risk?child_id=${childId}`);
}

export function dismissAlert(alertId: string) {
  return post<{ status: string; dismissed: boolean }>(
    `/extension/dismiss-alert?alert_id=${alertId}`,
    {},
  );
}

// ---- Implementation Intentions ----

export interface ApiIntention {
  id: string;
  child_id: string;
  trigger_situation: string;
  planned_action: string;
  status: string;
  success_count: number;
  total_triggered: number;
}

export interface ApiIntentionSuggestion {
  trigger_situation: string;
  planned_action: string;
}

export function fetchIntentions(childId: string) {
  return get<{ intentions: ApiIntention[]; suggestions: ApiIntentionSuggestion[] }>(
    `/child/${childId}/implementation-intentions`,
  );
}

export function createIntention(childId: string, trigger: string, action: string) {
  return post<ApiIntention>(`/child/${childId}/implementation-intentions`, {
    trigger_situation: trigger,
    planned_action: action,
  });
}

// ---- Live Feed (Real-time polling) ----

export interface ApiLiveFeed {
  new_impulse_scores: ApiImpulseScore[];
  proactive_predictions: ApiPrediction[];
  should_wait: boolean;
  wait_message?: string;
  wait_duration_seconds?: number;
}

export function fetchLiveFeed(childId: string, since?: string) {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return get<ApiLiveFeed>(`/child/${childId}/live-feed${query}`);
}
