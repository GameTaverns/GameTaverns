export function isNativeRuntime(): boolean {
  if (typeof window === "undefined") return false;

  if ((window as any).Capacitor?.isNativePlatform?.()) {
    return true;
  }

  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;
  const isLocalNativeHost = hostname === "localhost" || hostname === "127.0.0.1";

  return isLocalNativeHost || protocol === "capacitor:";
}

export function getNativeEffectivePath(routerPathname?: string): string {
  if (!isNativeRuntime()) {
    return routerPathname || "/";
  }

  if (routerPathname && routerPathname !== "/") {
    return routerPathname;
  }

  if (typeof window === "undefined") return "/";

  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#")) return "/";

  const withoutHash = hash.slice(1);
  const [pathname] = withoutHash.split("?");

  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}
