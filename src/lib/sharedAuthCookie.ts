import { isProductionDeployment } from "@/config/runtime";

type SharedAuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
};

const COOKIE_NAME = "gt_shared_auth";

function isGametavernsHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "gametaverns.com" || host.endsWith(".gametaverns.com");
}

function getCookieDomain(): string | null {
  // Only set a cross-subdomain cookie in production on the canonical domain.
  if (!isProductionDeployment()) return null;
  if (!isGametavernsHost()) return null;
  return ".gametaverns.com";
}

export function readSharedAuthTokens(): SharedAuthTokens | null {
  if (typeof document === "undefined") return null;
  if (!isGametavernsHost()) return null;

  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;

  const raw = match.slice(COOKIE_NAME.length + 1);
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as SharedAuthTokens;
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSharedAuthTokens(tokens: SharedAuthTokens | null): void {
  if (typeof document === "undefined") return;
  const domain = getCookieDomain();
  if (!domain) return;

  if (!tokens) {
    clearSharedAuthTokens();
    return;
  }

  // Keep payload small to stay under cookie limits.
  const payload = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at ?? null,
  } satisfies SharedAuthTokens;

  const value = encodeURIComponent(JSON.stringify(payload));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // Lax is fine for top-level navigations between subdomains.
  document.cookie = `${COOKIE_NAME}=${value}; Path=/; Domain=${domain}; SameSite=Lax${secure}`;
}

export function clearSharedAuthTokens(): void {
  if (typeof document === "undefined") return;
  const domain = getCookieDomain();
  if (!domain) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=; Path=/; Domain=${domain}; Max-Age=0; SameSite=Lax${secure}`;
}
