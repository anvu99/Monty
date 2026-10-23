import type { ReactNode } from 'react';
import type { OnboardingState } from '../state';
import { NumberStepper } from '@/components/NumberStepper';
import { RangeField } from '@/components/RangeField';
import { TextField } from '@/components/TextField';
import { ChildIcon, FamilyIcon, ParentIcon, SparkIcon } from '@/assets/icons';
import { avatarOptions } from '@/assets/avatars';
import clsx from 'clsx';

export type StepDefinition = {
  id: string;
  title: string;
  subtitle?: string;
  accent?: 'teal' | 'coral' | 'lilac';
  canContinue: (state: OnboardingState) => boolean;
  render: (state: OnboardingState, actions: StepActions) => ReactNode;
};

export type StepActions = {
  setFamilyName: (value: string) => void;
  setParentName: (value: string) => void;
  setKidCount: (value: number) => void;
  updateKid: (index: number, kid: Partial<OnboardingState['kids'][number]>) => void;
  setAccountLinkChoice: (value: OnboardingState['accountLinkChoice']) => void;
  complete: () => void;
};

const PRESET_GOALS = [
  { name: 'Skateboard', emoji: '🛹', amount: 120 },
  { name: 'Video Game', emoji: '🎮', amount: 60 },
  { name: 'Bike', emoji: '🚲', amount: 200 },
  { name: 'Phone', emoji: '📱', amount: 500 },
  { name: 'Guitar', emoji: '🎸', amount: 200 },
  { name: 'Laptop', emoji: '💻', amount: 800 },
] as const;

const introStep: StepDefinition = {
  id: 'intro',
  title: 'Welcome to your family setup',
  subtitle: 'A quick setup to personalize the parent dashboard. You can fill in details later.',
  accent: 'teal',
  canContinue: () => true,
  render: () => (
    <div className="grid gap-3 sm:gap-6 md:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:rounded-3xl sm:p-6">
        <h3 className="font-display text-lg text-ink sm:text-2xl">A calm, confident start.</h3>
        <p className="mt-2 text-xs text-slate-600 sm:mt-3 sm:text-sm">
          Keep this under a minute. Start with the basics now and refine goals, avatars, and account connections later.
        </p>
        <div className="mt-3 flex items-center gap-3 sm:mt-5">
          <div className="h-8 w-8 rounded-full bg-teal-500/20 p-1.5 sm:h-10 sm:w-10 sm:p-2">
            <FamilyIcon />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink sm:text-sm">Designed for parents</p>
            <p className="text-[10px] text-slate-500 sm:text-xs">Insightful, not overwhelming.</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-ink p-4 text-mist shadow-card sm:rounded-3xl sm:p-6">
        <SparkIcon className="h-8 w-8 sm:h-10 sm:w-10" />
        <h3 className="mt-2 font-display text-lg sm:mt-4 sm:text-2xl">Demo-ready</h3>
        <p className="mt-2 text-xs text-mist/80 sm:mt-3 sm:text-sm">Every screen works in demo mode. Connect real accounts whenever you want.</p>
      </div>
    </div>
  )
};

const familyBasicsStep: StepDefinition = {
  id: 'family-basics',
  title: 'Family basics',
  subtitle: 'We just need a household name and how many kids we are setting up.',
  accent: 'coral',
  canContinue: (state) =>
    state.familyName.trim().length >= 2 && state.parentName.trim().length >= 2 && Boolean(state.kidCount),
  render: (state, actions) => (
    <div className="grid gap-3 sm:gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:gap-5 sm:rounded-3xl sm:p-6">
        <TextField
          label="Family name"
          placeholder="The Ramirez Family"
          value={state.familyName}
          onChange={actions.setFamilyName}
        />
        <TextField label="Parent name" placeholder="Alex" value={state.parentName} onChange={actions.setParentName} />
        <p className="text-xs text-slate-500">
          These show up in reminders and weekly summaries. You can edit them anytime.
        </p>
      </div>
      <NumberStepper
        label="Number of kids"
        value={state.kidCount ?? 1}
        min={1}
        max={6}
        onChange={(value) => actions.setKidCount(value)}
      />
    </div>
  )
};

