
export function RangeField({
  label,
  value,
  min,
  max,
  step,
  formatValue,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const displayValue = formatValue ? formatValue(value) : String(value);
  return (
    <label className="flex w-full flex-col gap-1.5 sm:gap-2">
      <span className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</span>
      <div className="flex items-center gap-2 sm:gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-ink"
        />
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-center text-xs font-semibold text-ink sm:px-3 sm:text-sm">
          {displayValue}
        </span>
      </div>
    </label>
  );
}
