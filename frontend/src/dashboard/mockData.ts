// Mock data matching the Monty API contract for demo purposes

export const MOCK_FAMILY = {
  id: 'family-001',
  name: 'The Johnsons',
  parentName: 'Sarah',
  kids: [
    { id: 'kid-1', name: 'Emma', age: 10, avatar: 'fox' },
    { id: 'kid-2', name: 'Lucas', age: 7, avatar: 'rabbit' },
  ],
};

export const MOCK_HABIT_SCORES: Record<string, HabitScore> = {
  family: {
    score: 73,
    label: 'Excellent habits!',
    trend: '+8 from Week 1',
    components: {
      savings_streak_days: 14,
      impulse_resistance_rate: 0.67,
      goal_progress_velocity: 0.85,
      spending_consistency: 0.72,
      implementation_intentions_completed: 3,
    },
  },
  'kid-1': {
    score: 78,
    label: 'Excellent habits!',
    trend: '+3 this week',
    components: {
      savings_streak_days: 14,
      impulse_resistance_rate: 0.72,
      goal_progress_velocity: 0.9,
      spending_consistency: 0.75,
      implementation_intentions_completed: 4,
    },
  },
  'kid-2': {
    score: 68,
    label: 'Building momentum',
    trend: 'steady',
    components: {
      savings_streak_days: 7,
      impulse_resistance_rate: 0.6,
      goal_progress_velocity: 0.7,
      spending_consistency: 0.65,
      implementation_intentions_completed: 2,
    },
  },
};

export const MOCK_GOALS: Goal[] = [
  {
    id: 'goal-1',
    childId: 'kid-1',
    childName: 'Emma',
    childAvatar: 'fox',
    name: 'Skateboard',
    emoji: '\u{1F6F9}',
    currentAmount: 68,
    targetAmount: 120,
    weeklyContribution: 10,
    startDate: '2026-01-01',
    targetDate: '2026-03-15',
    status: 'on_track',
  },
  {
    id: 'goal-2',
    childId: 'kid-1',
    childName: 'Emma',
    childAvatar: 'fox',
    name: 'Gaming Fund',
    emoji: '\u{1F3AE}',
    currentAmount: 12,
    targetAmount: 60,
    weeklyContribution: 5,
    startDate: '2026-01-15',
    targetDate: '2026-04-15',
    status: 'on_track',
  },
  {
    id: 'goal-3',
    childId: 'kid-2',
    childName: 'Lucas',
    childAvatar: 'rabbit',
    name: 'LEGO Set',
    emoji: '\u{1F9F1}',
    currentAmount: 18,
    targetAmount: 60,
    weeklyContribution: 5,
    startDate: '2026-01-10',
    targetDate: '2026-04-01',
    status: 'behind',
  },
];

export const MOCK_ACTIVITY: Activity[] = [
  {
    id: 'act-1',
    childId: 'kid-1',
    childName: 'Emma',
    childAvatar: 'fox',
    type: 'impulse_resisted',
    icon: '\u{1F3A7}',
    title: 'Waited on headphones',
    subtitle: 'Monty suggested waiting',
    timestamp: '2 hours ago',
    amountSaved: 45,
  },
  {
    id: 'act-2',
    childId: 'kid-2',
    childName: 'Lucas',
    childAvatar: 'rabbit',
    type: 'goal_contribution',
    icon: '\u{1F4B0}',
    title: 'Added $5 to LEGO goal',
    subtitle: 'Allowance deposit',
    timestamp: 'Yesterday',
  },
  {
    id: 'act-3',
    childId: 'kid-1',
    childName: 'Emma',
    childAvatar: 'fox',
    type: 'streak_milestone',
    icon: '\u{1F525}',
    title: 'Reached 14-day streak',
    subtitle: 'Longest streak yet!',
    timestamp: 'Today',
  },
  {
    id: 'act-4',
    childId: 'kid-1',
    childName: 'Emma',
    childAvatar: 'fox',
    type: 'challenge_completed',
    icon: '\u{1F37D}\u{FE0F}',
    title: 'Completed "Pack Lunch" challenge',
    subtitle: 'Earned $15 bonus',
    timestamp: '2 days ago',
  },
  {
    id: 'act-5',
    childId: 'kid-2',
    childName: 'Lucas',
    childAvatar: 'rabbit',
    type: 'browsing',
    icon: '\u{1F440}',
    title: 'Browsed on Amazon',
    subtitle: 'No purchase made',
    timestamp: 'Yesterday',
  },
];

