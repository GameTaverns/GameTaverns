import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Menu, X, Library, Globe, HelpCircle, BookOpen, MessageSquare,
  Mail, LogOut, User, Trophy, Users, LayoutDashboard, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TenantLink } from "@/components/TenantLink";
import { getPlatformUrl, getLibraryUrl } from "@/hooks/useTenantUrl";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries, useUserProfile } from "@/hooks/useLibrary";
import { useUnreadDMCount } from "@/hooks/useDirectMessages";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MobileNavDrawerProps {
  trigger?: React.ReactNode;
}

export function MobileNavDrawer({ trigger }: MobileNavDrawerProps = {}) {
  const [open, setOpen] = useState(false);
  const { signOut, isAuthenticated } = useAuth();
  const { data: library } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const { data: profile } = useUserProfile();
  const { data: dmUnreadCount = 0 } = useUnreadDMCount();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const close = () => setOpen(false);

  const handleSignOut = async () => {
    close();
    const { error } = await signOut();
    if (error) {
      toast({ title: "Error signing out", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const NavItem = ({
    href,
    icon: Icon,
    label,
    badge,
  }: {
    href: string;
    icon: React.ElementType;
    label: string;
    badge?: number;
  }) => {
    const isActive =
      location.pathname === href || location.pathname.startsWith(href + "/");
    return (
      <TenantLink
        href={href}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-foreground/80 hover:bg-muted hover:text-foreground"
        )}
        onClick={close}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <Badge variant="destructive" className="h-5 min-w-5 px-1 flex items-center justify-center text-xs">
            {badge > 9 ? "9+" : badge}
          </Badge>
        )}
      </TenantLink>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="text-cream hover:text-white hover:bg-wood-medium/50 h-8 w-8"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="w-72 p-0 flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <span className="font-display text-base font-bold">Menu</span>
          <Button variant="ghost" size="icon" onClick={close} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {isAuthenticated ? (
            <>
              <NavItem href={getPlatformUrl("/dashboard")} icon={LayoutDashboard} label="Dashboard" />
              <NavItem href={getPlatformUrl("/catalog")} icon={BookOpen} label="Catalog" />

              {/* Library links */}
              {myLibraries.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    My Libraries
                  </div>
                  {myLibraries.map((lib) => (
                    <TenantLink
                      key={lib.id}
                      href={getLibraryUrl(lib.slug, "/")}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                        "text-foreground/80 hover:bg-muted hover:text-foreground"
                      )}
                      onClick={close}
                    >
                      <Library className="h-5 w-5 shrink-0" />
                      <span className="flex-1 truncate">{lib.name}</span>
                    </TenantLink>
                  ))}
                </>
              )}

              <div className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Discover
              </div>
              <NavItem href={getPlatformUrl("/directory")} icon={Globe} label="Directory" />
              <NavItem href={getPlatformUrl("/achievements")} icon={Trophy} label="Achievements" />
              <NavItem href={getPlatformUrl("/lists")} icon={List} label="Curated Lists" />

              <div className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Messages
              </div>
              <NavItem
                href={getPlatformUrl("/dm")}
                icon={MessageSquare}
                label="Direct Messages"
                badge={dmUnreadCount}
              />

              <div className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Account
              </div>
              {profile?.username && (
                <NavItem
                  href={getPlatformUrl(`/u/${profile.username}`)}
                  icon={User}
                  label={profile.display_name || profile.username}
                />
              )}
              <NavItem href={getPlatformUrl("/docs")} icon={HelpCircle} label="Help" />
            </>
          ) : (
            <>
              <NavItem href={getPlatformUrl("/catalog")} icon={BookOpen} label="Catalog" />
              <NavItem href={getPlatformUrl("/directory")} icon={Globe} label="Directory" />
              <NavItem href={getPlatformUrl("/docs")} icon={HelpCircle} label="Help" />
            </>
          )}
        </nav>

        {/* Footer */}
        {isAuthenticated && (
          <div className="border-t px-2 py-3">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
