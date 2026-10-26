import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  fetchFamilies,
  fetchFamilyOverview,
  fetchChildImpulseScores,
  fetchCheckRisk,
  type ApiFamily,
  type ApiFamilyOverview,
  type ApiImpulseScore,
  type ApiCheckRiskResponse,
} from './client';

export interface MontyChild {
  id: string;
  name: string;
  age: number;
}

export interface MontyDataContextValue {
  loading: boolean;
  error: string | null;
  familyId: string | null;
  children: MontyChild[];
  overview: ApiFamilyOverview | null;
  /** Preloaded impulse scores for first child */
  impulseScores: ApiImpulseScore[];
  /** Preloaded risk data for first child */
  riskData: ApiCheckRiskResponse | null;
  refetch: () => void;
  purchaseDataRevision: number;
  refreshPurchaseData: () => void;
}

const MontyDataContext = createContext<MontyDataContextValue | null>(null);

export function MontyDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<ApiFamily | null>(null);
  const [overview, setOverview] = useState<ApiFamilyOverview | null>(null);
  const [impulseScores, setImpulseScores] = useState<ApiImpulseScore[]>([]);
  const [riskData, setRiskData] = useState<ApiCheckRiskResponse | null>(null);
  const [purchaseDataRevision, setPurchaseDataRevision] = useState(0);

  const load = useCallback(async (background = false) => {
    if (!background) { setLoading(true); setError(null); }
    try {
      // Check if user selected a family during onboarding
      const selectedFamilyId = localStorage.getItem('monty_selected_family_id');

      const { families } = await fetchFamilies();
      if (families.length === 0) {
        if (!background) { setError('No family data found. Please seed the backend.'); setLoading(false); }
        return;
      }

      // Use selected family if available, otherwise use first family
      let fam = families.find((f) => f.id === selectedFamilyId) || families[0];
      setFamily(fam);

      const ov = await fetchFamilyOverview(fam.id);
      setOverview(ov);

      // Preserve shared impulse scores and risk data for other screens
      const kids = ov.children ?? [];
      if (kids.length > 0) {
        const firstChild = kids[0];

        const [scores, risk] = await Promise.all([
          // Fetch impulse scores for first child
          fetchChildImpulseScores(firstChild.id).catch(() => [] as ApiImpulseScore[]),
          // Fetch risk data for first child
          fetchCheckRisk(firstChild.id).catch(() => null as ApiCheckRiskResponse | null),
        ]);

        setImpulseScores(scores);
        setRiskData(risk);
      }
    } catch (e) {
      if (!background) setError(e instanceof Error ? e.message : 'Failed to load data');
      else console.warn('Purchase saved, but dashboard refresh failed.', e);
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  const refreshPurchaseData = useCallback(() => {
    setPurchaseDataRevision((value) => value + 1);
    void load(true);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const childList: MontyChild[] = useMemo(() => {
    if (overview) {
      return overview.children.map((c) => ({ id: c.id, name: c.name, age: c.age }));
    }
    if (family) {
      return family.children;
    }
    return [];
  }, [family, overview]);

  const value = useMemo<MontyDataContextValue>(
    () => ({
      loading,
      error,
      familyId: family?.id ?? null,
      children: childList,
      overview,
      impulseScores,
      riskData,
      refetch: () => { void load(); },
      purchaseDataRevision,
      refreshPurchaseData,
    }),
    [loading, error, family, childList, overview, impulseScores, riskData, load, purchaseDataRevision, refreshPurchaseData],
  );

  return (
    <MontyDataContext.Provider value={value}>{children}</MontyDataContext.Provider>
  );
}

export function useMontyData() {
  const ctx = useContext(MontyDataContext);
  if (!ctx) throw new Error('useMontyData must be used within MontyDataProvider');
  return ctx;
}
