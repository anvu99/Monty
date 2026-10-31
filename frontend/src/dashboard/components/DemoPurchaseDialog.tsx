import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { ApiError, createDemoPurchase, retryDemoAssessment, fetchDemoPurchase, type DemoPurchase, type DemoPurchaseInput } from '@/api/client';
import { useMontyData } from '@/api/MontyDataProvider';
import HistoricalBaseline from './HistoricalBaseline';

interface Props { open: boolean; defaultChildId: string; onClose: () => void }
const RANDOM_PURCHASES = [
  { product: 'Game skin', merchant: 'Demo Game Shop', category: 'Gaming & In-App', amount: '14.99' },
  { product: 'School notebook', merchant: 'Demo Bookshop', category: 'Books & Learning', amount: '4.50' },
  { product: 'Basketball', merchant: 'Demo Sports Shop', category: 'Sports & Outdoors', amount: '25.00' },
  { product: 'Chocolate bar', merchant: 'Demo Snack Shop', category: 'Snacks & Treats', amount: '2.50' },
  { product: 'Puzzle', merchant: 'Demo Toy Shop', category: 'Toys & Hobbies', amount: '18.00' },
  { product: 'Hoodie', merchant: 'Demo Clothes Shop', category: 'Apparel', amount: '45.00' },
];
const waiting = (purchase: DemoPurchase) => ['pending', 'processing'].includes(purchase.assessment.status);

