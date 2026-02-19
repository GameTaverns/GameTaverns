/**
 * TenantLink - Router-aware link component for cross-tenant/cross-library navigation.
 *
 * On native (Capacitor/localhost), getLibraryUrl() returns a relative query-param
 * URL like /?tenant=slug&path=/games. We must use React Router's <Link> so that
 * navigation stays inside the WebView's HashRouter without a page reload.
 *
 * On web production (gametaverns.com subdomain), getLibraryUrl() returns an
 * absolute cross-subdomain URL like https://slug.gametaverns.com/games. In that
 * case we use a real <a> tag so the browser can navigate cross-origin correctly.
 */
import { Link } from "react-router-dom";
import { forwardRef } from "react";

function isNativeEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  const p = window.location.protocol;
  return h === "localhost" || h === "127.0.0.1" || p === "capacitor:";
}

function isAbsoluteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//");
}

interface TenantLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

/**
 * Use this component instead of <a href={getLibraryUrl(...)}> or <a href={buildUrl(...)}>
 * to ensure navigation works correctly on both native (HashRouter) and web (subdomain).
 */
const TenantLink = forwardRef<HTMLAnchorElement, TenantLinkProps>(
  ({ href, children, className, onClick, ...props }, ref) => {
    // On native, getLibraryUrl returns relative query-param URLs.
    // On web preview/lovable, also relative.
    // Only on web production does it return absolute subdomain URLs.
    const shouldUseRouterLink = isNativeEnvironment() || !isAbsoluteUrl(href);

    if (shouldUseRouterLink) {
      return (
        <Link
          to={href}
          className={className}
          onClick={onClick as any}
          {...(props as any)}
        >
          {children}
        </Link>
      );
    }

    // Web production: use real <a> for cross-subdomain navigation
    return (
      <a ref={ref} href={href} className={className} onClick={onClick} {...props}>
        {children}
      </a>
    );
  }
);

TenantLink.displayName = "TenantLink";

export { TenantLink };
