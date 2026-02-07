import {
  Session,
  User,
} from '@supabase/supabase-js';
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { parseProfile, UserProfile } from '../lib/types';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const emptyProfileFromUser = (user: User): UserProfile => ({
  id: user.id,
  name: String(user.user_metadata?.name ?? ''),
  phone: String(user.user_metadata?.phone ?? ''),
  avatar_url: '',
  cpf: String(user.user_metadata?.cpf ?? ''),
  email: user.email ?? String(user.user_metadata?.email ?? ''),
  birth_date:
    typeof user.user_metadata?.birth_date === 'string'
      ? String(user.user_metadata?.birth_date)
      : null,
  role: 'user',
  created_at: new Date().toISOString(),
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const ensureProfile = async (activeUser: User | null) => {
    if (!activeUser) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', activeUser.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      setProfile(parseProfile(data));
      return;
    }

    const seed = emptyProfileFromUser(activeUser);

    const { error: upsertError } = await supabase.from('users').upsert({
      id: seed.id,
      name: seed.name,
      phone: seed.phone,
      avatar_url: seed.avatar_url,
      cpf: seed.cpf,
      email: seed.email,
      birth_date: seed.birth_date,
      role: seed.role,
    });

    if (upsertError) {
      throw upsertError;
    }

    setProfile(seed);
  };

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      setSession(data.session);

      if (data.session?.user) {
        try {
          await ensureProfile(data.session.user);
        } catch {
          setProfile(null);
        }
      }

      if (mounted) {
        setReady(true);
      }
    };

    void boot();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      void ensureProfile(nextSession?.user ?? null).catch(() => {
        setProfile(null);
      });
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile: async () => {
        await ensureProfile(session?.user ?? null);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [profile, ready, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};

