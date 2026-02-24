import { useLocation } from "react-router-dom";
import { LayoutDashboard, Library, BookOpen, MessageSquare, Menu } from "lucide-react";
import { TenantLink } from "@/components/TenantLink";
import { getPlatformUrl, getLibraryUrl } from "@/hooks/useTenantUrl";
import { Badge } from "@/components/ui/badge";
import { useMyLibrary } from "@/hooks/useLibrary";
import { useUnreadDMCount } from "@/hooks/useDirectMessages";
import { useAuth } from "@/hooks/useAuth";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { cn } from "@/lib/utils";

interface TabItem {
  href: string;
  icon: React.ElementType;
  label: string;
  match: (path: string) => boolean;
  badge?: number;
}

export function MobileBottomTabs() {
  const { isAuthenticated } = useAuth();
  const { data: library } = useMyLibrary();
  const { data: dmUnreadCount = 0 } = useUnreadDMCount();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const libraryHref = library ? getLibraryUrl(library.slug, "/") : getPlatformUrl("/dashboard?tab=library");

  const tabs: TabItem[] = [
    {
      href: getPlatformUrl("/dashboard"),
      icon: LayoutDashboard,
      label: "Dashboard",
      match: (p) => p === "/dashboard" || p.startsWith("/dashboard"),
    },
    {
      href: libraryHref,
      icon: Library,
      label: "Library",
      match: (p) => p.startsWith("/library/") || p.startsWith("/l/"),
    },
    {
      href: getPlatformUrl("/catalog"),
      icon: BookOpen,
      label: "Catalog",
      match: (p) => p.startsWith("/catalog"),
    },
    {
      href: getPlatformUrl("/dm"),
      icon: MessageSquare,
      label: "Messages",
      match: (p) => p.startsWith("/dm"),
      badge: dmUnreadCount,
    },
  ];

  const currentPath = location.pathname;

  return (
    <nav className="mobile-bottom-tabs md:hidden" aria-label="Main navigation">
      {tabs.map((tab) => {
        const isActive = tab.match(currentPath);
        const Icon = tab.icon;
        return (
          <TenantLink
            key={tab.label}
            href={tab.href}
            className={cn(
              "mobile-bottom-tab",
              isActive && "mobile-bottom-tab--active"
            )}
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {tab.badge != null && tab.badge > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1.5 -right-2.5 h-4 min-w-4 px-0.5 flex items-center justify-center text-[10px]"
                >
                  {tab.badge > 9 ? "9+" : tab.badge}
                </Badge>
              )}
            </span>
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </TenantLink>
        );
      })}

      {/* More tab opens the drawer */}
      <MobileNavDrawer
        trigger={
          <button
            className="mobile-bottom-tab"
            aria-label="More options"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">More</span>
          </button>
        }
      />
    </nav>
  );
}
