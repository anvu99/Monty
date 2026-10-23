import { motion } from 'framer-motion';
import {
  Home,
  Users,
  BarChart3,
  Lightbulb,
  Settings,
  Target,
  Bot,
  type LucideIcon,
} from 'lucide-react';

export interface TabDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const PARENT_TABS: TabDef[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'kids', label: 'Kids', icon: Users },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const KID_TABS: TabDef[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'monty', label: 'Monty', icon: Bot },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface BottomNavProps {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export default function BottomNav({ tabs, activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-1.5">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 px-2 py-1.5"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-x-2 -top-1.5 h-0.5 rounded-full bg-teal-500"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon
                size={18}
                strokeWidth={isActive ? 2.2 : 1.6}
                className={isActive ? 'text-teal-700' : 'text-slate-400'}
              />
              <span
                className={`text-[9px] font-semibold uppercase tracking-[0.1em] ${
                  isActive ? 'text-teal-700' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
