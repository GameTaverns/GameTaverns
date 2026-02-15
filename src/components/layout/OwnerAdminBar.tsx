import { Settings, LayoutGrid, BarChart3 } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/contexts/DemoContext";

function getPlatformUrl(path: string): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  if (hostname.endsWith(".gametaverns.com")) {
    return `${protocol}//gametaverns.com${path}`;
  }
  return path;
}

export function OwnerAdminBar() {
  const { tenantSlug, isOwner, isTenantMode } = useTenant();
  const { isAuthenticated } = useAuth();
  const { isDemoMode } = useDemoMode();

  if (!isTenantMode || !isAuthenticated || !isOwner || isDemoMode) {
    return null;
  }

  const links = [
    { href: getPlatformUrl("/dashboard?tab=overview"), icon: LayoutGrid, label: "Manage Collection" },
    { href: getPlatformUrl("/dashboard/settings"), icon: Settings, label: "Settings" },
    { href: getPlatformUrl("/dashboard?tab=more"), icon: BarChart3, label: "Analytics" },
  ];

  return (
    <div className="bg-muted/80 border-b border-border text-xs">
      <div className="flex items-center justify-between px-4 py-1.5 lg:px-8">
        <span className="text-muted-foreground font-medium">Owner View</span>
        <nav className="flex items-center gap-3">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <link.icon className="h-3 w-3" />
              <span className="hidden sm:inline">{link.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
