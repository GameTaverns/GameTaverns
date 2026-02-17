import { Link } from "react-router-dom";
import { getPlatformUrl } from "@/hooks/useTenantUrl";
import { cn } from "@/lib/utils";

interface UserLinkProps {
  username?: string | null;
  displayName?: string | null;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Renders a user's display name as a link to their /u/username profile page.
 * Falls back to plain text if no username is available.
 */
export function UserLink({ username, displayName, className, children }: UserLinkProps) {
  const label = children || displayName || username || "Unknown";

  if (!username) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link
      to={getPlatformUrl(`/u/${username}`)}
      className={cn(
        "hover:text-primary hover:underline underline-offset-2 transition-colors",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Link>
  );
}
