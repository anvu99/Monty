
export type AvatarOption = {
  id: string;
  label: string;
  artwork: React.ReactNode;
};

export const avatarOptions: AvatarOption[] = [
  {
    id: 'orbit',
    label: 'Orbit',
    artwork: (
      <svg viewBox="0 0 80 80" className="h-full w-full">
        <circle cx="40" cy="40" r="28" fill="#11A39A" />
        <ellipse cx="40" cy="40" rx="34" ry="16" fill="none" stroke="#F2B6A2" strokeWidth="4" />
        <circle cx="58" cy="36" r="5" fill="#14121B" />
      </svg>
    )
  },
  {
    id: 'crest',
    label: 'Crest',
    artwork: (
      <svg viewBox="0 0 80 80" className="h-full w-full">
        <path
          d="M40 8C54 18 66 24 66 40c0 18-12 30-26 32C26 70 14 58 14 40 14 24 26 18 40 8z"
          fill="#0E6F6B"
        />
        <path d="M40 20c8 6 16 10 16 20s-8 18-16 18-16-8-16-18 8-14 16-20z" fill="#F2B6A2" />
        <circle cx="40" cy="44" r="6" fill="#14121B" />
      </svg>
    )
  },
  {
    id: 'bloom',
    label: 'Bloom',
    artwork: (
      <svg viewBox="0 0 80 80" className="h-full w-full">
        <circle cx="40" cy="40" r="20" fill="#E07A5F" />
        <circle cx="22" cy="30" r="10" fill="#7ED9CF" />
        <circle cx="58" cy="28" r="10" fill="#7E6AE6" />
        <circle cx="56" cy="56" r="10" fill="#11A39A" />
        <circle cx="24" cy="56" r="10" fill="#F2B6A2" />
      </svg>
    )
  },
  {
    id: 'stride',
    label: 'Stride',
    artwork: (
      <svg viewBox="0 0 80 80" className="h-full w-full">
        <rect x="12" y="14" width="56" height="52" rx="16" fill="#14121B" />
        <path d="M22 50c10-16 26-24 36-14" stroke="#7ED9CF" strokeWidth="6" strokeLinecap="round" />
        <circle cx="28" cy="30" r="6" fill="#F2B6A2" />
        <circle cx="52" cy="32" r="6" fill="#E07A5F" />
      </svg>
    )
  },
  {
    id: 'spark',
    label: 'Spark',
    artwork: (
      <svg viewBox="0 0 80 80" className="h-full w-full">
        <polygon points="40,8 48,30 72,32 54,46 60,70 40,56 20,70 26,46 8,32 32,30" fill="#7E6AE6" />
        <circle cx="40" cy="40" r="12" fill="#F6F3EF" />
        <circle cx="40" cy="40" r="6" fill="#14121B" />
      </svg>
    )
  },
  {
    id: 'harbor',
    label: 'Harbor',
    artwork: (
      <svg viewBox="0 0 80 80" className="h-full w-full">
        <rect x="14" y="12" width="52" height="56" rx="18" fill="#11A39A" />
        <path d="M22 30h36" stroke="#F6F3EF" strokeWidth="6" strokeLinecap="round" />
        <path d="M22 46h36" stroke="#F2B6A2" strokeWidth="6" strokeLinecap="round" />
        <circle cx="40" cy="56" r="6" fill="#14121B" />
      </svg>
    )
  }
];
