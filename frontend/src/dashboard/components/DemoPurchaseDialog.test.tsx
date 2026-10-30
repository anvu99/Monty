import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DemoPurchaseDialog from './DemoPurchaseDialog';
import type { DemoPurchase } from '@/api/client';

const mocks = vi.hoisted(() => ({ retry: vi.fn(), create: vi.fn(), fetch: vi.fn(), refresh: vi.fn() }));
vi.mock('@/api/client', () => ({
  retryDemoAssessment: mocks.retry, createDemoPurchase: mocks.create, fetchDemoPurchase: mocks.fetch,
  ApiError: class ApiError extends Error { status = 422; },
}));
vi.mock('@/api/MontyDataProvider', () => ({ useMontyData: () => ({
  children: [{ id: 'one', name: 'Emma' }, { id: 'two', name: 'Lucas' }], refreshPurchaseData: mocks.refresh,
}) }));

const saved = (status: DemoPurchase['assessment']['status'] = 'not_connected'): DemoPurchase => ({
  transaction_id: '321c0bba-e111-4000-8000-000000000001', child_id: 'one', product: 'Ice cream',
  merchant: 'Demo Ice Cream Shop', category: 'food', amount: '10.00', currency: 'USD', source: 'demo',
  timestamp: '2026-10-25T12:00:00Z',
  assessment: { status, assessment_id: null, outcome: null, score: null, factors: [], explanation: null, error: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue(saved());
  mocks.fetch.mockResolvedValue(saved());
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('demo purchases', () => {
  it('saves the preset once for the selected child and does not poll disconnected scoring', async () => {
    let finish!: (purchase: DemoPurchase) => void;
    mocks.create.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<DemoPurchaseDialog open defaultChildId="one" onClose={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Buy $10 ice cream' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ child_id: 'one', product: 'Ice cream', amount: '10.00', currency: 'USD' });
    await act(async () => { finish(saved()); });
    expect(screen.getByText('Purchase saved; scoring integration is not connected.')).toBeTruthy();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the same transaction UUID and payload after an ambiguous save failure', async () => {
    mocks.create.mockRejectedValueOnce(new Error('Network response lost')).mockResolvedValueOnce(saved());
    render(<DemoPurchaseDialog open defaultChildId="one" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Buy $10 ice cream' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry save' }));
    await screen.findByText('Purchase saved; scoring integration is not connected.');
    expect(mocks.create.mock.calls[0][0]).toEqual(mocks.create.mock.calls[1][0]);
    expect(mocks.create.mock.calls[0][0].transaction_id).toBeTruthy();
  });

  it('supports a custom purchase and restricts the child selector to the current family', async () => {
    render(<DemoPurchaseDialog open defaultChildId="one" onClose={vi.fn()} />);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Emma', 'Lucas']);
    fireEvent.change(screen.getByLabelText('Child'), { target: { value: 'two' } });
    fireEvent.change(screen.getByLabelText('product'), { target: { value: 'Book' } });
    fireEvent.change(screen.getByLabelText('merchant'), { target: { value: 'Demo Bookshop' } });
    fireEvent.change(screen.getByLabelText('category'), { target: { value: 'books' } });
    fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '12.50' } });
    mocks.create.mockResolvedValue({ ...saved(), child_id: 'two', product: 'Book' });
    fireEvent.click(screen.getByRole('button', { name: 'Create demo purchase' }));
    await screen.findByText('Purchase saved');
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ child_id: 'two', product: 'Book', merchant: 'Demo Bookshop', category: 'books', amount: '12.50' });
  });

  it('polls a transaction-linked result and refreshes data when scoring completes', async () => {
    vi.useFakeTimers();
    mocks.create.mockResolvedValue(saved('pending'));
    mocks.fetch.mockResolvedValue({ ...saved('completed'), assessment: {
      ...saved('completed').assessment, outcome: 'assessed', score: 65, explanation: 'A contextual assessment',
      factors: [{ factor: 'price', contribution: .4, description: 'Recorded price', evidence_refs: ['transaction'] }],
    } });
    render(<DemoPurchaseDialog open defaultChildId="one" onClose={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buy $10 ice cream' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.fetch.mock.calls[0][0]).toBe(saved().transaction_id);
    expect(screen.getByText('ML baseline: 65/100')).toBeTruthy();
    expect(screen.getByText('Recorded price')).toBeTruthy();
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('stops polling at one minute and supports manual refresh', async () => {
    vi.useFakeTimers();
    mocks.create.mockResolvedValue(saved('pending'));
    mocks.fetch.mockResolvedValue(saved('processing'));
    render(<DemoPurchaseDialog open defaultChildId="one" onClose={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buy $10 ice cream' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(screen.getByText('Purchase saved; assessment is still pending.')).toBeTruthy();
    const calls = mocks.fetch.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(calls);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh assessment' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.fetch.mock.calls.length).toBeGreaterThan(calls);
  });

  it('aborts polling when closed and clears a previous child result when switching children', async () => {
    vi.useFakeTimers();
    mocks.create.mockResolvedValue(saved('pending'));
    mocks.fetch.mockResolvedValue(saved('processing'));
    const close = vi.fn();
    const view = render(<DemoPurchaseDialog open defaultChildId="one" onClose={close} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buy $10 ice cream' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    const signal = mocks.fetch.mock.calls[0][1] as AbortSignal;
    view.rerender(<DemoPurchaseDialog open={false} defaultChildId="one" onClose={close} />);
    expect(signal.aborted).toBe(true);
    const calls = mocks.fetch.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(calls);
    view.rerender(<DemoPurchaseDialog open defaultChildId="one" onClose={close} />);
    fireEvent.change(screen.getByLabelText('Child'), { target: { value: 'two' } });
    expect(screen.queryByText('Purchase saved')).toBeNull();
  });

  it.each(['failed', 'completed'] as const)('stops for terminal %s responses', async (status) => {
    vi.useFakeTimers();
    mocks.create.mockResolvedValue(saved('pending'));
    mocks.fetch.mockResolvedValue({ ...saved(status), assessment: { ...saved(status).assessment,
      outcome: status === 'completed' ? 'insufficient_data' : null } });
    render(<DemoPurchaseDialog open defaultChildId="one" onClose={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Buy $10 ice cream' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(status === 'completed' ? 'More context needed' : 'Purchase saved; assessment failed. You can refresh its status later.')).toBeTruthy();
  });
});


it('keeps a random purchase unchanged when retrying a lost save response', async () => {
  mocks.create.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce(saved());
  render(<DemoPurchaseDialog open defaultChildId="two" onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Random purchase' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry save' }));
  await screen.findByText('Purchase saved');
  expect(mocks.create.mock.calls[0][0]).toEqual(mocks.create.mock.calls[1][0]);
  expect(mocks.create.mock.calls[0][0].child_id).toBe('two');
});

it('retries a failed assessment without creating another purchase', async () => {
  mocks.create.mockResolvedValue(saved('failed'));
  mocks.retry.mockResolvedValue(saved('pending'));
  mocks.fetch.mockResolvedValue(saved('pending'));
  render(<DemoPurchaseDialog open defaultChildId="one" onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Buy $10 ice cream' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry assessment' }));
  await screen.findByText(/Waiting for the purchase assessment/);
  expect(mocks.retry).toHaveBeenCalledWith(saved().transaction_id);
  expect(mocks.create).toHaveBeenCalledTimes(1);
});
