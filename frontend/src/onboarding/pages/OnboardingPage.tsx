import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { ProgressDots } from '@/components/ProgressDots';
import { StepShell } from '@/components/StepShell';
import { useOnboarding } from '../OnboardingProvider';
import { buildSteps } from '../steps';
import { useAuth } from '@/auth/AuthProvider';
import { selectFamilyByKidCount } from '@/api/client';

const STEP_STORAGE_KEY = 'monty_onboarding_step';
const SELECTED_FAMILY_KEY = 'monty_selected_family_id';

export default function OnboardingPage() {
  const { state, actions } = useOnboarding();
  const { session } = useAuth();
  const navigate = useNavigate();
  const steps = useMemo(() => buildSteps(), []);
  const [currentStep, setCurrentStep] = useState(() => {
    const raw = localStorage.getItem(STEP_STORAGE_KEY);
    return raw ? Number(raw) : 0;
  });

  useEffect(() => {
    if (currentStep >= steps.length) {
      setCurrentStep(steps.length - 1);
    }
  }, [currentStep, steps.length]);

  useEffect(() => {
    localStorage.setItem(STEP_STORAGE_KEY, String(currentStep));
  }, [currentStep]);

  const step = steps[currentStep];
  const canContinue = step?.canContinue(state) ?? false;
  const isLast = currentStep === steps.length - 1;

  useEffect(() => {
    if (step?.id === 'family-basics' && !state.kidCount) {
      actions.setKidCount(1);
    }
  }, [actions, state.kidCount, step?.id]);

  useEffect(() => {
    document.body.classList.add('onboarding-lock');
    return () => {
      document.body.classList.remove('onboarding-lock');
    };
  }, []);

  const goNext = async () => {
    if (!canContinue) return;
    if (isLast) {
      // Select a family from database based on kid count
      try {
        const result = await selectFamilyByKidCount(state.kidCount);
        localStorage.setItem(SELECTED_FAMILY_KEY, result.family_id);

        // Update onboarding state with real kid names from database
        result.children.forEach((child, index) => {
          actions.updateKid(index, { name: child.name });
        });
      } catch (e) {
        console.error('Failed to select family:', e);
      }

      actions.complete();
      navigate('/dashboard');
      return;
    }
    setCurrentStep((value) => Math.min(steps.length - 1, value + 1));
  };

  const goBack = () => {
    setCurrentStep((value) => Math.max(0, value - 1));
  };

  if (!step) return null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-3 sm:px-6 sm:pt-8">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 sm:text-xs">Monty</p>
          <p className="text-base font-semibold text-ink sm:text-lg">Parent onboarding</p>
        </div>
        <div className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] text-slate-600 shadow-card sm:px-4 sm:py-2 sm:text-xs">
          Demo · {session?.displayName ?? 'Parent'}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <StepShell title={step.title} subtitle={step.subtitle} accent={step.accent}>
          {step.render(state, actions)}
        </StepShell>
      </div>
      <div className="mx-auto flex w-full max-w-4xl flex-col items-stretch gap-2.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:gap-4 sm:px-6 sm:pb-8">
        <ProgressDots current={currentStep} total={steps.length} />
        <div className="flex w-full items-center justify-center gap-3 sm:w-auto">
          {currentStep > 0 ? <SecondaryButton onClick={goBack}>Back</SecondaryButton> : null}
          <PrimaryButton onClick={goNext} disabled={!canContinue}>
            {isLast ? 'Enter dashboard' : 'Continue'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
