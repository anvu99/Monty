import { useOnboarding } from '@/onboarding/OnboardingProvider';
import { FamilyIcon, GoalIcon, ParentIcon } from '@/assets/icons';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { useNavigate } from 'react-router-dom';

export default function DashboardPlaceholder() {
  const { state, actions } = useOnboarding();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8">
        <header className="flex flex-col gap-3 sm:gap-4">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Dashboard</p>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">Parent dashboard placeholder</h1>
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            This is a polished placeholder for the upcoming dashboard build. Your onboarding data is ready and waiting.
          </p>
        </header>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
            <h2 className="font-display text-xl sm:text-2xl">Family snapshot</h2>
            <div className="mt-5 grid gap-4">
              <div className="flex items-center gap-3">
                <FamilyIcon className="h-10 w-10" />
                <div>
                  <p className="text-sm text-slate-500">Family</p>
                  <p className="text-lg font-semibold text-ink">{state.familyName || 'Family name'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ParentIcon className="h-10 w-10" />
                <div>
                  <p className="text-sm text-slate-500">Parent</p>
                  <p className="text-lg font-semibold text-ink">{state.parentName || 'Parent name'}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-mist p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Kids configured</p>
                <p className="mt-2 text-3xl font-display text-ink">{state.kids.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-ink p-5 text-mist shadow-card sm:p-6">
            <GoalIcon className="h-10 w-10" />
            <h2 className="mt-4 font-display text-xl sm:text-2xl">Goal cues</h2>
            <div className="mt-4 space-y-3 text-sm text-mist/80">
              {state.kids.map((kid) => (
                <div key={kid.id} className="rounded-2xl bg-white/10 p-3">
                  <p className="text-sm font-semibold text-mist">{kid.name || 'Child'}</p>
                  <p className="text-xs text-mist/70">{kid.goal.name || 'First goal'} · ${kid.goal.targetAmount ?? 0}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <PrimaryButton onClick={() => navigate('/')}>View onboarding</PrimaryButton>
          <SecondaryButton
            onClick={() => {
              actions.reset();
              localStorage.setItem('monty_onboarding_step', '0');
              navigate('/');
            }}
          >
            Reset demo data
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
