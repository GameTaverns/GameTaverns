import { useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  User, Trophy, Users, List, Scale, Globe, MapPin,
  Settings, HelpCircle, LogOut, MessageSquare, Newspaper,
  Search, ArrowLeftRight, ClipboardList, UserPlus, Ticket,
  ScanBarcode, BookOpen, Info,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { TenantLink } from "@/components/TenantLink";
import { getPlatformUrl } from "@/hooks/useTenantUrl";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useLibrary";
import { useMyClubs } from "@/hooks/useClubs";
import { useUnreadDMCount } from "@/hooks/useDirectMessages";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FeedbackNavItem } from "@/components/feedback/FeedbackNavItem";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface MobileV2MenuDrawerProps {
  trigger?: React.ReactNode;
}

export function MobileV2MenuDrawer({ trigger }: MobileV2MenuDrawerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { signOut, isAuthenticated } = useAuth();
  const { data: profile } = useUserProfile();
  const { data: myClubs } = useMyClubs();
  const { data: dmUnreadCount = 0 } = useUnreadDMCount();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const close = useCallback(() => setOpen(false), []);

  const handleSignOut = async () => {
    close();
    const { error } = await signOut();
    if (error) {
      toast({ title: t('mobileNav.errorSigningOut'), description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const NavItem = ({ href, icon: Icon, label, badge }: {
    href: string; icon: React.ElementType; label: string; badge?: number;
  }) => {
    const isActive = location.pathname === href || location.pathname.startsWith(href + "/");
    return (
      <TenantLink
        href={href}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isActive ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted"
        )}
        onClick={close}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px]">
            {badge > 9 ? "9+" : badge}
          </Badge>
        )}
      </TenantLink>
    );
  };

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="px-4 pt-4 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
      {label}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-64 p-0 flex h-[100dvh] flex-col bg-background">
        {/* Profile header */}
        {isAuthenticated && profile && (
          <div className="px-4 py-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{profile.display_name || profile.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto pb-24 space-y-0.5">
          {isAuthenticated ? (
            <>
              {/* Profile & Settings */}
              <SectionHeader label={t('nav.settings', 'Profile & Settings')} />
              {profile?.username && (
                <NavItem href={getPlatformUrl(`/u/${profile.username}`)} icon={User} label={t('nav.myProfile', 'My Profile')} />
              )}
              <NavItem href={getPlatformUrl("/dashboard/settings")} icon={Settings} label={t('nav.accountSettings', 'Settings')} />
              <NavItem href={getPlatformUrl("/notifications")} icon={MessageSquare} label={t('nav.notifications', 'Notifications')} />

              {/* Tools */}
              <SectionHeader label={t('nav.tools', 'Tools')} />
              <NavItem href={getPlatformUrl("/dashboard/collection")} icon={BookOpen} label={t('nav.manageMyLibrary', 'Manage Library')} />
              <NavItem href={getPlatformUrl("/catalog")} icon={Search} label={t('nav.catalog', 'Game Catalog')} />
              <NavItem href={getPlatformUrl("/dashboard/lending")} icon={ArrowLeftRight} label={t('nav.lending', 'My Loans')} />
              <NavItem href={getPlatformUrl("/dashboard/insights")} icon={ClipboardList} label={t('nav.insights', 'Insights')} />
              <NavItem href={getPlatformUrl("/achievements")} icon={Trophy} label={t('nav.achievements', 'Achievements')} />
              <NavItem href={getPlatformUrl("/lists")} icon={List} label={t('nav.curatedLists', 'Lists')} />

              {/* Community */}
              <SectionHeader label={t('nav.community', 'Community')} />
              <NavItem href={getPlatformUrl("/dm")} icon={MessageSquare} label={t('mobileNav.messages', 'Messages')} badge={dmUnreadCount} />
              <NavItem href={getPlatformUrl("/directory")} icon={Globe} label={t('nav.libraryDirectory', 'Libraries')} />
              <NavItem href={getPlatformUrl("/clubs")} icon={UserPlus} label={t('nav.clubDirectory', 'Clubs')} />
              {myClubs && myClubs.length > 0 && (
                <NavItem href={getPlatformUrl(`/club/${myClubs[0].slug}`)} icon={Users} label={t('nav.myClub', 'My Club')} />
              )}
              <NavItem href={getPlatformUrl("/near-me")} icon={MapPin} label={t('nav.nearMe', 'Near Me')} />
              <NavItem href={getPlatformUrl("/convention")} icon={Ticket} label={t('nav.conventions', 'Conventions')} />
              <NavItem href={getPlatformUrl("/news")} icon={Newspaper} label={t('nav.news', 'News')} />

              {/* About & Support */}
              <SectionHeader label={t('mobileNav.support', 'About')} />
              <FeedbackNavItem onClose={close} />
              <NavItem href={getPlatformUrl("/docs")} icon={HelpCircle} label={t('nav.helpDocs', 'Help & Docs')} />
              <NavItem href={getPlatformUrl("/legal")} icon={Scale} label={t('nav.legal', 'Legal')} />

              <div className="px-4 pt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('nav.theme', 'Theme')}</span>
                <ThemeToggle />
              </div>

              <div className="px-4 pt-2">
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t('mobileNav.signOut', 'Sign Out')}</span>
                </button>
              </div>

              <div className="px-4 py-3 text-center">
                <span className="text-[10px] text-muted-foreground/50">GameTaverns v2.0</span>
              </div>
            </>
          ) : (
            <>
              <NavItem href={getPlatformUrl("/catalog")} icon={BookOpen} label={t('mobileNav.catalog', 'Catalog')} />
              <NavItem href={getPlatformUrl("/directory")} icon={Globe} label={t('mobileNav.directory', 'Directory')} />
              <NavItem href={getPlatformUrl("/docs")} icon={HelpCircle} label={t('nav.helpDocs', 'Help & Docs')} />
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
