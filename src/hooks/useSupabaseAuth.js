import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase/client.js';
import { syncProfileFromAuthUser, toAppUser, upsertProfile } from '../lib/supabase/profiles.js';

async function hydrateSessionState(session) {
  const authUser = session?.user || null;
  if (!authUser) {
    return {
      session: null,
      profile: null,
      user: null,
    };
  }

  const profile = await syncProfileFromAuthUser(authUser);

  return {
    session,
    profile,
    user: toAppUser(authUser, profile),
  };
}

function getAuthEmailRedirectTo() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}/dashboard`;
}

export function useSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let isCancelled = false;

    const syncFromSession = async (nextSession) => {
      try {
        const hydrated = await hydrateSessionState(nextSession);
        if (isCancelled) return;

        setSession(hydrated.session);
        setProfile(hydrated.profile);
        setUser(hydrated.user);
      } catch {
        if (isCancelled) return;
        setSession(nextSession);
        setProfile(null);
        setUser(nextSession?.user ? toAppUser(nextSession.user, null) : null);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      syncFromSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncFromSession(nextSession);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ email, password }) => {
    if (!isSupabaseConfigured) {
      throw new Error('Account access is unavailable right now.');
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const hydrated = await hydrateSessionState(data.session);
      setSession(hydrated.session);
      setProfile(hydrated.profile);
      setUser(hydrated.user);
      return { requiresEmailVerification: false };
    } finally {
      setBusy(false);
    }
  };

  const signUp = async ({ email, password, fullName, phone }) => {
    if (!isSupabaseConfigured) {
      throw new Error('Account access is unavailable right now.');
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthEmailRedirectTo(),
          data: {
            full_name: fullName,
            phone,
          },
        },
      });

      if (error) throw error;

      // When email confirmation is enabled, Supabase returns a user but no session yet.
      // Profile writes must wait until the user has an authenticated session, otherwise RLS rejects them.
      if (data.user && data.session) {
        const nextProfile = await syncProfileFromAuthUser(data.user);
        setSession(data.session);
        setProfile(nextProfile);
        setUser(toAppUser(data.user, nextProfile));
      }

      return { requiresEmailVerification: !data.session };
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return;

    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setSession(null);
      setProfile(null);
      setUser(null);
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async ({ fullName, phone }) => {
    if (!isSupabaseConfigured) {
      throw new Error('Account access is unavailable right now.');
    }

    if (!user) {
      throw new Error('Sign in before updating the profile.');
    }

    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          phone,
        },
      });

      if (authError) throw authError;

      const nextProfile = await upsertProfile({
        id: user.id,
        email: user.email,
        fullName,
        phone,
        role: user.role || 'user',
      });

      const nextSessionUser = session?.user
        ? {
            ...session.user,
            user_metadata: {
              ...(session.user.user_metadata || {}),
              full_name: fullName,
              phone,
            },
          }
        : {
            id: user.id,
            email: user.email,
            user_metadata: {
              full_name: fullName,
              phone,
            },
          };

      setProfile(nextProfile);
      setUser(toAppUser(nextSessionUser, nextProfile));
      return toAppUser(nextSessionUser, nextProfile);
    } finally {
      setBusy(false);
    }
  };

  return {
    configured: isSupabaseConfigured,
    session,
    profile,
    user,
    loading,
    busy,
    signIn,
    signUp,
    signOut,
    saveProfile,
  };
}
