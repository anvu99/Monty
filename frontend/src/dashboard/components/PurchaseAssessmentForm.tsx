import { useState } from 'react';
import { assessPurchase, type PurchaseAssessment } from '@/api/client';

export default function PurchaseAssessmentForm({ childId }: { childId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PurchaseAssessment | null>(null);

  return <div className="space-y-4 pb-24">
    <p className="text-sm text-slate-500">Thinking about a purchase? Get a suggestion before deciding. This will not record a purchase or move money.</p>
    <form className="space-y-3" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setBusy(true); setError(''); setResult(null);
      try {
        setResult(await assessPurchase({ child_id: childId, prompt: String(form.get('prompt') || 'Help me decide whether to buy this item.'), product: String(form.get('product')),
          merchant: String(form.get('merchant')), category: String(form.get('category')),
          amount: String(form.get('amount')), currency: String(form.get('currency')).toUpperCase(), timestamp: new Date().toISOString() }));
      } catch (err) { setError(err instanceof Error ? err.message : 'Assessment unavailable. Please retry.'); }
      finally { setBusy(false); }
    }}>
      {(['product', 'merchant', 'category'] as const).map((name) => <label key={name} className="block text-sm capitalize">{name}
        <input name={name} required maxLength={name === 'product' ? 150 : name === 'merchant' ? 100 : 80} className="mt-1 block w-full rounded-xl border p-3" />
      </label>)}
      <label className="block text-sm">Price<input name="amount" required type="number" min="0.01" max="99999999.99" step="0.01" className="mt-1 block w-full rounded-xl border p-3" /></label>
      <label className="block text-sm">Currency<select name="currency" className="mt-1 block w-full rounded-xl border p-3"><option>USD</option><option>CAD</option><option>GBP</option><option>EUR</option></select></label>
      <label className="block text-sm">What would you like to know? (optional)<textarea name="prompt" maxLength={1000} placeholder="For example: Is this worth buying now?" className="mt-1 block w-full rounded-xl border p-3" /></label>
      <button disabled={busy || !childId} className="rounded-full bg-lilac-500 px-5 py-3 text-white disabled:opacity-50">{busy ? 'Assessing…' : 'Ask Monty'}</button>
    </form>
    {error && <p role="alert" className="text-sm text-coral-700">{error} You can submit again to retry.</p>}
    {result && <section aria-live="polite" className="space-y-3 rounded-2xl border bg-white p-5">
      <h2 className="font-semibold">{result.status === 'insufficient_data' ? 'More context needed' : `${result.risk_level} risk · ${result.risk_score}/100`}</h2>
      <p className="text-sm">{result.explanation}</p>
      {result.factors.map((factor, index) => <p key={index} className="text-sm text-slate-500"><strong>{factor.factor}:</strong> {factor.description}</p>)}
      {result.pause_suggestion && <p className="text-sm font-medium">{result.pause_suggestion}</p>}
      <p className="text-xs text-slate-400">AI guidance, not a prediction of what you will do.</p>
    </section>}
  </div>;
}
