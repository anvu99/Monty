import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PurchaseNotifications from './PurchaseNotifications';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), read: vi.fn() }));
vi.mock('@/api/client', () => ({ fetchPurchaseNotifications: mocks.fetch, markPurchaseNotificationRead: mocks.read }));
vi.mock('@/api/MontyDataProvider', () => ({ useMontyData: () => ({ purchaseDataRevision: 0 }) }));

const row = { id: 'notification', transaction_id: 'purchase', child_name: 'Emma', product: 'Game',
  merchant: 'Game Shop', amount: '10.00', currency: 'USD', explanation: 'This purchase may warrant a check-in.',
  baseline_score: 20, created_at: '2026-10-30T12:00:00Z', read_at: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue({ notifications: [row], unread_count: 1, has_more: false });
  mocks.read.mockResolvedValue({ id: row.id, read_at: '2026-10-30T12:01:00Z' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('shows the Gemini alert and separate baseline, and persists read state through the API', async () => {
  render(<PurchaseNotifications familyId="family" />);
  expect(await screen.findByText('Emma: Game')).toBeTruthy();
  expect(screen.getByText(/ML baseline: 20\/100/)).toBeTruthy();
  mocks.fetch.mockResolvedValue({ notifications: [{ ...row, read_at: '2026-10-30T12:01:00Z' }], unread_count: 0, has_more: false });
  fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
  await screen.findByText('Purchase notifications · 0 unread');
  expect(mocks.read).toHaveBeenCalledWith('family', 'notification');
  expect(screen.queryByRole('button', { name: 'Mark as read' })).toBeNull();
});

it('polls every five seconds and stops after unmount', async () => {
  vi.useFakeTimers();
  const view = render(<PurchaseNotifications familyId="family" />);
  await act(async () => {});
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  view.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});
