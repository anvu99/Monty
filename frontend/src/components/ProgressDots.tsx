import clsx from 'clsx';

export function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={`dot-${index}`}
          className={clsx(
            'h-1.5 w-4 rounded-full transition sm:h-2 sm:w-6',
            index === current ? 'bg-ink' : index < current ? 'bg-teal-700/70' : 'bg-slate-300'
          )}
        />
      ))}
    </div>
  );
}
