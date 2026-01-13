import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function proxiedImageUrl(url: string | null | undefined) {
  // BGG's CDN is inconsistent about allowing server-side proxies; fall back to
  // direct loading with a strict referrer policy on <img> tags.
  return url;
}

