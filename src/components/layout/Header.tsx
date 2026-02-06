import { Link, useSearchParams, useLocation } from "react-router-dom";
import { Menu, X, FlaskConical, User, Globe, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useDemoMode } from "@/contexts/DemoContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useLibrary";
import { JoinLibraryButton } from "@/components/library/JoinLibraryButton";
import { isProductionDeployment } from "@/config/runtime";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import { FeaturedBadge } from "@/components/achievements/FeaturedBadge";

// Get the base platform URL for a specific path (main domain, not subdomain)
function getPlatformUrl(path: string = "/dashboard"): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // For subdomains like tzolaks-tavern.gametaverns.com, go to gametaverns.com
  if (hostname.endsWith(".gametaverns.com")) {
    return `${protocol}//gametaverns.com${path}`;
  }
  
  // For localhost or preview, just use the path
  return path;
}
// Social media icons as inline SVGs for consistency with site styling
const TwitterIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
  </svg>
);

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
  hideSidebarToggle?: boolean;
}

export function Header({ onMenuClick, isSidebarOpen, hideSidebarToggle = false }: HeaderProps) {
  const { data: settings } = useSiteSettings();
  const { isDemoMode } = useDemoMode();
  const { demoMode: demoModeEnabled } = useFeatureFlags();
  const { tenantSlug, library, isOwner } = useTenant();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { data: profile } = useUserProfile();
  const { buildUrl } = useTenantUrl();
  
  // Build tenant-aware home URL
  const homeUrl = isDemoMode ? "/?demo=true" : buildUrl("/");
  
  const socialLinks = [
    { url: settings?.twitter_handle, icon: TwitterIcon, label: "Twitter/X", isHandle: true },
    { url: settings?.instagram_url, icon: InstagramIcon, label: "Instagram" },
    { url: settings?.facebook_url, icon: FacebookIcon, label: "Facebook" },
    { url: settings?.discord_url, icon: DiscordIcon, label: "Discord" },
  ].filter(link => link.url);

  const formatUrl = (link: typeof socialLinks[0]) => {
    if (!link.url) return "#";
    if (link.isHandle) {
      // Handle Twitter/X handles - convert @handle or handle to URL
      const handle = link.url.replace(/^@/, '');
      return `https://x.com/${handle}`;
    }
    // Ensure URL has protocol
    if (!link.url.startsWith('http')) {
      return `https://${link.url}`;
    }
    return link.url;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-8">
        {/* Mobile menu button */}
        {!hideSidebarToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        )}

        {/* Spacer for layout */}
        <div className="flex-1" />

        {/* Right side actions */}
        <nav className="flex items-center gap-1">
          {/* Social Media Icons */}
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={formatUrl(link)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={link.label}
            >
              <link.icon className="h-4 w-4" />
            </a>
          ))}
          
          {socialLinks.length > 0 && (
            <div className="w-px h-4 bg-border mx-1" />
          )}
          
          {/* Join Community button - show for authenticated non-owners viewing a library */}
          {library && isAuthenticated && !isOwner && !isDemoMode && (
            <>
              <JoinLibraryButton
                libraryId={library.id}
                libraryName={library.name}
                showMemberCount={false}
                variant="outline"
                size="sm"
              />
              <div className="w-px h-4 bg-border mx-1" />
            </>
          )}
          
          <ThemeToggle />
          
          {/* Demo mode navigation */}
          {isDemoMode && location.pathname !== "/demo/settings" && (
            <Link 
              to="/demo/settings" 
              className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">Demo Settings</span>
            </Link>
          )}
          
          {/* Home link for tenant subdomains - goes to the library's own home page */}
          {tenantSlug && !isDemoMode && (
            <a
              href="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2"
            >
              Home
            </a>
          )}
          
          {/* Home link - shown outside tenant context OR in demo mode */}
          {(!tenantSlug || isDemoMode) && (
            <Link to={homeUrl} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2">
              Home
            </Link>
          )}
          
          {/* Browse Libraries / Back to Dashboard (platform) */}
          {!tenantSlug && !isDemoMode && (
            location.pathname === "/directory" && isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Link>
            ) : (
              <Link
                to="/directory"
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Browse Libraries</span>
              </Link>
            )
          )}
          
          {/* Tenant subdomain: Dashboard link for authenticated users */}
          {tenantSlug && !isDemoMode && isAuthenticated && (
            <a
              href={getPlatformUrl("/dashboard")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2"
            >
              Dashboard
            </a>
          )}
          
          {/* Tenant subdomain: Sign In link for anonymous users */}
          {tenantSlug && !isDemoMode && !isAuthenticated && (
            <a
              href={getPlatformUrl("/login")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2"
            >
              Sign In
            </a>
          )}
          
          {/* User display name with featured badge when viewing libraries */}
          {tenantSlug && isAuthenticated && (profile?.display_name || (user as any)?.user_metadata?.display_name) && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground px-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{profile?.display_name || (user as any)?.user_metadata?.display_name}</span>
              {profile?.featured_achievement && (
                <FeaturedBadge achievement={profile.featured_achievement} size="xs" />
              )}
            </span>
          )}
          {/* Only show Demo link if demo mode is enabled, not in production, and not already in demo */}
          {demoModeEnabled && !isDemoMode && !isProductionDeployment() && (
            <Link to="/?demo=true" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2">
              Demo
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
