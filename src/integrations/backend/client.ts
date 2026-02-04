import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  getSupabaseConfig,
  isSelfHostedMode as checkSelfHostedMode,
  getApiBaseUrl,
} from "@/config/runtime";
import { computeAuthStorageKey } from "@/lib/authStorageKey";

/**
 * Runtime-configurable Supabase client.
 *
 * In cloud mode, we re-export the official auto-generated client to ensure
 * a single shared instance with consistent auth state.
 * 
 * In self-hosted mode (no Supabase URL), returns a stub client that
 * throws helpful errors if accidentally used. The app should use
 * the API client instead for self-hosted deployments.
 */

// Lazy-initialized Supabase client to ensure env vars are available
// IMPORTANT: Only cache REAL clients, not stubs - this allows recovery if
// mode detection changes (e.g., after patch deployment)
let _supabaseClient: SupabaseClient<Database> | null = null;
let _isRealClient = false;

function getOrCreateSupabaseClient(): SupabaseClient<Database> {
  // Only return cached client if it's a REAL client (not a stub)
  if (_supabaseClient && _isRealClient) return _supabaseClient;
  
  const { url, anonKey } = getSupabaseConfig();
  
  if (url && anonKey) {
    const storageKey = computeAuthStorageKey(url);

    // IMPORTANT:
    // Do NOT import the auto-generated client at module scope.
    // In self-hosted builds, VITE_SUPABASE_URL may be empty, and the
    // auto-generated file initializes createClient() immediately, which
    // crashes the app before our self-hosted stub can take over.
    //
    // Instead, lazily create the real client only when we know we have
    // valid configuration.
    _supabaseClient = createClient<Database>(url, anonKey, {
      auth: {
        storage: localStorage,
        storageKey,
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          // Kong gateway requires apikey header for all requests
          // This is ADDED to existing headers (Authorization, etc.), not replacing them
          apikey: anonKey,
        },
      },
    });
    _isRealClient = true;
    return _supabaseClient;
  }
  
  // Self-hosted mode: create a stub client (NOT cached permanently)
  // This prevents crashes while allowing the app to load
  console.info('[Self-Hosted Mode] Supabase client not available. Using API backend.');
  _isRealClient = false;
  
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
  
  _supabaseClient = new Proxy({} as SupabaseClient<Database>, stubHandler);
  return _supabaseClient;
}

// Export a getter that lazily initializes the client
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getOrCreateSupabaseClient() as any)[prop];
  },
});

/**
 * Check if we should use API client (self-hosted) vs Supabase (cloud)
 * This is a function that checks fresh each time - not cached at module load
 */
export function isSelfHostedMode(): boolean {
  return checkSelfHostedMode();
}

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

// isSelfHostedMode is now defined above as a function
