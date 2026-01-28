import { useTenant } from "@/contexts/TenantContext";
import { useSearchParams } from "react-router-dom";

/**
 * Hook to build tenant-aware URLs that preserve the ?tenant=slug parameter
 */
export function useTenantUrl() {
  const { tenantSlug } = useTenant();
  const [searchParams] = useSearchParams();
  
  /**
   * Build a URL that preserves tenant context
   * @param path - The path to navigate to (e.g., "/game/catan")
   * @param additionalParams - Optional additional query parameters
   */
  const buildUrl = (path: string, additionalParams?: Record<string, string>): string => {
    const params = new URLSearchParams();
    
    // Preserve tenant if we're in tenant mode
    if (tenantSlug) {
      params.set("tenant", tenantSlug);
    }
    
    // Add any additional params
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        params.set(key, value);
      });
    }
    
    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
  };
  
  /**
   * Get the current tenant query string (e.g., "?tenant=tzolak")
   */
  const getTenantQueryString = (): string => {
    if (!tenantSlug) return "";
    return `?tenant=${tenantSlug}`;
  };
  
  return {
    buildUrl,
    getTenantQueryString,
    tenantSlug,
  };
}
