import { useNavigate } from 'react-router-dom';
import {
  User,
  Bell,
  Volume2,
  Vibrate,
  MonitorSmartphone,
  Users,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  MessageSquare,
  LogOut,
  ChevronRight,
  Pencil,
} from 'lucide-react';

interface Props {
  kidName?: string;
  familyName?: string;
}

const PREFERENCES = [
  { label: 'Notifications', icon: <Bell className="h-4 w-4 text-lilac-500" />, enabled: true },
  { label: 'Sound Effects', icon: <Volume2 className="h-4 w-4 text-lilac-500" />, enabled: true },
  { label: 'Haptic Feedback', icon: <Vibrate className="h-4 w-4 text-lilac-500" />, enabled: true },
  { label: 'Reduced Motion', icon: <MonitorSmartphone className="h-4 w-4 text-lilac-500" />, enabled: false },
];

const HELP_ITEMS = [
  { label: 'How Monty Works', icon: <HelpCircle className="h-4 w-4 text-slate-400" /> },
  { label: 'Tips & Tricks', icon: <Lightbulb className="h-4 w-4 text-slate-400" /> },
  { label: 'Report a Problem', icon: <AlertTriangle className="h-4 w-4 text-slate-400" /> },
  { label: 'Contact Parent', icon: <MessageSquare className="h-4 w-4 text-slate-400" /> },
];

export default function KidSettings({ kidName = 'Emma', familyName = 'The Johnsons' }: Props) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <h1 className="font-display text-xl font-semibold text-ink">Settings</h1>

      {/* Profile */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Your Profile</h2>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lilac-500/10">
            <User className="h-6 w-6 text-lilac-500" />
          </div>
          <div>
            <p className="text-lg font-semibold text-ink">{kidName}</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Member since Jan 2026
            </p>
          </div>
        </div>
        <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-ink/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-ink/40">
          <Pencil className="h-3.5 w-3.5" />
          Edit Profile
        </button>
      </div>

      {/* Preferences */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Preferences</h2>
        <div className="space-y-3">
          {PREFERENCES.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {item.icon}
                <span className="text-sm text-ink">{item.label}</span>
              </div>
              <div
                className={`flex h-6 w-10 items-center rounded-full px-0.5 transition-colors ${
                  item.enabled ? 'bg-lilac-500 justify-end' : 'bg-slate-200 justify-start'
                }`}
              >
                <div className="h-5 w-5 rounded-full bg-white shadow-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Family */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-lilac-500" />
          <h2 className="font-display text-lg font-semibold text-ink">Family</h2>
        </div>
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Family</span>
            <span className="font-medium text-ink">{familyName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Your parent</span>
            <span className="font-medium text-ink">Sarah</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Your code</span>
            <span className="font-mono font-medium text-ink">A3F-9K2</span>
          </div>
        </div>
      </div>

      {/* Help */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Help & Support</h2>
        <div className="space-y-1">
          {HELP_ITEMS.map((item) => (
            <button
              key={item.label}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            </button>
          ))}
        </div>
      </div>

      {/* Log out */}
      <button
        onClick={() => navigate('/')}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-coral-500/30 bg-coral-500/10 py-3 text-sm font-semibold text-coral-700 transition-colors hover:bg-coral-500/20"
      >
        <LogOut className="h-4 w-4" />
        Log Out
      </button>
    </div>
  );
}
