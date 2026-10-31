/**
 * Frontend HTTP-contract test. Gemini/LangChain run on the backend; the HTTP
 * responses here simulate their results and never contact a real model.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DemoPurchase, DemoPurchaseInput, FinalPurchaseAssessment } from '@/api/client';
import DemoPurchaseDialog from './DemoPurchaseDialog';
import FamilyPurchaseUpdates from './FamilyPurchaseUpdates';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('@/api/MontyDataProvider', () => ({
  useMontyData: () => ({
    children: [{ id: 'child', name: 'Emma', age: 10 }],
    purchaseDataRevision: 0,
    refreshPurchaseData: mocks.refresh,
  }),
}));

type AgentResult = FinalPurchaseAssessment & { historical_assessment_used: boolean };
type Scenario = {
  name: string;
  baseline: number;
  final: AgentResult;
};

const scenarios: Scenario[] = [
  {
    name: 'immediate Gemini decision without a historical lookup',
    baseline: 85,
    final: {
      decision: 'not_flagged',
      explanation: 'The child described planning and budgeting for this exact game.',
      conversation_effect: 'baseline_not_requested',
      conversation_explanation: 'Conversation evidence was sufficient; no historical comparison was requested.',
      historical_assessment_used: false,
    },
  },
  {
    name: 'Gemini flags a purchase after consulting history despite a low baseline',
    baseline: 20,
    final: {
      decision: 'potentially_impulsive',
      explanation: 'The child described pressure to buy immediately; a check-in may help.',
      conversation_effect: 'contradicts_baseline',
      conversation_explanation: 'Purchase-specific conversation evidence raises concern despite the low historical baseline.',
      historical_assessment_used: true,
    },
  },
  {
    name: 'Gemini submits insufficient context without a historical lookup',
    baseline: 50,
    final: {
      decision: 'insufficient_context',
      explanation: 'The available evidence does not establish whether this purchase was planned.',
      conversation_effect: 'baseline_not_requested',
      conversation_explanation: 'No historical comparison was requested.',
      historical_assessment_used: false,
    },
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(scenarios)('renders the backend result: $name', async (scenario) => {
  let input: DemoPurchaseInput | undefined;
  let status: 'pending' | 'processing' | 'completed' = 'pending';
  const statusRequests: string[] = [];
  const posted: DemoPurchaseInput[] = [];

  function purchase(): DemoPurchase {
    if (!input) throw new Error('Purchase has not been submitted');
    const result = status === 'completed' ? scenario.final : null;
    return {
      ...input,
      source: 'demo',
      timestamp: '2026-10-31T12:00:00Z',
      assessment: {
        status,
        assessment_id: 'assessment',
        outcome: result ? 'assessed' : null,
        score: result ? scenario.baseline : null,
        baseline: status === 'pending' ? null : {
          score: scenario.baseline,
          risk_level: scenario.baseline >= 70 ? 'HIGH' : scenario.baseline >= 40 ? 'MEDIUM' : 'LOW',
        },
        final_assessment: result,
        explanation: result?.explanation ?? null,
        error: null,
        factors: [],
      },
    };
  }

  // Keep the real API client: mock only the network boundary.
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/demo/purchases' && options?.method === 'POST') {
      input = JSON.parse(String(options.body)) as DemoPurchaseInput;
      posted.push(input);
      return Response.json(purchase(), { status: 201 });
    }
    if (input && url === `/api/demo/purchases/${input.transaction_id}`) {
      statusRequests.push(url);
      return Response.json(purchase());
    }
    if (url === '/api/family/family/purchases?limit=50&offset=0') {
      const saved = input ? purchase() : null;
      return Response.json({
        purchases: saved ? [{
          id: saved.transaction_id,
          child_id: saved.child_id,
          child_name: 'Emma',
          timestamp: saved.timestamp,
          merchant_name: saved.merchant,
          merchant_category: saved.category,
          description: saved.product,
          amount: Number(saved.amount),
          assessment: saved.assessment,
        }] : [],
        has_more: false,
      });
    }
    throw new Error(`Unexpected frontend request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<>
    <DemoPurchaseDialog open defaultChildId="child" onClose={vi.fn()} />
    <FamilyPurchaseUpdates familyId="family" />
  </>);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Random purchase' }));
  });
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({
    child_id: 'child', product: 'Game skin', category: 'Gaming & In-App', currency: 'USD',
  });
  expect(posted[0].transaction_id).toBeTruthy();
  expect(screen.queryByText(/Monty:/)).toBeNull();

  status = 'processing';
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.queryByText(/ML baseline:/)).toBeNull();
  expect(screen.queryByText(/Monty:/)).toBeNull();

  status = 'completed';
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  const decision = `Monty: ${scenario.final.decision.replace(/_/g, ' ')}`;
  expect(screen.getByText(decision)).toBeTruthy();
  expect(screen.getByText(scenario.final.explanation)).toBeTruthy();
  expect(screen.getByText(scenario.final.conversation_explanation)).toBeTruthy();

  // Parent Updates obtains the same result on its five-second refresh.
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(screen.getAllByText(decision)).toHaveLength(2);
  expect(screen.getAllByText(scenario.final.explanation)).toHaveLength(2);
  if (scenario.final.historical_assessment_used) {
    expect(screen.getAllByText(`ML baseline: ${scenario.baseline}/100`)).toHaveLength(2);
  } else {
    expect(screen.queryByText(/ML baseline:/)).toBeNull();
  }
  expect(mocks.refresh).toHaveBeenCalledTimes(2); // Purchase saved, then assessment completed.

  const completedPolls = statusRequests.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(statusRequests).toHaveLength(completedPolls);
  expect(posted).toHaveLength(1);
  expect(new Set(statusRequests)).toEqual(new Set([
    `/api/demo/purchases/${posted[0].transaction_id}`,
  ]));
});
