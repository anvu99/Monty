import { useMontyData } from '@/api/MontyDataProvider';
import { useOnboarding } from '@/onboarding/OnboardingProvider';
import DashboardPage from './DashboardPage';

export default function DashboardWrapper() {
  const { state } = useOnboarding();
  const { loading, error, children } = useMontyData();

  // Check localStorage for selected kid, fallback to first child
  const selectedKidId = localStorage.getItem('monty_selected_kid_id');
  const selectedChild = children.find((c) => c.id === selectedKidId) || children[0];

  const familyName = state.familyName || 'The Thompsons';
  const parentName = state.parentName || 'Sarah';
  const kidName = selectedChild?.name || state.kids?.[0]?.name || 'Emma';
  const kidId = selectedChild?.id || '';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <p className="mb-2 text-sm font-medium text-coral-700">Could not connect to Monty API</p>
          <p className="mb-4 text-xs text-slate-500">{error}</p>
          <p className="text-xs text-slate-400">Make sure the backend is running on port 8000</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardPage
      familyName={familyName}
      parentName={parentName}
      kidName={kidName}
      kidId={kidId}
    />
  );
}
