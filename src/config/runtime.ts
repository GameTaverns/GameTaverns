/**
 * Runtime Configuration Helper
 * 
 * Supports two deployment modes:
 * 1. Lovable/Vite: Uses import.meta.env.VITE_* variables (build-time)
 * 2. Cloudron: Uses window.__RUNTIME_CONFIG__ (injected at container start)
 * 
 * Priority: Runtime Config → Vite Env → Defaults
 */

// Type for runtime config injected by Cloudron's start.sh
interface RuntimeConfig {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SITE_NAME?: string;
  SITE_DESCRIPTION?: string;
  SITE_AUTHOR?: string;
  FEATURES?: {
    PLAY_LOGS?: boolean;
    WISHLIST?: boolean;
    FOR_SALE?: boolean;
    MESSAGING?: boolean;
    COMING_SOON?: boolean;
    DEMO_MODE?: boolean;
    RATINGS?: boolean;
    EVENTS?: boolean;
  };
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

// Get runtime config (Cloudron) or empty object
function getRuntimeConfig(): RuntimeConfig {
  return (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) || {};
}

/**
 * Get a config value with fallback chain:
 * Runtime Config → Vite Env → Default
 */
export function getConfig<T>(
  runtimeKey: keyof RuntimeConfig,
  viteEnvKey: string,
  defaultValue: T
): T {
  const runtime = getRuntimeConfig();
  
  // Check runtime config first (Cloudron)
  const runtimeValue = runtime[runtimeKey];
  if (runtimeValue !== undefined && runtimeValue !== '') {
    return runtimeValue as T;
  }
  
  // Fall back to Vite env (Lovable/dev)
  const viteValue = import.meta.env[viteEnvKey];
  if (viteValue !== undefined && viteValue !== '') {
    return viteValue as T;
  }
  
  // Return default
  return defaultValue;
}

/**
 * Get Supabase configuration
 */
export function getSupabaseConfig() {
  return {
    url: getConfig('SUPABASE_URL', 'VITE_SUPABASE_URL', ''),
    anonKey: getConfig('SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', ''),
  };
}

/**
 * Get a feature flag from runtime config
 */
export function getRuntimeFeatureFlag(feature: keyof NonNullable<RuntimeConfig['FEATURES']>): boolean | undefined {
  const runtime = getRuntimeConfig();
  return runtime.FEATURES?.[feature];
}
