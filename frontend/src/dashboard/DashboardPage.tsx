import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, GraduationCap, ChevronDown, ShoppingBag, ArrowRight, X } from 'lucide-react';
import BottomNav, { PARENT_TABS, KID_TABS } from './components/BottomNav';
import { useMontyData } from '@/api/MontyDataProvider';
import KidSelector from './components/KidSelector';
import DemoPurchaseDialog from './components/DemoPurchaseDialog';

import ParentHome from './parent/ParentHome';
import ParentKids from './parent/ParentKids';
import ParentInsights from './parent/ParentInsights';
import ParentSettings from './parent/ParentSettings';

import KidHome from './kid/KidHome';
import KidGoals from './kid/KidGoals';
import KidStats from './kid/KidStats';
import KidSettings from './kid/KidSettings';

type ViewMode = 'parent' | 'kid';

interface Props {
  familyName?: string;
  parentName?: string;
  kidName?: string;
  kidId?: string;
}

export default function DashboardPage({
  familyName = 'The Thompsons',
  parentName = 'Sarah',
  kidName = 'Emma',
  kidId = '',
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('parent');
  const [parentTab, setParentTab] = useState('home');
  const [kidTab, setKidTab] = useState('home');
  const [showKidSelector, setShowKidSelector] = useState(false);
  const [showDemoPurchase, setShowDemoPurchase] = useState(false);
  const [showDemoPromotion, setShowDemoPromotion] = useState(true);
  const closeDemoPurchase = useCallback(() => setShowDemoPurchase(false), []);
  const demoEnabled = import.meta.env.VITE_DEMO_PURCHASES_ENABLED === 'true';
  const { children } = useMontyData();

  const handleSelectKid = (newKidId: string) => {
    localStorage.setItem('monty_selected_kid_id', newKidId);
    // Force reload to update all kid pages
    window.location.reload();
  };

  const renderParentContent = () => {
    switch (parentTab) {
      case 'home':
        return <ParentHome familyName={familyName} />;
      case 'kids':
        return <ParentKids />;
      case 'insights':
        return <ParentInsights />;
      case 'settings':
        return <ParentSettings familyName={familyName} parentName={parentName} />;
      default:
        return <ParentHome familyName={familyName} />;
    }
  };

  const renderKidContent = () => {
    switch (kidTab) {
      case 'home':
        return <KidHome kidName={kidName} kidId={kidId} />;
      case 'goals':
        return <KidGoals kidId={kidId} />;
      case 'stats':
        return <KidStats kidId={kidId} />;
      case 'settings':
        return <KidSettings kidName={kidName} familyName={familyName} />;
      default:
        return <KidHome kidName={kidName} kidId={kidId} />;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Top bar — matches onboarding header style */}
      <header className="sticky top-0 z-50 border-b border-ink/10 bg-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.4em] text-teal-300 sm:text-xs">
              Monty
            </p>
            <p className="text-sm font-semibold text-mist sm:text-base">
              {viewMode === 'parent' ? 'Parent dashboard' : 'Kid dashboard'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {demoEnabled && <button disabled={!children.length} onClick={() => setShowDemoPurchase(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-teal-300 px-3 py-2 text-xs font-bold text-ink transition hover:bg-teal-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200 disabled:opacity-50">
              <ShoppingBag size={14} aria-hidden="true" />Try a purchase</button>}
            <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-0.5">
              <button
                onClick={() => setViewMode('parent')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition sm:text-xs ${
                  viewMode === 'parent'
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Users size={13} />
                Parent
              </button>
              <button
                onClick={() => setViewMode('kid')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition sm:text-xs ${
                  viewMode === 'kid'
                    ? 'bg-lilac-500 text-white shadow-sm'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <GraduationCap size={13} />
                Kid
              </button>
            </div>
            {viewMode === 'kid' && children.length > 1 && (
              <button
                onClick={() => setShowKidSelector(true)}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                {kidName}
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-lg px-4 py-5 sm:px-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${viewMode}-${viewMode === 'parent' ? parentTab : kidTab}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {viewMode === 'parent' ? renderParentContent() : renderKidContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {demoEnabled && !showDemoPurchase && (
        <aside aria-label="Try a purchase with Monty"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 max-w-[calc(100vw-2rem)] min-[1200px]:bottom-auto min-[1200px]:right-6 min-[1200px]:top-28 min-[1200px]:w-72">
          {showDemoPromotion && (
            <div className="relative hidden overflow-hidden rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-teal-100 p-5 shadow-lift min-[1200px]:block">
              <button type="button" aria-label="Dismiss purchase demo promotion" onClick={() => setShowDemoPromotion(false)}
                className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/80 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
                <X size={16} aria-hidden="true" />
              </button>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm">
                <ShoppingBag size={21} aria-hidden="true" />
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">Try Monty in action</p>
              <h2 className="mt-2 font-display text-xl font-semibold leading-snug text-ink">A little purchase.<br />A smarter perspective.</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">Simulate a purchase and see how Monty assesses it. Follow the result in parent Updates.</p>
              <button type="button" disabled={!children.length} onClick={() => setShowDemoPurchase(true)}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                Demo a purchase <ArrowRight size={17} aria-hidden="true" />
              </button>
              <p className="mt-3 text-center text-xs text-slate-500">Demo only. No real money moves.</p>
            </div>
          )}
          <button type="button" disabled={!children.length} onClick={() => setShowDemoPurchase(true)}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-teal-300 bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow-lift transition hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50 ${showDemoPromotion ? 'min-[1200px]:hidden' : 'min-[1200px]:ml-auto min-[1200px]:flex'}`}>
            <ShoppingBag size={17} aria-hidden="true" />Demo a purchase <ArrowRight size={16} aria-hidden="true" />
          </button>
        </aside>
      )}

      {/* Bottom Nav */}
      <BottomNav
        tabs={viewMode === 'parent' ? PARENT_TABS : KID_TABS}
        activeTab={viewMode === 'parent' ? parentTab : kidTab}
        onTabChange={viewMode === 'parent' ? setParentTab : setKidTab}
      />

      {/* Kid Selector Modal */}
      {demoEnabled && <DemoPurchaseDialog open={showDemoPurchase} defaultChildId={kidId} onClose={closeDemoPurchase} />}
      {showKidSelector && (
        <KidSelector
          kids={children}
          selectedKidId={kidId}
          onSelect={handleSelectKid}
          onClose={() => setShowKidSelector(false)}
        />
      )}
    </div>
  );
}
