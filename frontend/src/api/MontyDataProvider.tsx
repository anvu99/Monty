import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  fetchFamilies,
  fetchFamilyOverview,
  fetchChildInsights,
  fetchChildImpulseScores,
  fetchCheckRisk,
  type ApiFamily,
  type ApiFamilyOverview,
  type ApiImpulseScore,
  type ApiCheckRiskResponse,
} from './client';
import { transformInsights } from './transforms';
import type { Insight } from '@/dashboard/mockData';

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
  /** Preloaded insights for all children (flat list) */
  insights: Insight[];
  /** Preloaded impulse scores for first child */
  impulseScores: ApiImpulseScore[];
  /** Preloaded risk data for first child */
  riskData: ApiCheckRiskResponse | null;
  refetch: () => void;
}

const MontyDataContext = createContext<MontyDataContextValue | null>(null);

export function MontyDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<ApiFamily | null>(null);
  const [overview, setOverview] = useState<ApiFamilyOverview | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [impulseScores, setImpulseScores] = useState<ApiImpulseScore[]>([]);
  const [riskData, setRiskData] = useState<ApiCheckRiskResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check if user selected a family during onboarding
      const selectedFamilyId = localStorage.getItem('monty_selected_family_id');

      const { families } = await fetchFamilies();
      if (families.length === 0) {
        setError('No family data found. Please seed the backend.');
        setLoading(false);
        return;
      }

      // Use selected family if available, otherwise use first family
      let fam = families.find((f) => f.id === selectedFamilyId) || families[0];
      setFamily(fam);

      const ov = await fetchFamilyOverview(fam.id);
      setOverview(ov);

      // Preload insights, impulse scores, and risk data in parallel
      const kids = ov.children ?? [];
      if (kids.length > 0) {
        const firstChild = kids[0];

        const [insightResults, scores, risk] = await Promise.all([
          // Fetch insights for ALL children
          Promise.all(
            kids.map((child) =>
              fetchChildInsights(child.id)
                .then((data) => transformInsights(data.insights, child.id, child.name))
                .catch(() => [] as Insight[]),
            ),
          ),
          // Fetch impulse scores for first child
          fetchChildImpulseScores(firstChild.id).catch(() => [] as ApiImpulseScore[]),
          // Fetch risk data for first child
          fetchCheckRisk(firstChild.id).catch(() => null as ApiCheckRiskResponse | null),
        ]);

        setInsights(insightResults.flat());
        setImpulseScores(scores);
        setRiskData(risk);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

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
      insights,
      impulseScores,
      riskData,
      refetch: load,
    }),
    [loading, error, family, childList, overview, insights, impulseScores, riskData, load],
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
