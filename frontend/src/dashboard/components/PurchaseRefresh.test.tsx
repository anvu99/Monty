import { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MontyDataProvider, useMontyData } from '@/api/MontyDataProvider';
import DashboardWrapper from '../DashboardWrapper';

const mocks = vi.hoisted(() => ({ overview: vi.fn(), mounts: vi.fn() }));
vi.mock('@/api/client', () => ({
  fetchFamilies: vi.fn(async () => ({ families: [{ id: 'family', children: [{ id: 'one', name: 'Emma', age: 10 }] }] })),
  fetchFamilyOverview: mocks.overview,
  fetchChildInsights: vi.fn(async () => ({ insights: [] })),
  fetchChildImpulseScores: vi.fn(async () => []), fetchCheckRisk: vi.fn(async () => null),
}));
vi.mock('@/onboarding/OnboardingProvider', () => ({ useOnboarding: () => ({ state: {} }) }));
vi.mock('../DashboardPage', () => ({ default: function ChatProbe() {
  const [message, setMessage] = useState('');
  const { refreshPurchaseData, purchaseDataRevision } = useMontyData();
  useEffect(() => { mocks.mounts(); }, []);
  return <><input aria-label="Active chat" value={message} onChange={(e) => setMessage(e.target.value)} />
    <button onClick={refreshPurchaseData}>Refresh after purchase</button><span>Revision {purchaseDataRevision}</span></>;
} }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.overview.mockResolvedValue({ family_id: 'family', children: [{ id: 'one', name: 'Emma', age: 10 }] });
});
afterEach(cleanup);

it.each([false, true])('retains active chat during background refresh (refresh failure: %s)', async (fails) => {
  render(<MontyDataProvider><DashboardWrapper /></MontyDataProvider>);
  const input = await screen.findByLabelText('Active chat');
  fireEvent.change(input, { target: { value: 'What about the ice cream we discussed?' } });
  if (fails) mocks.overview.mockRejectedValueOnce(new Error('Offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh after purchase' }));
  await waitFor(() => expect(mocks.overview).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('Active chat')).toBe(input);
  expect((input as HTMLInputElement).value).toBe('What about the ice cream we discussed?');
  expect(mocks.mounts).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Revision 1')).toBeTruthy();
});