export default function DemoPurchaseDialog({ open, defaultChildId, onClose }: Props) {
  const { children, refreshPurchaseData } = useMontyData();
  const [childId, setChildId] = useState(defaultChildId || children[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<DemoPurchaseInput | null>(null);
  const [purchase, setPurchase] = useState<DemoPurchase | null>(null);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [refreshCycle, setRefreshCycle] = useState(0);
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const completed = useRef(new Set<string>());
  const effectiveChild = children.find((child) => child.id === childId);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open, onClose]);

  const applyStatus = useCallback((next: DemoPurchase) => {
    setPurchase(next);
    if (next.assessment.status === 'completed' && !completed.current.has(next.transaction_id)) {
      completed.current.add(next.transaction_id);
      refreshPurchaseData();
    }
  }, [refreshPurchaseData]);

  useEffect(() => {
    if (!open || !purchase || purchase.child_id !== childId) return;
    if (!waiting(purchase) && refreshCycle === 0) return;
    const controller = new AbortController();
    let stopped = false;
    let nextTimer: ReturnType<typeof setTimeout>;
    setTimedOut(false); setStatusError('');
    const deadline = setTimeout(() => {
      stopped = true; controller.abort(); clearTimeout(nextTimer); setTimedOut(true);
    }, 60000);
    async function poll() {
      try {
        const next = await fetchDemoPurchase(purchase!.transaction_id, controller.signal);
        if (stopped) return;
        if (next.child_id !== childId || next.transaction_id !== purchase!.transaction_id) {
          throw new Error('Assessment did not match the saved purchase.');
        }
        applyStatus(next);
        if (waiting(next)) nextTimer = setTimeout(poll, 2000);
        else { stopped = true; clearTimeout(deadline); }
      } catch (err) {
        if (stopped) return;
        stopped = true; clearTimeout(deadline);
        setStatusError(err instanceof Error ? err.message : 'Could not refresh assessment status.');
      }
    }
    nextTimer = setTimeout(poll, refreshCycle ? 0 : 2000);
    return () => { stopped = true; controller.abort(); clearTimeout(nextTimer); clearTimeout(deadline); };
    // Updating status must not restart the one-minute deadline.
  }, [open, purchase?.transaction_id, childId, refreshCycle, applyStatus]);

  async function save(input: Omit<DemoPurchaseInput, 'transaction_id' | 'child_id' | 'currency'>) {
    if (inFlight.current || !effectiveChild) return;
    inFlight.current = true; setBusy(true); setError('');
    const request = intent || { ...input, child_id: childId, currency: 'USD' as const, transaction_id: crypto.randomUUID() };
    setIntent(request); setPurchase(null); setRefreshCycle(0); setStatusError(''); setTimedOut(false);
    try {
      const saved = await createDemoPurchase(request);
      setIntent(null); setPurchase(saved);
      if (saved.assessment.status === 'completed') completed.current.add(saved.transaction_id);
      refreshPurchaseData();
    } catch (err) {
      // Only definitive client errors release the intent. A lost response may
      // follow a successful commit, so network/server retries reuse its UUID.
      if (err instanceof ApiError && [400, 403, 404, 409, 422].includes(err.status)) setIntent(null);
      setError(err instanceof Error ? err.message : 'Could not confirm the purchase. Retry using the same purchase ID.');
    } finally { inFlight.current = false; setBusy(false); }
  }

  if (!open) return null;
  const status = purchase?.assessment;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4">
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="demo-purchase-title"
      className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl outline-none">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Simulated purchase</p>
          <h2 id="demo-purchase-title" className="mt-1 text-xl font-semibold text-ink">Try a purchase with Monty</h2></div>
        <button type="button" onClick={onClose} aria-label="Close demo purchase" className="rounded-full p-2 hover:bg-slate-100"><X size={20} /></button>
      </div>
      <p className="mt-3 text-sm text-slate-500">Adds demo spending to this child’s history. No real money moves, and savings goals stay unchanged.</p>
      <label className="mt-4 block text-sm font-medium">Child
        <select value={childId} disabled={busy || !!intent} onChange={(event) => {
          setChildId(event.target.value); setPurchase(null); setError(''); setStatusError(''); setRefreshCycle(0); setTimedOut(false);
        }} className="mt-1 w-full rounded-xl border p-3">
          {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
        </select>
      </label>
      {effectiveChild && <p className="mt-2 text-xs text-slate-500">Purchases will be recorded for {effectiveChild.name}.</p>}
      <button type="button" disabled={busy || !!intent || !effectiveChild} onClick={() => void save({ product: 'Ice cream', merchant: 'Demo Ice Cream Shop', category: 'food', amount: '10.00' })}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 p-3 font-semibold text-white disabled:opacity-50">
        <ShoppingBag size={18} />{busy ? 'Saving purchase…' : 'Buy $10 ice cream'}
      </button>
      <button type="button" disabled={busy || !!intent || !effectiveChild} onClick={() => void save(RANDOM_PURCHASES[Math.floor(Math.random() * RANDOM_PURCHASES.length)])}
        className="mt-3 w-full rounded-xl border border-teal-600 p-3 font-semibold text-teal-700 disabled:opacity-50">Random purchase</button>
      <form className="mt-5 space-y-3 border-t pt-4" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void save({ product: String(data.get('product')).trim(), merchant: String(data.get('merchant')).trim(),
          category: String(data.get('category')).trim(), amount: String(data.get('amount')) });
      }}>
        <p className="text-sm font-semibold">Or create your own purchase</p>
        <fieldset disabled={busy || !!intent} className="space-y-3">
          {(['product', 'merchant', 'category'] as const).map((name) => <label key={name} className="block text-sm capitalize">{name}
            <input name={name} required maxLength={name === 'product' ? 150 : name === 'merchant' ? 100 : 50}
              defaultValue={name === 'category' ? 'food' : ''} className="mt-1 w-full rounded-xl border p-2" />
          </label>)}
          <label className="block text-sm">Amount (USD)<input name="amount" type="number" required min="0.01" max="99999999.99" step="0.01" className="mt-1 w-full rounded-xl border p-2" /></label>
          <button disabled={!effectiveChild} className="rounded-full border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700 disabled:opacity-50">Create demo purchase</button>
        </fieldset>
      </form>
      {error && <div role="alert" className="mt-4 text-sm text-coral-700"><p>{error}</p>
        {intent && <><p className="mt-1">The purchase may already be saved. Retry to confirm it without creating another.</p>
          <button type="button" disabled={busy} onClick={() => void save(intent)} className="mt-2 rounded-full border px-4 py-2">Retry save</button></>}
      </div>}
      {purchase && status && <section aria-live="polite" className="mt-5 space-y-2 rounded-2xl bg-teal-50 p-4 text-sm">
        <h3 className="font-semibold">Purchase saved</h3>
        <p>{purchase.product} · ${Number(purchase.amount).toFixed(2)} USD · {purchase.merchant}</p>
        <p className="text-xs text-slate-500">{new Date(purchase.timestamp).toLocaleString()} · {purchase.transaction_id}</p>
        {status.status === 'not_connected' && <p>Purchase saved; scoring integration is not connected.</p>}
        {waiting(purchase) && <p>{timedOut ? 'Purchase saved; assessment is still pending.' : status.status === 'processing' ? 'Monty is assessing this purchase…' : 'Waiting for the purchase assessment…'}</p>}
        {status.status === 'failed' && <p>Purchase saved; assessment failed. You can refresh its status later.</p>}
        {status.status === 'completed' && <>
          {status.outcome === 'insufficient_data' && <p className="font-semibold">More context needed</p>}
          {status.explanation && <p>{status.explanation}</p>}
          {status.final_assessment?.historical_assessment_used === true && status.baseline && status.factors.map((factor, index) => <p key={index}><strong>{factor.factor}:</strong> {factor.description}</p>)}
        </>}
        <HistoricalBaseline historicalAssessmentUsed={status.final_assessment?.historical_assessment_used} score={status.baseline?.score} className="font-semibold" />
        {status.final_assessment && <><p className="font-semibold">Monty: {status.final_assessment.decision.replace(/_/g, ' ')}</p><p>{status.final_assessment.conversation_explanation}</p></>}
        {status.status === 'failed' && <button type="button" disabled={busy} onClick={async () => {
          setBusy(true); setStatusError('');
          try { applyStatus(await retryDemoAssessment(purchase.transaction_id)); setRefreshCycle(value => value + 1); }
          catch (err) { setStatusError(err instanceof Error ? err.message : 'Retry failed.'); }
          finally { setBusy(false); }
        }} className="rounded-full border px-3 py-1.5">Retry assessment</button>}
        {statusError && <p role="alert">Purchase saved; {statusError}</p>}
        {(timedOut || statusError || status.status === 'failed' || status.status === 'not_connected') &&
          <button type="button" onClick={() => setRefreshCycle((value) => value + 1)} className="rounded-full border border-teal-700 px-3 py-1.5">Refresh assessment</button>}
      </section>}
    </div>
  </div>;
}
