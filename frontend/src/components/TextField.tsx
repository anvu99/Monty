import clsx from 'clsx';

export function TextField({
  label,
  placeholder,
  value,
  onChange,
  type = 'text'
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
}) {
  return (
    <label className="flex w-full flex-col gap-1.5 sm:gap-2">
      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 sm:text-xs sm:tracking-[0.3em]">{label}</span>
      <input
        type={type}
        inputMode={type === 'number' ? 'numeric' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={clsx(
          'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-card outline-none transition sm:rounded-2xl sm:px-4 sm:py-3 sm:text-base',
          'focus:border-ink focus:ring-2 focus:ring-ink/10'
        )}
      />
    </label>
  );
}
