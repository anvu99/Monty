import { useNavigate } from 'react-router-dom';
import { User, Bell, Shield, Link, LogOut, Settings, Check, Pencil } from 'lucide-react';
import { useMontyData } from '@/api/MontyDataProvider';

interface Props {
  familyName?: string;
  parentName?: string;
}

const KID_COLORS = ['bg-teal-500', 'bg-lilac-500', 'bg-coral-500', 'bg-amber-500'];

const NOTIFICATION_ITEMS = [
  { label: 'Goal milestones', enabled: true },
  { label: 'Weekly summaries', enabled: true },
  { label: 'Risk alerts', enabled: true },
  { label: 'AI insights', enabled: true },
  { label: 'Kid messages', enabled: true },
];

export default function ParentSettings({ familyName = 'The Thompsons', parentName = 'Sarah' }: Props) {
  const navigate = useNavigate();
  const { children } = useMontyData();

  const handleReset = () => {
    localStorage.removeItem('monty_onboarding_state');
    localStorage.removeItem('monty_demo_session');
    navigate('/');
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings className="h-4 w-4 text-slate-400" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Configuration</p>
        </div>
        <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">Settings</h1>
      </div>

      {/* Family Profile */}
      <div className="bg-white border border-slate-200 shadow-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-slate-400" />
          <h2 className="font-display text-base font-semibold text-ink">Family Profile</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Family</span>
            <span className="font-medium text-ink">{familyName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Parent</span>
            <span className="font-medium text-ink">{parentName}</span>
          </div>
        </div>
      </div>

      {/* Kids Management */}
      <div className="bg-white border border-slate-200 shadow-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-slate-400" />
          <h2 className="font-display text-base font-semibold text-ink">Kids Management</h2>
        </div>
        <div className="space-y-3">
          {children.map((kid, idx) => (
            <div key={kid.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-mist px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${KID_COLORS[idx % KID_COLORS.length]} text-xs font-semibold text-white`}>
                  {kid.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{kid.name} (age {kid.age})</p>
                </div>
              </div>
              <button className="inline-flex items-center gap-1 rounded-full border border-ink/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink transition hover:border-ink/40">
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-slate-200 shadow-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-slate-400" />
          <h2 className="font-display text-base font-semibold text-ink">Notifications</h2>
        </div>
        <div className="space-y-4">
          {NOTIFICATION_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{item.label}</span>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  item.enabled ? 'bg-ink' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform ${
                    item.enabled ? 'translate-x-[22px]' : 'translate-x-[3px]'
                  }`}
                  style={{ width: 18, height: 18 }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Account Connection */}
      <div className="bg-white border border-slate-200 shadow-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Link className="h-4 w-4 text-slate-400" />
          <h2 className="font-display text-base font-semibold text-ink">Account Connection</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-teal-500">
          <Check className="h-4 w-4" />
          <span>Connected to Capital One (Demo)</span>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white border border-slate-200 shadow-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-slate-400" />
          <h2 className="font-display text-base font-semibold text-ink">Security</h2>
        </div>
        <p className="text-xs text-slate-600">
          All data is encrypted and stored securely. Bank credentials are managed by Capital One's secure OAuth flow.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/')}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-ink/40"
        >
          View Onboarding
        </button>
        <button
          onClick={handleReset}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-coral-500/10 border border-coral-500/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-coral-700 transition hover:bg-coral-500/20"
        >
          <LogOut className="h-4 w-4" />
          Reset Demo Data
        </button>
      </div>
    </div>
  );
}
