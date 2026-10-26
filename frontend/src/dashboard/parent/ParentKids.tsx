import { useEffect, useRef, useState } from 'react';
import { Users, Moon, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import SavingsGoalCard from '../components/SavingsGoalCard';
import SpendingCategoryChart from '../components/SpendingCategoryChart';
import { useMontyData } from '@/api/MontyDataProvider';
import { fetchChildSpending, fetchChildTransactions, type ApiSpending, type ApiTransaction } from '@/api/client';
import { transformOverviewGoal } from '@/api/transforms';

const KID_COLORS = ['bg-teal-500', 'bg-lilac-500', 'bg-coral-500', 'bg-amber-500'];

function KidDetails({ childId }: { childId: string }) {
  const [spending, setSpending] = useState<ApiSpending | null>(null);
  const [spendingLoading, setSpendingLoading] = useState(true);
  const [spendingError, setSpendingError] = useState<string | null>(null);
  const [spendingAttempt, setSpendingAttempt] = useState(0);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const historyPanel = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(true);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    setSpendingLoading(true);
    setSpendingError(null);
    fetchChildSpending(childId).then(data => { if (active) setSpending(data); })
      .catch(err => { if (active) setSpendingError(err instanceof Error ? err.message : 'Unable to load spending.'); })
      .finally(() => { if (active) setSpendingLoading(false); });
    return () => { active = false; };
  }, [childId, spendingAttempt]);

  async function loadTransactions(offset: number) {
    if (inFlight.current) return;
    inFlight.current = true;
    setTransactionLoading(true);
    setTransactionError(null);
    try {
      const data = await fetchChildTransactions(childId, offset);
      if (!mounted.current) return;
      setTransactions(previous => offset === 0 ? data.transactions : [...previous, ...data.transactions]);
      setHasMore(data.has_more);
    } catch (err) {
      if (mounted.current) setTransactionError(err instanceof Error ? err.message : 'Unable to load transactions.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setTransactionLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    // Each child mounts a fresh details view, so requests cannot update another child.
    let active = true;
    setTransactionLoading(true);
    fetchChildTransactions(childId).then(data => {
      if (active) { setTransactions(data.transactions); setHasMore(data.has_more); }
    }).catch(err => {
      if (active) setTransactionError(err instanceof Error ? err.message : 'Unable to load transactions.');
    }).finally(() => { if (active) setTransactionLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, [childId]);

  const categories = spending?.categories ?? {};
  const indicators = spending?.impulse_indicators;
  return (
    <>
      <section aria-label="Spending categories">
        {spendingLoading ? <p role="status" className="text-sm text-slate-500">Loading spending...</p>
          : spendingError ? <p role="alert" className="text-sm text-coral-700">{spendingError} <button className="underline" onClick={() => setSpendingAttempt(a => a + 1)}>Retry</button></p>
          : Object.keys(categories).length ? <SpendingCategoryChart categories={categories} />
          : <p className="text-sm text-slate-500">No spending recorded yet.</p>}
      </section>
      {!spendingLoading && !spendingError && indicators && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[{ label: 'Evening Purchases', value: indicators.evening_pct, Icon: Moon },
            { label: 'Weekend Purchases', value: indicators.weekend_pct, Icon: Calendar }].map(({ label, value, Icon }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
              <Icon className="h-5 w-5 text-lilac-500" />
              <div><p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
                <p className="font-mono text-base font-bold text-ink">{value}%</p></div>
            </div>
          ))}
        </div>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink">Transaction History</h2>
          {(transactions.length > 10 || hasMore) && (
            <button
              type="button"
              aria-expanded={historyExpanded}
              aria-controls={`transaction-history-${childId}`}
              onClick={() => {
                if (historyPanel.current) historyPanel.current.scrollTop = 0;
                setHistoryExpanded(expanded => !expanded);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink/40"
            >
              {historyExpanded ? 'Show latest 10' : 'Expand history'}
              {historyExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        {!historyExpanded && transactions.length > 10 && <p className="mb-2 text-xs text-slate-500">Latest 10 transactions</p>}
        <div
          id={`transaction-history-${childId}`}
          ref={historyPanel}
          role={historyExpanded ? 'region' : undefined}
          aria-label={historyExpanded ? 'Scrollable transaction history' : undefined}
          tabIndex={historyExpanded ? 0 : undefined}
          className={historyExpanded ? 'max-h-96 space-y-2 overflow-y-auto overscroll-contain pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500' : 'space-y-2'}
        >
          {(historyExpanded ? transactions : transactions.slice(0, 10)).map(transaction => (
            <article key={transaction.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
              <div className="min-w-0">
                <p title={transaction.merchant_name} className="truncate text-sm font-medium text-ink">{transaction.merchant_name}</p>
                <div className="flex flex-wrap gap-x-2 text-xs text-slate-500">
                  <span>{transaction.merchant_category}</span>
                  <time dateTime={transaction.timestamp} title={new Date(transaction.timestamp).toLocaleString()}>{new Date(transaction.timestamp).toLocaleDateString()}</time>
                </div>
              </div>
              <span className="shrink-0 font-mono text-sm text-ink">{transaction.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
            </article>
          ))}
          {transactionLoading && <p role="status" className="text-sm text-slate-500">Loading transactions...</p>}
          {transactionError && <p role="alert" className="text-sm text-coral-700">{transactionError} <button className="underline" disabled={transactionLoading} onClick={() => loadTransactions(transactions.length)}>Retry</button></p>}
          {!transactionLoading && !transactionError && transactions.length === 0 && <p className="text-sm text-slate-500">No transactions recorded yet.</p>}
          {historyExpanded && hasMore && !transactionError && <button disabled={transactionLoading} onClick={() => loadTransactions(transactions.length)} className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold text-ink disabled:opacity-50">Load more</button>}
        </div>
      </section>
    </>
  );
}

export default function ParentKids() {
  const { overview, loading, error, refetch } = useMontyData();
  const children = overview?.children ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedChild = children.find(child => child.id === selectedId) ?? children[0];
  if (loading) return <p role="status" className="text-sm text-slate-500">Loading children...</p>;
  if (error) return <p role="alert">{error} <button onClick={refetch}>Retry</button></p>;
  if (!selectedChild) return <p className="text-sm text-slate-500">No children to show yet.</p>;
  const goals = selectedChild.goals.map(goal => transformOverviewGoal(goal, selectedChild.id, selectedChild.name));

  return (
    <div className="space-y-6 pb-24">
      <div>
        <div className="mb-1 flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" /><p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Kid Details</p></div>
        <h1 className="mb-4 font-display text-xl font-semibold text-ink sm:text-2xl">{selectedChild.name}'s Dashboard</h1>
        <div className="flex flex-wrap gap-2" aria-label="Select child">
          {children.map((child, idx) => (
            <button key={child.id} aria-pressed={selectedChild.id === child.id} onClick={() => setSelectedId(child.id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${selectedChild.id === child.id ? 'bg-ink text-mist shadow-lift' : 'border border-ink/20 text-ink hover:border-ink/40'}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${KID_COLORS[idx % KID_COLORS.length]}`}>{child.name.charAt(0).toUpperCase()}</span>
              {child.name}<span className="font-mono text-[10px] opacity-60">({child.age})</span>
            </button>
          ))}
        </div>
      </div>
      <section>
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">Goals Progress</h2>
        <div className="space-y-3">{goals.length ? goals.map(goal => <SavingsGoalCard key={goal.id} goal={goal} />) : <p className="text-sm text-slate-500">No goals yet.</p>}</div>
      </section>
      <KidDetails key={selectedChild.id} childId={selectedChild.id} />
    </div>
  );
}
