import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { AccountLinkChoice, KidProfile, OnboardingState } from './state';
import { createEmptyKid, defaultOnboardingState, normalizeKids } from './state';

const STORAGE_KEY = 'monty_onboarding_state';

type Action =
  | { type: 'setFamilyName'; payload: string }
  | { type: 'setParentName'; payload: string }
  | { type: 'setKidCount'; payload: number }
  | { type: 'updateKid'; payload: { index: number; kid: Partial<KidProfile> } }
  | { type: 'setAccountLinkChoice'; payload: AccountLinkChoice }
  | { type: 'complete' }
  | { type: 'reset' };

const reducer = (state: OnboardingState, action: Action): OnboardingState => {
  switch (action.type) {
    case 'setFamilyName':
      return { ...state, familyName: action.payload };
    case 'setParentName':
      return { ...state, parentName: action.payload };
    case 'setKidCount': {
      const next = normalizeKids({ ...state, kidCount: action.payload });
      return next;
    }
    case 'updateKid': {
      const nextKids = [...state.kids];
      const current = nextKids[action.payload.index] ?? createEmptyKid(action.payload.index);
      nextKids[action.payload.index] = { ...current, ...action.payload.kid };
      return { ...state, kids: nextKids };
    }
    case 'setAccountLinkChoice':
      return { ...state, accountLinkChoice: action.payload };
    case 'complete':
      return { ...state, completed: true };
    case 'reset':
      return defaultOnboardingState;
    default:
      return state;
  }
};

const loadState = (): OnboardingState => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultOnboardingState;
  try {
    const parsed = JSON.parse(raw) as OnboardingState;
    return normalizeKids({ ...defaultOnboardingState, ...parsed });
  } catch {
    return defaultOnboardingState;
  }
};

export type OnboardingContextValue = {
  state: OnboardingState;
  actions: {
    setFamilyName: (value: string) => void;
    setParentName: (value: string) => void;
    setKidCount: (value: number) => void;
    updateKid: (index: number, kid: Partial<KidProfile>) => void;
    setAccountLinkChoice: (choice: AccountLinkChoice) => void;
    complete: () => void;
    reset: () => void;
  };
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      state,
      actions: {
        setFamilyName: (value) => dispatch({ type: 'setFamilyName', payload: value }),
        setParentName: (value) => dispatch({ type: 'setParentName', payload: value }),
        setKidCount: (value) => dispatch({ type: 'setKidCount', payload: value }),
        updateKid: (index, kid) => dispatch({ type: 'updateKid', payload: { index, kid } }),
        setAccountLinkChoice: (choice) => dispatch({ type: 'setAccountLinkChoice', payload: choice }),
        complete: () => dispatch({ type: 'complete' }),
        reset: () => dispatch({ type: 'reset' })
      }
    }),
    [state]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider');
  return context;
}
