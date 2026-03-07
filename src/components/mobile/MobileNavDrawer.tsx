import { useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Menu, Library, Globe, HelpCircle, BookOpen, MessageSquare,
  Mail, LogOut, User, Trophy, Users, LayoutDashboard, List, MessageSquarePlus,
  Scale, Calendar, MapPin,
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
import { FeedbackNavItem } from "@/components/feedback/FeedbackNavItem";

interface MobileNavDrawerProps {
  trigger?: React.ReactNode;
}

export function MobileNavDrawer({ trigger }: MobileNavDrawerProps = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { signOut, isAuthenticated } = useAuth();
  const { data: library } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const { data: profile } = useUserProfile();
  const { data: dmUnreadCount = 0 } = useUnreadDMCount();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const close = useCallback(() => setOpen(false), []);

  const navAndClose = useCallback((href: string) => {
    setOpen(false);
    setTimeout(() => {
      navigate(href, { replace: true, state: { ts: Date.now() } });
    }, 100);
  }, [navigate]);

  const handleSignOut = async () => {
    close();
    const { error } = await signOut();
    if (error) {
      toast({ title: t('mobileNav.errorSigningOut'), description: error.message, variant: "destructive" });
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
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-foreground/80 hover:bg-muted hover:text-foreground"
        )}
        onClick={close}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <Badge variant="destructive" className="h-4 min-w-4 px-0.5 flex items-center justify-center text-[10px]">
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
            aria-label={t('mobileNav.menu')}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="w-48 min-[400px]:w-56 p-0 flex h-[100dvh] flex-col bg-background">
        <div className="px-3 py-3 border-b">
          <span className="font-display text-sm font-bold">{t('mobileNav.menu')}</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-1.5 py-2 pb-24 space-y-0.5">
          {isAuthenticated ? (
            <>
              <NavItem href={getPlatformUrl("/dashboard")} icon={LayoutDashboard} label={t('mobileNav.dashboard')} />
              <NavItem href={getPlatformUrl("/catalog")} icon={BookOpen} label={t('mobileNav.catalog')} />

              {myLibraries.length > 0 && (
                <>
                   <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('mobileNav.myLibraries')}
                  </div>
                   {myLibraries.map((lib) => (
                    <button
                      key={lib.id}
                      onClick={() => navAndClose(getLibraryUrl(lib.slug, "/"))}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                        "text-foreground/80 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Library className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate text-left">{lib.name}</span>
                    </button>
                  ))}
                </>
              )}

              <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('mobileNav.discover')}
              </div>
              <NavItem href={getPlatformUrl("/directory")} icon={Globe} label={t('mobileNav.directory')} />
              <NavItem href={getPlatformUrl("/near-me")} icon={MapPin} label={t('mobileNav.nearMe')} />
              <NavItem href={getPlatformUrl("/events")} icon={Calendar} label={t('mobileNav.events')} />
              <NavItem href={getPlatformUrl("/achievements")} icon={Trophy} label={t('mobileNav.achievements')} />
              <NavItem href={getPlatformUrl("/lists")} icon={List} label={t('mobileNav.curatedLists')} />

              <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('mobileNav.messages')}
              </div>
              <NavItem
                href={getPlatformUrl("/dm")}
                icon={MessageSquare}
                label={t('mobileNav.directMessages')}
                badge={dmUnreadCount}
              />

              <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('mobileNav.account')}
              </div>
              {profile?.username && (
                <NavItem
                  href={getPlatformUrl(`/u/${profile.username}`)}
                  icon={User}
                  label={profile.display_name || profile.username}
                />
              )}

              <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('mobileNav.support')}
              </div>
              <FeedbackNavItem onClose={close} />
              <NavItem href={getPlatformUrl("/docs")} icon={HelpCircle} label={t('mobileNav.help')} />
              <NavItem href={getPlatformUrl("/legal")} icon={Scale} label={t('mobileNav.legal')} />
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>{t('mobileNav.signOut')}</span>
              </button>
            </>
          ) : (
            <>
              <NavItem href={getPlatformUrl("/catalog")} icon={BookOpen} label={t('mobileNav.catalog')} />
              <NavItem href={getPlatformUrl("/directory")} icon={Globe} label={t('mobileNav.directory')} />
              <NavItem href={getPlatformUrl("/docs")} icon={HelpCircle} label={t('mobileNav.help')} />
              <NavItem href={getPlatformUrl("/legal")} icon={Scale} label={t('mobileNav.legal')} />
            </>
          )}
        </nav>

      </SheetContent>
    </Sheet>
  );
}
