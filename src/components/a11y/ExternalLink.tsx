import { ReactNode } from "react";

/**
 * Screen-reader-only text warning that a link opens in a new tab.
 * Place inside any <a target="_blank"> for WCAG compliance.
 */
export function NewTabWarning() {
  return <span className="sr-only">(opens in a new tab)</span>;
}

/**
 * Accessible external link that always warns screen readers
 * and shows a visual indicator (optional).
 */
export function ExternalLink({
  href,
  children,
  className,
  title,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={title}
      {...props}
    >
      {children}
      <NewTabWarning />
    </a>
  );
}