const kidProfilesStep: StepDefinition = {
  id: 'kid-profiles',
  title: 'Quick kid profiles',
  subtitle: 'Add names, ages, and pick an avatar for each kid.',
  accent: 'lilac',
  canContinue: () => true,
  render: (state, actions) => (
    <div className="grid gap-3 sm:gap-4">
      {state.kids.map((kid, index) => (
        <div key={kid.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:gap-4 sm:rounded-3xl sm:p-6">
          <p className="text-sm font-semibold text-ink">Kid {index + 1}</p>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Name"
              placeholder="Jamie"
              value={kid.name}
              onChange={(value) => actions.updateKid(index, { name: value })}
            />
            <RangeField
              label="Age"
              min={5}
              max={17}
              step={1}
              value={kid.age ?? 10}
              formatValue={(value) => `${value} yrs`}
              onChange={(value) => actions.updateKid(index, { age: value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="mr-1 text-[10px] uppercase tracking-[0.2em] text-slate-400 sm:text-xs sm:tracking-[0.3em]">Avatar</span>
            {avatarOptions.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                onClick={() => actions.updateKid(index, { avatarId: avatar.id })}
                className={clsx(
                  'rounded-xl border p-1.5 transition sm:p-2',
                  kid.avatarId === avatar.id
                    ? 'border-ink bg-ink/5 ring-2 ring-ink/20'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className="h-7 w-7 sm:h-9 sm:w-9">{avatar.artwork}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
};

const kidGoalsStep: StepDefinition = {
  id: 'kid-goals',
  title: 'Set savings goals',
  subtitle: 'Pick a goal for each kid or type in a custom one.',
  accent: 'coral',
  canContinue: (state) =>
    state.kids.every((kid) => kid.goal.name.trim().length >= 1),
  render: (state, actions) => (
    <div className="grid gap-3 sm:gap-4">
      {state.kids.map((kid, index) => (
        <div key={kid.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:gap-4 sm:rounded-3xl sm:p-6">
          <div className="flex items-center gap-2">
            {kid.avatarId && (
              <div className="h-6 w-6">
                {avatarOptions.find((a) => a.id === kid.avatarId)?.artwork}
              </div>
            )}
            <p className="text-sm font-semibold text-ink">{kid.name || `Kid ${index + 1}`}</p>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {PRESET_GOALS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() =>
                  actions.updateKid(index, {
                    goal: { name: preset.name, targetAmount: preset.amount, weeklyContribution: kid.goal.weeklyContribution ?? 10 }
                  })
                }
                className={clsx(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition sm:px-3 sm:py-1.5 sm:text-xs',
                  kid.goal.name === preset.name
                    ? 'border-ink bg-ink text-mist'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                )}
              >
                {preset.emoji} {preset.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:grid-cols-3 sm:gap-4">
            <TextField
              label="Goal name"
              placeholder="Skateboard"
              value={kid.goal.name}
              onChange={(value) =>
                actions.updateKid(index, {
                  goal: { ...kid.goal, name: value }
                })
              }
            />
            <TextField
              label="Target ($)"
              placeholder="120"
              type="number"
              value={kid.goal.targetAmount != null ? String(kid.goal.targetAmount) : ''}
              onChange={(value) =>
                actions.updateKid(index, {
                  goal: { ...kid.goal, targetAmount: value ? Number(value) : null }
                })
              }
            />
            <TextField
              label="Weekly ($)"
              placeholder="10"
              type="number"
              value={kid.goal.weeklyContribution != null ? String(kid.goal.weeklyContribution) : ''}
              onChange={(value) =>
                actions.updateKid(index, {
                  goal: { ...kid.goal, weeklyContribution: value ? Number(value) : null }
                })
              }
            />
          </div>

          {kid.goal.targetAmount && kid.goal.weeklyContribution && kid.goal.weeklyContribution > 0 ? (
            <p className="text-xs text-slate-500">
              At ${kid.goal.weeklyContribution}/wk → ${kid.goal.targetAmount} in{' '}
              <span className="font-semibold text-ink">
                {Math.ceil(kid.goal.targetAmount / kid.goal.weeklyContribution)} weeks
              </span>
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
};

const successStep: StepDefinition = {
  id: 'success',
  title: 'Your parent dashboard is ready',
  subtitle: 'You are in. We can finish the rest later.',
  accent: 'teal',
  canContinue: () => true,
  render: (state) => (
    <div className="grid gap-3 sm:gap-6 md:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:rounded-3xl sm:p-6">
        <h3 className="font-display text-base sm:text-2xl">Family summary</h3>
        <div className="mt-2 flex flex-col gap-1.5 text-sm text-slate-600 sm:mt-3 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <FamilyIcon className="h-6 w-6 sm:h-8 sm:w-8" />
            <span className="text-xs sm:text-sm">{state.familyName || 'Family name'}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ParentIcon className="h-6 w-6 sm:h-8 sm:w-8" />
            <span className="text-xs sm:text-sm">{state.parentName || 'Parent name'}</span>
          </div>
          <div className="mt-1 grid gap-1.5 sm:mt-2 sm:gap-2">
            {state.kids.map((kid, index) => (
              <div key={kid.id} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-mist p-2 sm:gap-3 sm:rounded-2xl sm:p-3">
                {kid.avatarId ? (
                  <div className="h-6 w-6 sm:h-8 sm:w-8">
                    {avatarOptions.find((a) => a.id === kid.avatarId)?.artwork}
                  </div>
                ) : (
                  <ChildIcon className="h-6 w-6 sm:h-8 sm:w-8" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-ink sm:text-sm">{kid.name || `Kid ${index + 1}`} · {kid.age ?? 10} yrs</p>
                  {kid.goal.name ? (
                    <p className="truncate text-[10px] text-slate-500 sm:text-xs">
                      {kid.goal.name}
                      {kid.goal.targetAmount ? ` · $${kid.goal.targetAmount}` : ''}
                      {kid.goal.weeklyContribution ? ` · $${kid.goal.weeklyContribution}/wk` : ''}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="hidden rounded-3xl bg-ink p-5 text-mist shadow-card sm:block sm:p-6">
        <SparkIcon className="h-10 w-10" />
        <h3 className="mt-4 font-display text-xl sm:text-2xl">Next steps</h3>
        <ul className="mt-3 space-y-2 text-sm text-mist/80">
          <li>Connect real bank accounts when ready.</li>
          <li>Pick badges and customize the family view.</li>
          <li>Track spending habits and savings streaks.</li>
        </ul>
      </div>
    </div>
  )
};

export function buildSteps(): StepDefinition[] {
  return [introStep, familyBasicsStep, kidProfilesStep, kidGoalsStep, successStep];
}
