import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchIsAdmin = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        if (error) {
          console.error("[useAuth] role lookup error", error);
          return false;
        }

        return !!data;
      } catch (e) {
        console.error("[useAuth] role lookup exception", e);
        return false;
      }
    };

    const applySession = async (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const nextIsAdmin = await fetchIsAdmin(nextSession.user.id);
        if (!mounted) return;
        setIsAdmin(nextIsAdmin);
        console.log("[useAuth] session user", nextSession.user.id, nextSession.user.email, { isAdmin: nextIsAdmin });
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    };

    // Set up auth state listener BEFORE checking session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      await applySession(nextSession);
    });

    // Check for existing session
    supabase.auth
      .getSession()
      .then(async ({ data: { session: existingSession } }) => {
        await applySession(existingSession);
      })
      .catch((e) => {
        console.error("[useAuth] getSession error", e);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    setIsAdmin(false);
    return { error };
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
    isAdmin,
  };
}
