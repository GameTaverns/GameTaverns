import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSupabaseConfig, isSelfHostedMode, getApiBaseUrl } from "@/config/runtime";

/**
 * Runtime-configurable Supabase client.
 *
 * In self-hosted mode (no Supabase URL), returns a stub client that
 * throws helpful errors if accidentally used. The app should use
 * the API client instead for self-hosted deployments.
 */
const { url, anonKey } = getSupabaseConfig();

// Create a real or stub Supabase client based on mode
function createSupabaseClient(): SupabaseClient<Database> {
  if (url && anonKey) {
    // Real Supabase client for cloud mode
    return createClient<Database>(url, anonKey, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  
  // Self-hosted mode: create a stub client
  // This prevents crashes while allowing the app to load
  console.info('[Self-Hosted Mode] Supabase client not available. Using API backend.');
  
  // Return a minimal stub that satisfies the SupabaseClient type
  // In self-hosted mode, the app should route through /api/* endpoints
  const stubHandler = {
    get(_target: any, prop: string) {
      // Allow checking auth state (returns null/empty)
      if (prop === 'auth') {
        return {
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
          getUser: () => Promise.resolve({ data: { user: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signOut: () => Promise.resolve({ error: null }),
          signInWithPassword: () => Promise.resolve({ 
            data: { user: null, session: null }, 
            error: { message: 'Use /api/auth endpoints in self-hosted mode' } 
          }),
          signUp: () => Promise.resolve({ 
            data: { user: null, session: null }, 
            error: { message: 'Use /api/auth endpoints in self-hosted mode' } 
          }),
        };
      }
      
      // For other methods, return a function that returns empty data
      return () => ({
        select: () => stubHandler,
        insert: () => stubHandler,
        update: () => stubHandler,
        delete: () => stubHandler,
        eq: () => stubHandler,
        single: () => stubHandler,
        maybeSingle: () => stubHandler,
        order: () => stubHandler,
        limit: () => stubHandler,
        then: (resolve: any) => resolve({ data: null, error: { message: 'Self-hosted mode: use API' } }),
      });
    },
  };
  
  return new Proxy({} as SupabaseClient<Database>, stubHandler);
}

export const supabase = createSupabaseClient();

/**
 * API client for self-hosted mode
 * Makes requests to the Express backend at /api/*
 */
export const apiClient = {
  baseUrl: getApiBaseUrl(),
  
  async get<T>(path: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  async post<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  async put<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  
  async delete<T>(path: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

/**
 * Check if we should use API client (self-hosted) vs Supabase (cloud)
 */
export { isSelfHostedMode };
