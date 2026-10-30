import { useEffect, useRef, useState } from 'react';
import { fetchPurchaseNotifications, markPurchaseNotificationRead, type PurchaseNotification } from '@/api/client';
import { useMontyData } from '@/api/MontyDataProvider';

export default function PurchaseNotifications({ familyId }: { familyId: string }) {
  const { purchaseDataRevision } = useMontyData();
  const [rows, setRows] = useState<PurchaseNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [pages, setPages] = useState(1);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const refresh = useRef<() => void>();
  useEffect(() => { refresh.current?.(); }, [purchaseDataRevision]);
  useEffect(() => {
    let active = true, busy = false;
    async function load() {
      if (busy) return;
      busy = true;
      try {
        const next: PurchaseNotification[] = [];
        let hasMore = false;
        for (let page = 0; page < pages; page++) {
          const result = await fetchPurchaseNotifications(familyId, page * 50);
          if (!active) return;
          next.push(...result.notifications); setUnread(result.unread_count);
          hasMore = result.has_more;
          if (!hasMore) break;
        }
        setRows([...new Map(next.map(row => [row.id, row])).values()]); setMore(hasMore); setError('');
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Unable to load notifications.'); }
      finally { busy = false; }
    }
    refresh.current = () => { void load(); };
    void load();
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(onVisible, 5000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; refresh.current = undefined; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [familyId, pages]);
  return <section className="space-y-3" aria-label="Purchase notifications">
    <h2 className="font-display text-lg font-semibold">Purchase notifications · {unread} unread</h2>
    {rows.length === 0 && !error && <p className="text-sm text-slate-500">No flagged purchases.</p>}
    {rows.map(row => <article key={row.id} className={`rounded-2xl border p-4 ${row.read_at ? 'bg-white' : 'bg-amber-50'}`}>
      <p className="font-semibold">{row.child_name}: {row.product}</p>
      <p className="text-sm">{row.merchant} · {Number(row.amount).toFixed(2)} {row.currency}</p>
      <p className="mt-2 text-sm">{row.explanation}</p>
      <p className="mt-1 text-xs text-slate-500">ML baseline: {row.baseline_score}/100 · {new Date(row.created_at).toLocaleString()}</p>
      {!row.read_at && <button className="mt-2 text-sm underline" onClick={async () => {
        try { await markPurchaseNotificationRead(familyId, row.id); refresh.current?.(); }
        catch (err) { setError(err instanceof Error ? err.message : 'Unable to mark as read.'); }
      }}>Mark as read</button>}
    </article>)}
    {error && <p role="alert">{error} <button className="underline" onClick={() => refresh.current?.()}>Retry</button></p>}
    {more && <button className="text-sm underline" onClick={() => setPages(value => value + 1)}>Load more notifications</button>}
  </section>;
}
