export type AuthSession = {
  id: string;
  role: 'parent';
  displayName: string;
  demo: boolean;
  createdAt: string;
};

export interface AuthAdapter {
  getSession: () => Promise<AuthSession | null>;
  signInWithDemo: () => Promise<AuthSession>;
  signOut: () => Promise<void>;
  onChange: (callback: (session: AuthSession | null) => void) => () => void;
}
