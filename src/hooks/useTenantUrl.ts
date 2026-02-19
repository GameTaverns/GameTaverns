import { useTenant } from "@/contexts/TenantContext";
import { useSearchParams } from "react-router-dom";
import { isProductionDeployment } from "@/config/runtime";

/**
 * Detects the base domain for subdomain URL generation
 * Returns null if we can't determine the base domain (use query params instead)
 * 
 * IMPORTANT: Only gametaverns.com supports wildcard subdomain routing.
 * All other domains (custom domains, Lovable preview, localhost) must use
 * query-parameter routing (?tenant=slug) because they can't handle subdomains.
 */
function getBaseDomain(): string | null {
  try {
    const hostname = window.location.hostname;
    
    // Skip localhost - use query params
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return null;
    }
    
    // Skip Lovable preview domains - use query params
    if (
      hostname.endsWith(".lovable.app") ||
      hostname.endsWith(".lovableproject.com")
    ) {
      return null;
    }
    
    // ONLY gametaverns.com supports wildcard subdomain routing
    // All other custom domains (e.g., tavern.tzolak.com) cannot handle
    // wildcard subdomains and must use query-param routing
    if (hostname.endsWith(".gametaverns.com") || hostname === "gametaverns.com") {
      return "gametaverns.com";
    }
    
    // For all other domains (custom domains like tavern.tzolak.com),
    // return null to force query-param routing
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the main platform URL (apex domain, not subdomain)
 * Used for platform-level routes like /dashboard, /login, /settings
 */
export function getPlatformUrl(path: string = "/"): string {
  const baseDomain = getBaseDomain();
  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
  
  // In production on gametaverns.com, use the apex domain
  if (baseDomain && isProductionDeployment()) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${protocol}//${baseDomain}${normalizedPath}`;
  }
  
  // For Lovable preview / localhost, just use relative path (no subdomain issues)
  return path;
}

/**
 * Hook to build tenant-aware URLs
 * 
 * In production/self-hosted: Uses real subdomains (library.gametaverns.com)
 * In Lovable preview: Uses query params (?tenant=library)
 */
export function useTenantUrl() {
  const { tenantSlug } = useTenant();
  const [searchParams] = useSearchParams();
  
  /**
   * Build an absolute URL to a tenant library
   * @param slug - The library slug
   * @param path - Optional path within the library (e.g., "/games", "/settings")
   */
  const buildTenantUrl = (slug: string, path: string = "/"): string => {
    const baseDomain = getBaseDomain();
    const protocol = window.location.protocol;
    
    // Use subdomain URL for production deployments
    if (baseDomain && isProductionDeployment()) {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      return `${protocol}//${slug}.${baseDomain}${normalizedPath}`;
    }
    
    // Fall back to query param for Lovable preview / localhost
    const params = new URLSearchParams();
    params.set("tenant", slug);
    
    // If there's a path, use the ?path= param pattern for SPA routing
    if (path && path !== "/") {
      params.set("path", path);
    }
    
    return `/?${params.toString()}`;
  };
  
  /**
   * Build a URL within the current tenant context
   * @param path - The path to navigate to (e.g., "/game/catan")
   * @param additionalParams - Optional additional query parameters
   */
  const buildUrl = (path: string, additionalParams?: Record<string, string>): string => {
    // If we're in a tenant context, build a tenant-aware URL
    if (tenantSlug) {
      const baseDomain = getBaseDomain();
      const protocol = window.location.protocol;
      
      // Use subdomain for production
      if (baseDomain && isProductionDeployment()) {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        let url = `${protocol}//${tenantSlug}.${baseDomain}${normalizedPath}`;
        
        // Add additional params if any
        if (additionalParams && Object.keys(additionalParams).length > 0) {
          const params = new URLSearchParams(additionalParams);
          url += `?${params.toString()}`;
        }
        
        return url;
      }
      
      // Fall back to query params for Lovable preview
      const params = new URLSearchParams();
      params.set("tenant", tenantSlug);
      
      if (additionalParams) {
        Object.entries(additionalParams).forEach(([key, value]) => {
          params.set(key, value);
        });
      }
      
      return `${path}?${params.toString()}`;
    }
    
    // No tenant context - just return the path with any additional params
    if (additionalParams && Object.keys(additionalParams).length > 0) {
      const params = new URLSearchParams(additionalParams);
      return `${path}?${params.toString()}`;
    }
    
    return path;
  };
  
  /**
   * Get the current tenant query string (e.g., "?tenant=tzolak")
   * For backward compatibility with existing code
   */
  const getTenantQueryString = (): string => {
    if (!tenantSlug) return "";
    return `?tenant=${tenantSlug}`;
  };
  
  /**
   * Check if we should use subdomain URLs (production) or query params (preview)
   */
  const useSubdomainUrls = (): boolean => {
    return getBaseDomain() !== null && isProductionDeployment();
  };
  
  return {
    buildUrl,
    buildTenantUrl,
    getTenantQueryString,
    getPlatformUrl,
    tenantSlug,
    useSubdomainUrls,
  };
}

/**
 * Utility to get the external URL for a library
 * Can be used outside of React components
 */
export function getLibraryUrl(slug: string, path: string = "/"): string {
  const baseDomain = getBaseDomain();
  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";

  // On native Capacitor, we use HashRouter so subdomain URLs won't work.
  // Instead, encode as query params so react-router can handle them client-side.
  const isNative =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "capacitor:");

  if (!isNative && baseDomain && isProductionDeployment()) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${protocol}//${slug}.${baseDomain}${normalizedPath}`;
  }
  
  // Fallback for preview and native
  const params = new URLSearchParams();
  params.set("tenant", slug);
  if (path && path !== "/") {
    params.set("path", path);
  }
  return `/?${params.toString()}`;
}
