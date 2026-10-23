import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { avatarOptions } from '@/assets/avatars';

interface Kid {
  id: string;
  name: string;
  age: number;
}

interface Props {
  kids: Kid[];
  selectedKidId: string;
  onSelect: (kidId: string) => void;
  onClose: () => void;
}

export default function KidSelector({ kids, selectedKidId, onSelect, onClose }: Props) {
  const KID_COLORS = ['bg-teal-500', 'bg-lilac-500', 'bg-coral-500', 'bg-amber-500'];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="mx-4 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Select Kid</h2>
              <p className="mt-1 text-xs text-slate-600">Choose which kid's dashboard to view</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Kid List */}
          <div className="space-y-2">
            {kids.map((kid, index) => {
              const isSelected = kid.id === selectedKidId;
              const color = KID_COLORS[index % KID_COLORS.length];
              const avatar = avatarOptions[index % avatarOptions.length];

              return (
                <button
                  key={kid.id}
                  onClick={() => {
                    onSelect(kid.id);
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 transition ${
                    isSelected
                      ? 'border-lilac-500 bg-lilac-50 ring-2 ring-lilac-500/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${color}`}>
                      <div className="h-8 w-8">{avatar.artwork}</div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-ink">{kid.name}</p>
                      <p className="text-xs text-slate-500">{kid.age} years old</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lilac-500">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
