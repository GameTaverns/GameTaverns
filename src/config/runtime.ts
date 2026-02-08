/**
 * Runtime Configuration Helper
 * Version: 2.7.1 - Connection Fix Edition
 * 
 * Supports THREE deployment modes:
 * 
 * 1. Lovable Cloud: Uses Supabase directly via import.meta.env.VITE_* variables
 *    - VITE_SUPABASE_URL = https://xxx.supabase.co
 *    - Standard Supabase client handles all API calls
 * 
 * 2. Self-Hosted Supabase Stack: Uses window.__RUNTIME_CONFIG__ (injected by inject-config.sh)
 *    - SELF_HOSTED = false (uses Supabase client, NOT Express API)
 *    - SUPABASE_URL = https://gametaverns.com (same-origin)
 *    - Host Nginx proxies /auth/, /rest/, /functions/ to Kong gateway
 *    - This IS a real Supabase environment, just containerized
 * 
 * 3. Express API Mode (LEGACY): Uses /api/* endpoints with Express backend
 *    - SELF_HOSTED = true (in runtime config)
 *    - No Supabase URL available
 *    - This mode is DEPRECATED and not supported in deploy/supabase-selfhosted
 * 
 * Priority: Runtime Config → Vite Env → Defaults
 */

// Type for runtime config injected by inject-config.sh or self-hosted
interface RuntimeConfig {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  API_BASE_URL?: string;
  SELF_HOSTED?: boolean;
  IS_PRODUCTION?: boolean;
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

// Get runtime config (self-hosted Supabase or legacy Express) or empty object
function getRuntimeConfig(): RuntimeConfig {
  return (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) || {};
}

/**
 * Detect if running in EXPRESS API self-hosted mode (LEGACY)
 * 
 * This is DIFFERENT from self-hosted Supabase stack!
 * 
 * EXPRESS API mode is detected when:
 * 1. Explicitly set via runtime config SELF_HOSTED: true
 * 2. No Supabase URL is available (neither from runtime nor VITE env)
 * 
 * Self-hosted Supabase stack uses:
 * - SELF_HOSTED: false (uses Supabase client)
 * - SUPABASE_URL: https://yourdomain.com (same-origin routing)
 * 
 * Returns TRUE only for legacy Express API mode, not self-hosted Supabase
 */
export function isSelfHostedMode(): boolean {
  const runtime = getRuntimeConfig();

  // 1. Explicit runtime flag takes priority
  // SELF_HOSTED: true = Legacy Express API mode
  // SELF_HOSTED: false = Use Supabase client (cloud OR self-hosted Supabase stack)
  //
  // Robustness: if a deployment provides SUPABASE_URL/ANON_KEY, we MUST treat it as
  // Supabase mode even if SELF_HOSTED was accidentally set to true.
  if (runtime.SELF_HOSTED === true) {
    const hasRuntimeSupabase = Boolean(runtime.SUPABASE_URL && runtime.SUPABASE_ANON_KEY);
    return !hasRuntimeSupabase;
  }

  // If runtime config explicitly says SELF_HOSTED: false, use Supabase mode
  // This is the case for self-hosted Supabase stack (inject-config.sh sets this)
  if (runtime.SELF_HOSTED === false) {
    return false;
  }

  // 2. Hard override for Lovable environments
  // In Lovable preview/published apps, there is no Express /api backend available
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
  
  // 3. Check if Supabase URL is available - this is the PRIMARY check
  // IMPORTANT: Check runtime config FIRST (for self-hosted Supabase)
  const runtimeSupabaseUrl = runtime.SUPABASE_URL;
  const viteSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  const hasSupabaseUrl = 
    (runtimeSupabaseUrl && runtimeSupabaseUrl !== '') ||
    (viteSupabaseUrl && viteSupabaseUrl !== '');
  
  // If Supabase URL is available, we're in SUPABASE mode - NOT Express API
  if (hasSupabaseUrl) {
    return false;
  }
  
  // 4. No Supabase URL available and no explicit config - assume Express API mode
  return true;
}

/**
 * Check if running on self-hosted Supabase stack (gametaverns.com or gamehavens.com)
 * This is used for features that need to know if they're on a self-hosted instance
 * but NOT in legacy Express API mode - specifically for image proxy routing.
 */
export function isSelfHostedSupabaseStack(): boolean {
  const runtime = getRuntimeConfig();

  // Any deployment that injects SUPABASE_URL at runtime (and is NOT legacy Express mode)
  // should be treated as the self-hosted Supabase stack.
  // This must work for custom domains/IPs, not only gametaverns.com.
  if (runtime.SELF_HOSTED === false && runtime.SUPABASE_URL) {
    return true;
  }

  // Back-compat: if runtime says "not legacy self-hosted" (or provides SUPABASE_URL),
  // we can also infer self-hosted by hostname as a fallback.
  if (runtime.SELF_HOSTED === false || runtime.SUPABASE_URL) {
    try {
      if (typeof window !== "undefined") {
        const host = window.location.hostname.toLowerCase();
        if (
          host === "gametaverns.com" ||
          host.endsWith(".gametaverns.com") ||
          host === "gamehavens.com" ||
          host.endsWith(".gamehavens.com")
        ) {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }

  return false;
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
  const runtime = getRuntimeConfig();

  // In legacy Express API mode we *must* ignore any baked-in Vite env values,
  // otherwise the app will accidentally talk to the cloud auth endpoint.
  //
  // NOTE: Some misconfigured deployments may set SELF_HOSTED=true while still
  // providing SUPABASE_URL/ANON_KEY; isSelfHostedMode() is robust against that.
  if (isSelfHostedMode()) {
    return { url: '', anonKey: '' };
  }

  const url = getConfig('SUPABASE_URL', 'VITE_SUPABASE_URL', '');
  const anonKey = getConfig('SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', '');

  // IMPORTANT (Self-hosted multi-tenant same-origin routing):
  // In the self-hosted stack we often set SUPABASE_URL to the platform domain
  // (e.g. https://gametaverns.com) to route /auth,/rest,/functions via host Nginx.
  // But when a user is browsing a tenant subdomain (e.g. https://foo.gametaverns.com)
  // we MUST use the *current* origin; otherwise requests become cross-origin and can
  // be blocked by the site's Content-Security-Policy connect-src 'self'.
  //
  // So: if we're on a gametaverns.com subdomain and the configured URL points at
  // the apex domain, force same-origin.
  try {
    if (typeof window !== 'undefined' && url) {
      const host = window.location.hostname.toLowerCase();
      const isGametavernsHost = host === 'gametaverns.com' || host.endsWith('.gametaverns.com');
      if (isGametavernsHost && host !== 'gametaverns.com') {
        const configuredHost = new URL(url).hostname.toLowerCase();
        if (configuredHost === 'gametaverns.com') {
          return { url: window.location.origin, anonKey };
        }
      }
    }
  } catch {
    // If URL parsing fails, fall back to provided values.
  }

  return { url, anonKey };
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

/**
 * Check if this is a production deployment that supports subdomain routing
 * Returns true ONLY if:
 * 1. IS_PRODUCTION is explicitly set to true in runtime config
 * 2. Running on gametaverns.com or a subdomain of it
 * 
 * Other custom domains (e.g., tavern.tzolak.com) return false
 * because they can't handle wildcard subdomains and should use query-param routing
 */
export function isProductionDeployment(): boolean {
  const runtime = getRuntimeConfig();
  
  // Explicit runtime flag takes priority
  if (runtime.IS_PRODUCTION === true) {
    return true;
  }
  
  // Check hostname
  try {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      
      // ONLY gametaverns.com supports subdomain routing
      // All other domains (including custom domains like tavern.tzolak.com)
      // should use query-param routing like Lovable preview
      if (host === "gametaverns.com" || host.endsWith(".gametaverns.com")) {
        return true;
      }
      
      // All other domains use query-param routing
      return false;
    }
  } catch {
    // ignore
  }
  
  return false;
}

/**
 * Check if running on Lovable Cloud (not self-hosted)
 * Returns true ONLY if running on *.lovable.app or *.lovableproject.com
 * 
 * This is the inverse of detecting "user's own deployment" - use this to hide
 * attribution logos that should only appear on self-hosted instances.
 */
export function isLovableCloud(): boolean {
  try {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      
      // Lovable preview and published domains
      if (
        host.endsWith(".lovable.app") ||
        host.endsWith(".lovableproject.com") ||
        host === "lovable.app" ||
        host === "lovableproject.com"
      ) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  
  return false;
}
