import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ListChecks, Plus, Sparkles, CheckCircle } from 'lucide-react';
import { fetchIntentions, createIntention } from '@/api/client';
import type { ApiIntention, ApiIntentionSuggestion } from '@/api/client';

interface Props {
  childId: string;
  variant?: 'parent' | 'kid';
}

export default function ImplementationIntentions({ childId, variant = 'kid' }: Props) {
  const [intentions, setIntentions] = useState<ApiIntention[]>([]);
  const [suggestions, setSuggestions] = useState<ApiIntentionSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    if (!childId) return;
    fetchIntentions(childId)
      .then((data) => {
        setIntentions(data.intentions ?? []);
        setSuggestions(data.suggestions ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = useCallback(async (trigger: string, action: string) => {
    if (!childId || adding) return;
    setAdding(true);
    try {
      await createIntention(childId, trigger, action);
      load();
    } catch {
      // silently fail
    } finally {
      setAdding(false);
    }
  }, [childId, adding, load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200 mb-3" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (intentions.length === 0 && suggestions.length === 0) return null;

  const isKid = variant === 'kid';
  const accent = isKid ? 'lilac' : 'teal';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks className={`h-4 w-4 text-${accent}-500`} />
        <h2 className="font-display text-base font-semibold text-ink">
          {isKid ? 'My If-Then Plans' : 'Implementation Intentions'}
        </h2>
        {intentions.length > 0 && (
          <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-slate-400">
            {intentions.length} active
          </span>
        )}
      </div>

      {/* Existing intentions */}
      {intentions.length > 0 && (
        <div className="space-y-2 mb-4">
          {intentions.map((intent, i) => {
            const successRate = intent.total_triggered > 0
              ? Math.round((intent.success_count / intent.total_triggered) * 100)
              : 0;

            return (
              <motion.div
                key={intent.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle className={`h-4 w-4 shrink-0 mt-0.5 ${isKid ? 'text-lilac-500' : 'text-teal-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700">
                      <span className={`font-semibold ${isKid ? 'text-lilac-600' : 'text-teal-600'}`}>IF </span>
                      {intent.trigger_situation}
                    </p>
                    <p className="text-xs text-slate-700 mt-0.5">
                      <span className={`font-semibold ${isKid ? 'text-lilac-600' : 'text-teal-600'}`}>THEN </span>
                      {intent.planned_action}
                    </p>
                    {intent.total_triggered > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isKid ? 'bg-lilac-500' : 'bg-teal-500'}`}
                            style={{ width: `${successRate}%` }}
                          />
                        </div>
                        <span className="font-mono text-[9px] text-slate-400 shrink-0">
                          {intent.success_count}/{intent.total_triggered}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* AI suggestions */}
      {suggestions.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3 w-3 text-slate-400" />
            <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400">
              {isKid ? 'Monty suggests' : 'AI Suggested Plans'}
            </p>
          </div>
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((sug, i) => (
              <motion.div
                key={`sug-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (intentions.length + i) * 0.08 }}
                className="flex items-start gap-2 rounded-xl border border-dashed border-slate-200 bg-white p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-600">IF </span>
                    {sug.trigger_situation}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-medium text-slate-600">THEN </span>
                    {sug.planned_action}
                  </p>
                </div>
                <button
                  onClick={() => handleAdd(sug.trigger_situation, sug.planned_action)}
                  disabled={adding}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white transition disabled:opacity-50 ${
                    isKid ? 'bg-lilac-500 hover:bg-lilac-600' : 'bg-teal-500 hover:bg-teal-600'
                  }`}
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