export const MOCK_INSIGHTS: Insight[] = [
  {
    id: 'ins-1',
    childId: 'kid-1',
    childName: 'Emma',
    type: 'positive',
    icon: '\u{1F3AF}',
    title: 'Positive Pattern',
    description:
      "Emma's impulse rate dropped from 6/week to 2/week since starting her skateboard goal",
    impact: 'High',
    confidence: 94,
    action: 'Send Congrats',
  },
  {
    id: 'ins-2',
    childId: 'kid-2',
    childName: 'Lucas',
    type: 'opportunity',
    icon: '\u{1F4A1}',
    title: 'Opportunity',
    description:
      "Lucas asks about items but rarely follows through. Great impulse control! Consider celebrating this.",
    impact: 'Medium',
    confidence: 82,
    action: 'Send Congrats',
  },
  {
    id: 'ins-3',
    childId: 'kid-1',
    childName: 'Emma',
    type: 'pattern',
    icon: '\u{1F4CA}',
    title: 'Pattern Detected',
    description:
      "Emma shops primarily 8-10pm on school nights. Try: 'Morning check-in' rule for evening carts",
    impact: 'Medium',
    confidence: 88,
    action: 'Create Rule',
  },
  {
    id: 'ins-4',
    childId: 'kid-2',
    childName: 'Lucas',
    type: 'risk',
    icon: '\u{26A0}\u{FE0F}',
    title: 'Risk Pattern',
    description:
      "Lucas hasn't added to his LEGO fund in 2 weeks. Goal timeline is slipping.",
    impact: 'Medium',
    confidence: 76,
    action: 'Message Lucas',
  },
];

export const MOCK_MEMORIES: Memory[] = [
  {
    id: 'mem-1',
    childId: 'kid-1',
    type: 'user_response',
    content: 'Chipotle every Saturday is family dinner \u2014 non-negotiable',
    createdAt: '2026-01-20',
    suppressAlerts: true,
  },
  {
    id: 'mem-2',
    childId: 'kid-1',
    type: 'spending_pattern',
    content: 'Tends to impulse-buy on Amazon between 8-10pm on weekdays',
    createdAt: '2026-01-25',
    suppressAlerts: false,
  },
  {
    id: 'mem-3',
    childId: 'kid-1',
    type: 'habit_observation',
    content: 'Has been packing lunch 4/5 days since starting implementation plan',
    createdAt: '2026-02-03',
    suppressAlerts: false,
  },
  {
    id: 'mem-4',
    childId: 'kid-1',
    type: 'goal_update',
    content: 'Skateboard is primary focus, willing to delay other wants',
    createdAt: '2026-02-05',
    suppressAlerts: false,
  },
];

export const MOCK_DECISIONS: Decision[] = [
  {
    id: 'dec-1',
    childId: 'kid-1',
    timestamp: 'Feb 7, 3:42pm',
    item: 'Sony Headphones',
    icon: '\u{1F3A7}',
    amount: 45,
    montyAction: 'Impulse pause',
    montyMessage: 'This is 37% of skateboard',
    childResponse: 'waited',
    amountSaved: 45,
  },
  {
    id: 'dec-2',
    childId: 'kid-1',
    timestamp: 'Feb 6, 8:15pm',
    item: 'Fortnite V-Bucks',
    icon: '\u{1F3AE}',
    amount: 10,
    montyAction: 'Gentle check-in',
    montyMessage: 'Using gaming fund?',
    childResponse: 'proceeded',
  },
  {
    id: 'dec-3',
    childId: 'kid-1',
    timestamp: 'Feb 5, 2:30pm',
    item: 'Candy',
    icon: '\u{1F36B}',
    amount: 3.5,
    montyAction: 'No intervention',
    montyMessage: 'Below threshold',
    childResponse: 'purchased',
  },
];

export const MOCK_SPENDING_CATEGORIES = {
  food: { sum: 89.5, count: 12, mean: 7.46 },
  entertainment: { sum: 62.97, count: 3, mean: 20.99 },
  clothing: { sum: 37.0, count: 2, mean: 18.5 },
};

export const MOCK_WEEKLY_SPENDING = [
  { week: 'W1', amount: 32 },
  { week: 'W2', amount: 41 },
  { week: 'W3', amount: 55 },
  { week: 'W4', amount: 38 },
  { week: 'W5', amount: 44 },
  { week: 'W6', amount: 29 },
  { week: 'W7', amount: 35 },
];

export const MOCK_HABIT_TREND = [
  { week: 'W1', family: 45, emma: 48, lucas: 42 },
  { week: 'W2', family: 50, emma: 54, lucas: 46 },
  { week: 'W3', family: 56, emma: 60, lucas: 52 },
  { week: 'W4', family: 60, emma: 64, lucas: 56 },
  { week: 'W5', family: 65, emma: 70, lucas: 60 },
  { week: 'W6', family: 70, emma: 74, lucas: 66 },
  { week: 'W7', family: 73, emma: 78, lucas: 68 },
];

