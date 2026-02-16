import { useState, useEffect, type ReactNode } from "react";
import { directImageUrl, proxiedImageUrl } from "@/lib/utils";

interface TenantLogoImageProps {
  url: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}

/**
 * Convert absolute Supabase storage URLs to same-origin relative paths.
 * Stored URLs may point to a Cloud/Lovable domain that doesn't resolve on
 * self-hosted deployments. Extracting the `/storage/…` path lets the
 * browser resolve it against the current origin (apex or subdomain).
 */
function toLocalStorageUrl(url: string): string {
  try {
    const u = new URL(url);
    // Match any Supabase-style storage path, regardless of host
    const match = u.pathname.match(/(\/storage\/v1\/object\/public\/.+)/);
    if (match) return match[1];
  } catch {
    // not a valid URL – return as-is
  }
  return url;
}

/**
 * Tenant logo image with the same hotlink-protection handling as game images.
 * - Rewrites absolute storage URLs to same-origin paths
 * - Tries direct URL first
 * - Falls back to proxy for BGG CDN
 * - Uses referrerPolicy=no-referrer for best compatibility
 */
export function TenantLogoImage({ url, alt, className, fallback }: TenantLogoImageProps) {
  const localUrl = toLocalStorageUrl(url);
  const [useProxyFallback, setUseProxyFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset state when the URL changes so stale error flags don't block a new image
  useEffect(() => {
    setUseProxyFallback(false);
    setFailed(false);
  }, [localUrl]);

  const src = useProxyFallback ? proxiedImageUrl(localUrl) : directImageUrl(localUrl);

  if (failed) return <>{fallback ?? null}</>;

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="eager"
      decoding="async"
      onError={() => {
        if (!useProxyFallback) setUseProxyFallback(true);
        else setFailed(true);
      }}
      className={className}
    />
  );
}
