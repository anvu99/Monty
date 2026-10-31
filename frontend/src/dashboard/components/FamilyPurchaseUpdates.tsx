import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { useMontyData } from '@/api/MontyDataProvider';
import { fetchFamilyPurchases, type ApiFamilyPurchase } from '@/api/client';
import HistoricalBaseline from './HistoricalBaseline';

const PAGE_SIZE = 50;
const REFRESH_INTERVAL = 5_000;

export default function FamilyPurchaseUpdates({ familyId }: { familyId: string }) {
  const { purchaseDataRevision } = useMontyData();
  useEffect(() => { request.current?.(); }, [purchaseDataRevision]);
  const [purchases, setPurchases] = useState<ApiFamilyPurchase[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);
  const request = useRef<((more?: boolean) => void) | null>(null);

  useLayoutEffect(() => {
    if (panel.current && pendingScroll.current !== null) {
      panel.current.scrollTop = pendingScroll.current;
      pendingScroll.current = null;
    }
  }, [purchases]);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let loadedPages = 1;
    let retryMore = false;

    async function load(more = false) {
      if (!active || inFlight) return;
      inFlight = true;
      setBusy(true);
      setError(null);
      const targetPages = loadedPages + (more ? 1 : 0);
      try {
        // Reload the whole visible window so new purchases cannot shift offsets
        // between refreshes and Load more, causing duplicates or missing rows.
        const next: ApiFamilyPurchase[] = [];
        let nextHasMore = false;
        let fetchedPages = 0;
        for (let page = 0; page < targetPages; page += 1) {
          const result = await fetchFamilyPurchases(familyId, page * PAGE_SIZE);
          if (!active) return;
          next.push(...result.purchases);
          nextHasMore = result.has_more;
          fetchedPages += 1;
          if (!nextHasMore) break;
        }
        // Offset pages can overlap if a purchase arrives between page requests.
        const unique = [...new Map(next.map(purchase => [purchase.id, purchase])).values()];
        pendingScroll.current = panel.current?.scrollTop ?? 0;
        setPurchases(unique);
        setHasMore(nextHasMore);
        setLoaded(true);
        loadedPages = fetchedPages;
        retryMore = false;
      } catch (err) {
        if (active) {
          retryMore = more;
          setError(err instanceof Error ? err.message : 'Unable to load purchase updates.');
        }
      } finally {
        inFlight = false;
        if (active) setBusy(false);
      }
    }

    request.current = (more = retryMore) => { void load(more); };
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_INTERVAL);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      request.current = null;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [familyId]);

  return (
    <section aria-labelledby={`${panelId}-heading`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-slate-400" />
          <h2 id={`${panelId}-heading`} className="font-display text-lg font-semibold text-ink">Updates</h2>
        </div>
        {(purchases.length > 5 || hasMore) && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => {
              if (panel.current) panel.current.scrollTop = 0;
              setExpanded(value => !value);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink/40"
          >
            {expanded ? 'Show latest 5' : 'Expand updates'}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        {!expanded && purchases.length > 5 && <p className="mb-2 text-xs text-slate-500">Latest 5 purchases</p>}
        <div
          id={panelId}
          ref={panel}
          role={expanded ? 'region' : undefined}
          aria-label={expanded ? 'Scrollable purchase updates' : undefined}
          tabIndex={expanded ? 0 : undefined}
          className={expanded ? 'max-h-96 space-y-2 overflow-y-auto overscroll-contain pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500' : 'space-y-2'}
        >
          {(expanded ? purchases : purchases.slice(0, 5)).map(purchase => (
            <article key={purchase.id} className="border-b border-slate-100 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-ink">{purchase.child_name} purchased at {purchase.merchant_name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
                    <span>{purchase.merchant_category}</span>
                    <time dateTime={purchase.timestamp}>{new Date(purchase.timestamp).toLocaleString()}</time>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-sm text-ink">{purchase.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
              </div>
              {purchase.assessment && <div className="mt-2 text-xs text-slate-600">
                <HistoricalBaseline historicalAssessmentUsed={purchase.assessment.final_assessment?.historical_assessment_used} score={purchase.assessment.baseline?.score} />
                {purchase.assessment.final_assessment ? <><p>Monty: {purchase.assessment.final_assessment.decision.replace(/_/g, ' ')}</p><p>{purchase.assessment.final_assessment.explanation}</p></>
                  : <p>{purchase.assessment.status === 'not_connected' ? 'Not assessed' : `Assessment ${purchase.assessment.status}`}</p>}
              </div>}
              {purchase.description && <p className="mt-1 break-words text-xs text-slate-500">{purchase.description}</p>}
            </article>
          ))}
          {!loaded && busy && <p role="status" className="text-sm text-slate-500">Loading updates...</p>}
          {loaded && purchases.length === 0 && <p className="text-sm text-slate-500">No purchases recorded yet.</p>}
          {error && <p role="alert" className="text-sm text-coral-700">{error} <button type="button" disabled={busy} className="underline disabled:opacity-50" onClick={() => request.current?.()}>Retry</button></p>}
          {expanded && hasMore && !error && (
            <button type="button" disabled={busy} onClick={() => request.current?.(true)} className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold text-ink disabled:opacity-50">
              {busy ? 'Updating...' : 'Load more'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
