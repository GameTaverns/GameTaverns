/**
 * PocketBase Authentication Hook
 * 
 * Replaces Supabase auth with PocketBase's built-in authentication.
 * Much simpler - no edge cases with storage locks or token refresh issues.
 */

import { useEffect, useState, useCallback } from 'react';
import { pb } from '@/integrations/pocketbase/client';
import type { User } from '@/integrations/pocketbase/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(pb.authStore.model as User | null);
  const [loading, setLoading] = useState(true);

  // Subscribe to auth changes
  useEffect(() => {
    // Set initial state
    setUser(pb.authStore.model as User | null);
    setLoading(false);

    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model as User | null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      return { error: null, user: authData.record as User };
    } catch (error: any) {
      return { 
        error: { message: error?.message || 'Invalid login credentials' },
        user: null 
      };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    try {
      // Create the user
      const userData = {
        email,
        password,
        passwordConfirm: password,
        name: name || email.split('@')[0],
        role: 'user', // Default role
      };
      
      await pb.collection('users').create(userData);
      
      // Auto sign in after signup
      const authData = await pb.collection('users').authWithPassword(email, password);
      
      return { error: null, user: authData.record as User };
    } catch (error: any) {
      return { 
        error: { message: error?.message || 'Failed to create account' },
        user: null 
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    pb.authStore.clear();
    return { error: null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await pb.collection('users').requestPasswordReset(email);
      return { error: null };
    } catch (error: any) {
      return { 
        error: { message: error?.message || 'Failed to send reset email' }
      };
    }
  }, []);

  // Computed properties
  const isAuthenticated = pb.authStore.isValid;
  const isAdmin = user?.role === 'admin';
  const roleLoading = loading; // Role is included in user record, no separate lookup needed

  return {
    user,
    session: pb.authStore.isValid ? { access_token: pb.authStore.token } : null,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    isAuthenticated,
    isAdmin,
    roleLoading,
  };
}
