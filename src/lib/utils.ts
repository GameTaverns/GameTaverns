import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Clean and normalize BGG image URLs.
 * BGG CDN often has encoded parentheses that need to be normalized.
 */
function cleanBggUrl(url: string): string {
  // For client-side/browser loading, we want literal parentheses (browsers handle them fine)
  return url
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2528/g, "(")  // Double-encoded
    .replace(/%2529/g, ")")
    .replace(/&quot;.*$/, "") // Remove HTML entities from bad scraping
    .replace(/;$/, "");       // Remove trailing semicolons
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
    if (u.hostname === "cf.geekdo-images.com") {
      const normalized = cleanBggUrl(url);
      return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(normalized)}`;
    }
    
    // For all other URLs (Unsplash, etc.), just return the original
    return url;
  } catch {
    return url;
  }
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
