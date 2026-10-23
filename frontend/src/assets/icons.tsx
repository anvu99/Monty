
export function FamilyIcon({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <path d="M12 44c0-8 6-14 14-14h12c8 0 14 6 14 14" stroke="#14121B" strokeWidth="4" strokeLinecap="round" />
      <circle cx="24" cy="22" r="6" fill="#11A39A" />
      <circle cx="40" cy="20" r="7" fill="#E07A5F" />
      <circle cx="32" cy="28" r="5" fill="#7E6AE6" />
    </svg>
  );
}

export function ParentIcon({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <circle cx="32" cy="20" r="10" fill="#11A39A" />
      <path d="M16 52c0-9 7-16 16-16s16 7 16 16" stroke="#14121B" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function ChildIcon({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <circle cx="32" cy="22" r="9" fill="#7E6AE6" />
      <path d="M18 50c0-8 6-14 14-14s14 6 14 14" stroke="#14121B" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function GoalIcon({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <circle cx="32" cy="32" r="20" stroke="#14121B" strokeWidth="4" />
      <circle cx="32" cy="32" r="10" fill="#F2B6A2" />
      <circle cx="32" cy="32" r="4" fill="#14121B" />
    </svg>
  );
}

export function LinkIcon({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <path d="M24 20h-6a10 10 0 0 0 0 20h6" stroke="#14121B" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 20h6a10 10 0 0 1 0 20h-6" stroke="#14121B" strokeWidth="4" strokeLinecap="round" />
      <path d="M24 32h16" stroke="#11A39A" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function SparkIcon({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <path d="M32 6l8 18 18 2-14 12 4 20-16-10-16 10 4-20-14-12 18-2 8-18z" fill="#7E6AE6" />
    </svg>
  );
}
