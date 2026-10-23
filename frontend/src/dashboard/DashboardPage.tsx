import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, GraduationCap, ChevronDown } from 'lucide-react';
import BottomNav, { PARENT_TABS, KID_TABS } from './components/BottomNav';
import { useMontyData } from '@/api/MontyDataProvider';
import KidSelector from './components/KidSelector';

import ParentHome from './parent/ParentHome';
import ParentKids from './parent/ParentKids';
import ParentStats from './parent/ParentStats';
import ParentInsights from './parent/ParentInsights';
import ParentSettings from './parent/ParentSettings';

import KidHome from './kid/KidHome';
import KidGoals from './kid/KidGoals';
import KidStats from './kid/KidStats';
import KidMonty from './kid/KidMonty';
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
      case 'stats':
        return <ParentStats />;
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
      case 'monty':
        return <KidMonty kidName={kidName} kidId={kidId} />;
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
          <div className="flex items-center gap-3">
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

      {/* Bottom Nav */}
      <BottomNav
        tabs={viewMode === 'parent' ? PARENT_TABS : KID_TABS}
        activeTab={viewMode === 'parent' ? parentTab : kidTab}
        onTabChange={viewMode === 'parent' ? setParentTab : setKidTab}
      />

      {/* Kid Selector Modal */}
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
