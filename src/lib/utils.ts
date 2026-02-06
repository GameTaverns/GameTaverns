import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getSupabaseConfig, isSelfHostedMode } from "@/config/runtime";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Clean and normalize BGG image URLs.
 * BGG CDN often has encoded parentheses that need to be normalized.
 */
function cleanBggUrl(url: string): string {
  // For client-side/browser loading, we want literal parentheses (browsers handle them fine)
  // plus some normalization for BGG's various image formats.
  return url
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2528/g, "(") // Double-encoded
    .replace(/%2529/g, ")")
    // BGG often provides a 1200x630 OpenGraph image; normalize to the square imagepage variant
    // so box art doesn't render like a "half-rectangle" in our square-ish containers.
    .replace(/__opengraph\b/g, "__imagepage")
    .replace(/\/fit-in\/1200x630\//g, "/fit-in/600x600/")
    .replace(/&quot;.*$/, "") // Remove HTML entities from bad scraping
    .replace(/[\s\u0000-\u001F]+$/g, "") // Strip trailing control/whitespace
    .replace(/[;,]+$/g, ""); // Remove trailing punctuation (common scraping artifacts)
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
      // In self-hosted mode, use local API proxy if available
      if (isSelfHostedMode()) {
        const normalized = cleanBggUrl(url);
        return `/api/image-proxy?url=${encodeURIComponent(normalized)}`;
      }
      
      // Cloud mode: use Supabase Edge Function
      const { url: apiUrl } = getSupabaseConfig();
      if (apiUrl) {
        const normalized = cleanBggUrl(url);
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
