import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Circle, Plus, Pencil, Target } from 'lucide-react';
import SavingsGoalCard from '../components/SavingsGoalCard';
import AddMoneyModal from '../components/AddMoneyModal';
import EditGoalModal from '../components/EditGoalModal';
import NewGoalModal from '../components/NewGoalModal';
import { fetchChildGoals, addMoneyToGoal, updateGoal, createGoal } from '@/api/client';
import { transformGoal } from '@/api/transforms';
import type { Goal } from '../mockData';

interface Props {
  kidId?: string;
}

export default function KidGoals({ kidId = '' }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState<{ id: string; name: string } | null>(null);
  const [showEditGoalModal, setShowEditGoalModal] = useState<Goal | null>(null);
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);

  const refreshGoals = () => {
    if (!kidId) return;
    fetchChildGoals(kidId)
      .then((data) => setGoals(data.goals.map((g) => transformGoal(g))))
      .catch(() => {});
  };

  const handleAddMoney = async (amount: number) => {
    if (!kidId || !showAddMoneyModal) return;
    await addMoneyToGoal(kidId, showAddMoneyModal.id, amount);
    setShowAddMoneyModal(null);
    refreshGoals();
  };

  const handleEditGoal = async (updates: { name?: string; target_amount?: number; weekly_contribution?: number }) => {
    if (!kidId || !showEditGoalModal) return;
    await updateGoal(kidId, showEditGoalModal.id, updates);
    setShowEditGoalModal(null);
    refreshGoals();
  };

  const handleCreateGoal = async (name: string, target: number, weekly: number) => {
    if (!kidId) return;
    await createGoal(kidId, name, target, weekly);
    setShowNewGoalModal(false);
    refreshGoals();
  };

  useEffect(() => {
    if (!kidId) { setLoading(false); return; }
    setLoading(true);
    fetchChildGoals(kidId)
      .then((data) => setGoals(data.goals.map((g) => transformGoal(g))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [kidId]);

  const activeGoals = goals.filter((g) => g.status !== 'completed');
  const totalSaved = activeGoals.reduce((s, g) => s + g.currentAmount, 0);

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Your Goals</h1>
        <p className="mt-0.5 text-xs text-slate-600">
          {activeGoals.length} active &middot;{' '}
          <span className="font-mono">${totalSaved}</span> total saved
        </p>
      </div>

      {/* Active Goals */}
      <div className="space-y-4">
        {activeGoals.map((goal) => (
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SavingsGoalCard goal={goal} />

            {/* Extra detail under each goal */}
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Weekly</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-ink">
                    ${goal.weeklyContribution}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Remaining</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-ink">
                    ${goal.targetAmount - goal.currentAmount}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Progress</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    {Math.round((goal.currentAmount / goal.targetAmount) * 100)}%
                  </p>
                </div>
              </div>

              {/* Milestone progress */}
              <div className="mt-4 space-y-2">
                {[25, 50, 75, 100].map((milestone) => {
                  const pct = (goal.currentAmount / goal.targetAmount) * 100;
                  const reached = pct >= milestone;
                  return (
                    <div key={milestone} className="flex items-center gap-2.5 text-xs">
                      {reached ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-lilac-500" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                      )}
                      <span className={reached ? 'text-ink' : 'text-slate-400'}>
                        <span className="font-mono">
                          ${Math.round(goal.targetAmount * (milestone / 100))}
                        </span>
                        {' \u2014 '}
                        {milestone === 25
                          ? 'Getting started!'
                          : milestone === 50
                            ? 'Halfway there!'
                            : milestone === 75
                              ? 'Almost done!'
                              : 'Goal reached!'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowAddMoneyModal({ id: goal.id, name: goal.name })}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-lilac-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5 hover:shadow-card"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Money
                </button>
                <button
                  onClick={() => setShowEditGoalModal(goal)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-ink/40"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Goal
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add New Goal */}
      <button
        onClick={() => setShowNewGoalModal(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-sm font-medium text-slate-400 transition-colors hover:border-lilac-300 hover:text-lilac-500"
      >
        <Target className="h-4 w-4" />
        Add New Goal
      </button>

      {/* Modals */}
      {showAddMoneyModal && (
        <AddMoneyModal
          goalName={showAddMoneyModal.name}
          onSubmit={handleAddMoney}
          onClose={() => setShowAddMoneyModal(null)}
        />
      )}
      {showEditGoalModal && (
        <EditGoalModal
          goal={showEditGoalModal}
          onSubmit={handleEditGoal}
          onClose={() => setShowEditGoalModal(null)}
        />
      )}
      {showNewGoalModal && (
        <NewGoalModal
          onSubmit={handleCreateGoal}
          onClose={() => setShowNewGoalModal(false)}
        />
      )}
    </div>
  );
}
