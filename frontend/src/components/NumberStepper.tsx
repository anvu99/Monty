
export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:gap-3 sm:rounded-3xl sm:p-6">
      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 sm:text-xs sm:tracking-[0.3em]">{label}</span>
      <div className="flex items-center justify-between gap-4 sm:gap-6">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-9 w-9 rounded-full border border-slate-200 text-base font-semibold text-ink transition hover:border-ink sm:h-10 sm:w-10 sm:text-lg"
        >
          -
        </button>
        <div className="flex flex-col items-center">
          <span className="font-display text-3xl text-ink sm:text-4xl">{value}</span>
          <span className="text-[10px] text-slate-500 sm:text-xs">kids</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="h-9 w-9 rounded-full border border-slate-200 text-base font-semibold text-ink transition hover:border-ink sm:h-10 sm:w-10 sm:text-lg"
        >
          +
        </button>
      </div>
    </div>
  );
}
