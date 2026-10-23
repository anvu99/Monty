export type KidGoal = {
  name: string;
  targetAmount: number | null;
  weeklyContribution: number | null;
};

export type KidProfile = {
  id: string;
  name: string;
  age: number | null;
  avatarId: string | null;
  goal: KidGoal;
};

export type AccountLinkChoice = 'later' | 'demo' | null;

export type OnboardingState = {
  familyName: string;
  parentName: string;
  kidCount: number | null;
  kids: KidProfile[];
  accountLinkChoice: AccountLinkChoice;
  completed: boolean;
};

export const createEmptyKid = (index: number): KidProfile => ({
  id: `kid-${index + 1}`,
  name: '',
  age: 10,
  avatarId: null,
  goal: {
    name: '',
    targetAmount: null,
    weeklyContribution: 10
  }
});

export const defaultOnboardingState: OnboardingState = {
  familyName: '',
  parentName: '',
  kidCount: null,
  kids: [],
  accountLinkChoice: null,
  completed: false
};

export const normalizeKids = (state: OnboardingState): OnboardingState => {
  if (!state.kidCount || state.kidCount < 1) {
    return { ...state, kids: [] };
  }
  const kids = Array.from({ length: state.kidCount }, (_, index) =>
    state.kids[index] ?? createEmptyKid(index)
  );
  return { ...state, kids };
};
