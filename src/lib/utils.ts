import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isSelfHostedMode, isSelfHostedSupabaseStack } from "@/config/runtime";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Clean and normalize BGG image URLs.
 * BGG CDN often has encoded parentheses that need to be normalized.
 * 
 * IMPORTANT: We do NOT do format conversions (e.g., __opengraph -> __imagepage) here
 * because not all BGG images have equivalent formats. Gallery/gameplay images only
 * exist in their original format and converting breaks them with 404s.
 */
function cleanBggUrl(url: string): string {
  // For client-side/browser loading, we want literal parentheses (browsers handle them fine)
  return url
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2528/g, "(") // Double-encoded
    .replace(/%2529/g, ")")
    .replace(/&quot;.*$/, "") // Remove HTML entities from bad scraping
    .replace(/[\s\u0000-\u001F]+$/g, "") // Strip trailing control/whitespace
    .replace(/[;,]+$/g, ""); // Remove trailing punctuation (common scraping artifacts)
}

/**
 * Get the apex/platform URL for API calls that need to route through the main domain.
 * 
 * For self-hosted Supabase stack, this returns the configured SUPABASE_URL from runtime config
 * (e.g., https://gametaverns.com), NOT the same-origin URL. This is important for features
 * like the image proxy that are only routed on the apex domain's Nginx config.
 * 
 * Tenant subdomains (e.g., tzolaks-tavern.gametaverns.com) don't have their own /functions/v1
 * routing, so we must use the apex domain for edge function calls like image-proxy.
 */
function getApexApiUrl(): string | null {
  // Check runtime config first (self-hosted Supabase stack)
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.SUPABASE_URL) {
    return window.__RUNTIME_CONFIG__.SUPABASE_URL;
  }
  
  // Fall back to Vite env (Lovable Cloud)
  const viteUrl = import.meta.env.VITE_SUPABASE_URL;
  if (viteUrl) {
    return viteUrl;
  }
  
  return null;
}

/**
 * Returns an image URL, using proxy for BGG images to bypass hotlink protection.
 * Falls back to direct URL if proxy isn't available.
 * 
 * BGG's CDN (cf.geekdo-images.com) has hotlink protection that blocks requests
 * without proper Referer headers. Our proxy adds appropriate headers.
 */
export function proxiedImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  
  try {
    const u = new URL(url);
    
    // Only proxy BGG images - other images (like Unsplash) work fine directly
    if (u.hostname === "cf.geekdo-images.com" || u.hostname === "cf.geekdo-static.com") {
      const normalized = cleanBggUrl(url);
      
      // In legacy Express API self-hosted mode, use /api path
      if (isSelfHostedMode()) {
        return `/api/image-proxy?url=${encodeURIComponent(normalized)}`;
      }
      
      // Self-hosted Supabase stack: use the APEX domain for edge function routing
      // Tenant subdomains don't have /functions/v1 proxied, only the main domain does
      if (isSelfHostedSupabaseStack()) {
        const apexUrl = getApexApiUrl();
        if (apexUrl) {
          return `${apexUrl}/functions/v1/image-proxy?url=${encodeURIComponent(normalized)}`;
        }
        // Fallback to same-origin if no apex URL available
        return `/functions/v1/image-proxy?url=${encodeURIComponent(normalized)}`;
      }
      
      // Cloud mode: use full Supabase Edge Function URL
      const apiUrl = getApexApiUrl();
      if (apiUrl) {
        return `${apiUrl}/functions/v1/image-proxy?url=${encodeURIComponent(normalized)}`;
      }
    }
    
    // For all other URLs (Unsplash, etc.), just return the original
    return cleanBggUrl(url);
  } catch {
    return url;
  }
}

/**
 * Check if a URL is a BGG image that needs proxying
 */
export function isBggImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname === "cf.geekdo-images.com" || u.hostname === "cf.geekdo-static.com";
  } catch {
    return false;
  }
}

/**
 * Get the best image URL - uses proxy for BGG images, direct for others
 */
export function getOptimalImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  
  // For BGG images, always use proxy first (bypasses hotlink protection reliably)
  if (isBggImage(url)) {
    return proxiedImageUrl(url);
  }
  
  // For other images, use direct URL
  return directImageUrl(url);
}

/**
 * Get direct URL without proxy - used as fallback when proxy fails
 */
export function directImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  
  try {
    return cleanBggUrl(url);
  } catch {
    return url;
  }
}
