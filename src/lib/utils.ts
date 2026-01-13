import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function proxiedImageUrl(url: string | null | undefined) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname === "cf.geekdo-images.com") {
      // Geekdo's CDN expects literal parentheses in some filter segments.
      // Many imported URLs contain %28%29 which causes upstream 400.
      const normalized = url.replace(/%28/g, "(").replace(/%29/g, ")");
      return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(normalized)}`;
    }
    return url;
  } catch {
    return url;
  }
}

