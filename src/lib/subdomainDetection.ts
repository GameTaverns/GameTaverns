/**
 * Detects whether the current hostname is a specific reserved subdomain.
 * Works for both production (*.gametaverns.com) and development environments.
 */

const RESERVED_SUBDOMAINS = ["www", "api", "mail", "webmail", "admin", "studio", "dashboard"] as const;
type ReservedSubdomain = typeof RESERVED_SUBDOMAINS[number];

function getCurrentSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;

  // Production: *.gametaverns.com
  if (hostname.endsWith(".gametaverns.com")) {
    const parts = hostname.split(".");
    if (parts.length === 3) return parts[0];
  }

  return null;
}

export function isAdminSubdomain(): boolean {
  return getCurrentSubdomain() === "admin";
}

export function isStudioSubdomain(): boolean {
  return getCurrentSubdomain() === "studio";
}

export function isReservedSubdomain(): boolean {
  const sub = getCurrentSubdomain();
  return sub !== null && (RESERVED_SUBDOMAINS as readonly string[]).includes(sub);
}
