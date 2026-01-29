import { useState, type ReactNode } from "react";
import { directImageUrl, proxiedImageUrl } from "@/lib/utils";

interface TenantLogoImageProps {
  url: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}

/**
 * Tenant logo image with the same hotlink-protection handling as game images.
 * - Tries direct URL first
 * - Falls back to proxy for BGG CDN
 * - Uses referrerPolicy=no-referrer for best compatibility
 */
export function TenantLogoImage({ url, alt, className, fallback }: TenantLogoImageProps) {
  const [useProxyFallback, setUseProxyFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  const src = useProxyFallback ? proxiedImageUrl(url) : directImageUrl(url);

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
