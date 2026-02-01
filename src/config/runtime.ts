/**
 * Runtime Configuration Helper
 * 
 * Supports three deployment modes:
 * 1. Lovable Cloud: Uses Supabase directly via import.meta.env.VITE_* variables
 * 2. Self-Hosted (Native): Uses Express API backend, no Supabase
 * 3. Cloudron: Uses window.__RUNTIME_CONFIG__ (injected at container start)
 * 
 * Priority: Runtime Config → Vite Env → Defaults
 */

// Type for runtime config injected by Cloudron's start.sh or self-hosted
interface RuntimeConfig {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  API_BASE_URL?: string;
  SELF_HOSTED?: boolean;
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
    ACHIEVEMENTS?: boolean;
    LENDING?: boolean;
  };
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

// Get runtime config (Cloudron/self-hosted) or empty object
function getRuntimeConfig(): RuntimeConfig {
  return (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) || {};
}

/**
 * Detect if running in self-hosted mode
 * 
 * Self-hosted is detected when:
 * 1. Explicitly set via runtime config
 * 2. No Supabase URL is available (neither from runtime nor VITE env)
 * 3. Running on a known self-hosted domain pattern
 */
export function isSelfHostedMode(): boolean {
  const runtime = getRuntimeConfig();
  
  // 1. Explicit runtime flag takes priority (for Cloudron/containerized deployments)
  if (runtime.SELF_HOSTED === true) {
    return true;
  }

  // 1b. Hard override for Lovable environments.
  // In Lovable preview/published apps, there is no self-hosted /api backend available.
  // If we mis-detect self-hosted mode here, the app will start requesting /api/* and
  // appear "empty" (no libraries/games) and auth will fail.
  try {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (
        host.endsWith(".lovableproject.com") ||
        host.endsWith(".lovable.app") ||
        host === "lovable.app" ||
        host === "lovableproject.com"
      ) {
        return false;
      }
    }
  } catch {
    // ignore
  }
  
  // 2. Check if Supabase URL is available - this is the PRIMARY check
  // IMPORTANT: Check VITE env DIRECTLY, not through getConfig which might recurse
  const runtimeSupabaseUrl = runtime.SUPABASE_URL;
  const viteSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  const hasSupabaseUrl = 
    (runtimeSupabaseUrl && runtimeSupabaseUrl !== '') ||
    (viteSupabaseUrl && viteSupabaseUrl !== '');
  
  // If Supabase URL is available, we're in CLOUD mode - NOT self-hosted
  // This check happens BEFORE any localStorage checks to prevent pollution
  if (hasSupabaseUrl) {
    return false;
  }
  
  // 3. No Supabase URL available - we're in self-hosted mode
  // The auth_token check is now secondary confirmation, not primary
  return true;
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
  
  // Check runtime config first (Cloudron/self-hosted)
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
 * Returns empty strings if in self-hosted mode (client will use stub)
 */
export function getSupabaseConfig() {
  // In self-hosted mode we *must* ignore any baked-in Vite env values,
  // otherwise the app will accidentally talk to the cloud auth endpoint.
  if (isSelfHostedMode()) {
    return { url: '', anonKey: '' };
  }

  return {
    url: getConfig('SUPABASE_URL', 'VITE_SUPABASE_URL', ''),
    anonKey: getConfig('SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', ''),
  };
}

/**
 * Get API base URL for self-hosted mode
 */
export function getApiBaseUrl(): string {
  const runtime = getRuntimeConfig();
  
  if (runtime.API_BASE_URL) {
    return runtime.API_BASE_URL;
  }
  
  // Default to relative /api path
  return '/api';
}

/**
 * Get a feature flag from runtime config
 */
export function getRuntimeFeatureFlag(feature: keyof NonNullable<RuntimeConfig['FEATURES']>): boolean | undefined {
  const runtime = getRuntimeConfig();
  return runtime.FEATURES?.[feature];
}