export const MOCK_PIPELINE = {
  nodes: [
    { id: 'detect', label: 'Product: Sony Headphones - $45.00 on Amazon', type: 'input' as const },
    { id: 'memory', label: 'No suppression \u2014 Amazon not in non-negotiable list', type: 'check' as const },
    { id: 'score', label: 'Impulse Score: 0.78 (HIGH)', type: 'process' as const },
    { id: 'goal', label: 'Impact: 87% of remaining Skateboard Fund', type: 'process' as const },
    { id: 'decision', label: 'Decision: IMPULSE PAUSE', type: 'decision' as const },
    { id: 'action', label: 'Show overlay with Wait & Win offer + goal comparison', type: 'output' as const },
  ],
  edges: [
    { from: 'detect', to: 'memory' },
    { from: 'memory', to: 'score' },
    { from: 'score', to: 'goal' },
    { from: 'goal', to: 'decision' },
    { from: 'decision', to: 'action' },
  ],
};

export const MOCK_STREAK = {
  currentDays: 14,
  longestDays: 20,
  lastActivityDate: '2026-02-07',
  calendar: [
    // last 21 days: true = active, false = missed
    true, true, true, true, true, true, true,
    true, true, true, true, true, true, true,
    false, false, false, false, false, false, false,
  ],
};

export const MOCK_BADGES: Badge[] = [
  { id: 'b1', name: 'First Goal', emoji: '\u{1F3AF}', description: 'Create your first goal', earned: true, earnedDate: '2026-01-01' },
  { id: 'b2', name: 'Wait & Win', emoji: '\u{1F4AA}', description: 'Resist 10 impulse buys', earned: true, earnedDate: '2026-01-28' },
  { id: 'b3', name: 'Week Warrior', emoji: '\u{1F525}', description: '7-day streak', earned: true, earnedDate: '2026-02-01' },
  { id: 'b4', name: 'Super Saver', emoji: '\u{2B50}', description: 'Save $100 total', earned: true, earnedDate: '2026-02-04' },
  { id: 'b5', name: 'Goal Crusher', emoji: '\u{1F3C6}', description: 'Complete 3 goals', earned: false },
  { id: 'b6', name: 'Diamond Hands', emoji: '\u{1F48E}', description: '30-day streak', earned: false },
  { id: 'b7', name: 'Momentum', emoji: '\u{1F4C8}', description: '5 weeks consistent', earned: false },
  { id: 'b8', name: 'Big Win', emoji: '\u{1F389}', description: 'Reach a goal over $200', earned: false },
];

export const MOCK_RECENT_WINS: RecentWin[] = [
  { id: 'w1', text: 'Waited on candy', reward: '+$3', icon: '\u{1F4B0}', timestamp: '2 hours ago' },
  { id: 'w2', text: 'Packed lunch 5x', reward: '+$15', icon: '\u{1F389}', timestamp: 'Yesterday' },
  { id: 'w3', text: 'Reached 2 week streak', reward: '+1\u{1F525}', icon: '\u{1F525}', timestamp: 'Today' },
];

export const MOCK_STATS_OVERVIEW = {
  totalSaved: 103,
  totalSavedDelta: '+$23',
  impulseResist: 87,
  impulseResistDelta: '+5%',
  badgesEarned: 12,
  badgesEarnedDelta: '+3',
  impulsePauses: 18,
  impulsePausesDelta: 'Same',
  activeGoals: 3,
  activeGoalsDelta: '+1',
  streakRate: 92,
  streakRateDelta: '+3%',
};

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  { id: 'c1', from: 'monty', text: "Hi Emma! How can I help you today?", timestamp: '3:00 PM' },
];

// Types
export interface HabitScore {
  score: number;
  label: string;
  trend: string;
  components: {
    savings_streak_days: number;
    impulse_resistance_rate: number;
    goal_progress_velocity: number;
    spending_consistency: number;
    implementation_intentions_completed: number;
  };
}

export interface Goal {
  id: string;
  childId: string;
  childName: string;
  childAvatar: string;
  name: string;
  emoji: string;
  currentAmount: number;
  targetAmount: number;
  weeklyContribution: number;
  startDate: string;
  targetDate: string;
  status: 'on_track' | 'behind' | 'at_risk' | 'completed';
}

export interface Activity {
  id: string;
  childId: string;
  childName: string;
  childAvatar: string;
  type: string;
  icon: string;
  title: string;
  subtitle: string;
  timestamp: string;
  amountSaved?: number;
}

export interface Insight {
  id: string;
  childId: string;
  childName: string;
  type: 'positive' | 'risk' | 'opportunity' | 'pattern' | 'learning';
  icon: string;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  action: string;
}

export interface Memory {
  id: string;
  childId: string;
  type: 'spending_pattern' | 'user_response' | 'goal_update' | 'habit_observation';
  content: string;
  createdAt: string;
  suppressAlerts: boolean;
}

export interface Decision {
  id: string;
  childId: string;
  timestamp: string;
  item: string;
  icon: string;
  amount: number;
  montyAction: string;
  montyMessage: string;
  childResponse: 'waited' | 'proceeded' | 'purchased' | 'delayed';
  amountSaved?: number;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earned: boolean;
  earnedDate?: string;
}

export interface RecentWin {
  id: string;
  text: string;
  reward: string;
  icon: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  from: 'monty' | 'kid';
  text: string;
  timestamp: string;
  suggestions?: string[];
}
