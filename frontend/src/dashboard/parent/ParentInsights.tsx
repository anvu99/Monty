import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { useMontyData } from '@/api/MontyDataProvider';
import { fetchChildMemories, type ApiMemory } from '@/api/client';

function KidMemories({ childId, name }: { childId: string; name: string }) {
  const [memories, setMemories] = useState<ApiMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchChildMemories(childId).then(data => {
      if (active) setMemories([...data.memories].sort((a, b) =>
        Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id)));
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : 'Unable to load insights.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [childId, attempt]);

  return (
    <section className="space-y-3" aria-label={`${name}'s insights`}>
      <h2 className="font-display text-lg font-semibold text-ink">{name}</h2>
      {loading ? <p role="status" className="text-sm text-slate-500">Loading insights...</p>
        : error ? <p role="alert" className="text-sm text-coral-700">{error} <button className="underline" onClick={() => setAttempt(a => a + 1)}>Retry</button></p>
        : memories.length ? memories.map(memory => (
          <article key={memory.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="whitespace-pre-wrap text-sm text-ink">{memory.content}</p>
            <time dateTime={memory.created_at} className="mt-2 block text-xs text-slate-500">
              {new Date(memory.created_at).toLocaleDateString()}
            </time>
          </article>
        )) : <p className="text-sm text-slate-500">No saved insights for {name} yet.</p>}
    </section>
  );
}

export default function ParentInsights() {
  const { children, loading, error, refetch } = useMontyData();
  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-slate-400" />
        <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">Insights</h1>
      </div>
      {loading ? <p role="status" className="text-sm text-slate-500">Loading children...</p>
        : error ? <p role="alert">{error} <button onClick={refetch}>Retry</button></p>
        : children.length ? children.map(child => <KidMemories key={child.id} childId={child.id} name={child.name} />)
        : <p className="text-sm text-slate-500">No children to show yet.</p>}
    </div>
  );
}
