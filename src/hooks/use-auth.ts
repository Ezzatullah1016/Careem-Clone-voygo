"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

/** Current session + profile, kept in sync with Supabase auth events. */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });
  const { db, profiles } = repos();

  const load = useCallback(async () => {
    const { data } = await db.auth.getUser();
    if (!data.user) {
      setState({ user: null, profile: null, loading: false });
      return;
    }
    const profile = await profiles.getById(data.user.id).catch(() => null);
    setState({ user: data.user, profile, loading: false });
  }, [db, profiles]);

  useEffect(() => {
    void load();
    const { data: sub } = db.auth.onAuthStateChange(() => void load());
    return () => sub.subscription.unsubscribe();
  }, [db, load]);

  const signOut = useCallback(async () => {
    await db.auth.signOut();
    window.location.href = "/login";
  }, [db]);

  return { ...state, signOut, refresh: load };
}
