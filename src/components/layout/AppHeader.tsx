import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Menu,
  BookOpen,
  MessageSquare,
  Home,
} from "lucide-react";

import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadDMCount } from "@/hooks/useDirectMessages";
import { useToast } from "@/hooks/use-toast";
import { NotificationsDropdown } from "@/components/notifications/NotificationsDropdown";
import { getPlatformUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { MobileNavDrawer } from "@/components/mobile/MobileNavDrawer";
import { HeaderDropdownNav } from "@/components/layout/HeaderDropdownNav";

interface AppHeaderProps {
  onMenuClick?: () => void;
  showMenuToggle?: boolean;
}

export function AppHeader({ onMenuClick, showMenuToggle = false }: AppHeaderProps) {
  const { t } = useTranslation();
  const { signOut, isAuthenticated } = useAuth();
  const { data: dmUnreadCount = 0 } = useUnreadDMCount();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: t('mobileNav.errorSigningOut'), description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };


  return (
    <header className="border-b border-wood-medium/50 bg-wood-dark/95 sticky top-0 z-30">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo + Dropdown Nav */}
          <div className="flex items-center gap-2">
            {showMenuToggle && onMenuClick && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-cream hover:text-white hover:bg-wood-medium/50 h-8 w-8"
                onClick={onMenuClick}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            {/* Logo */}
            <TenantLink href={getPlatformUrl("/dashboard")} className="flex items-center gap-2">
              <img src={logoImage} alt="GameTaverns" className="h-7 sm:h-8 w-auto" />
              <span className="font-display text-base sm:text-lg font-bold text-cream">
                GameTaverns
              </span>
            </TenantLink>

            {/* Dropdown menus — desktop only */}
            <div className="hidden md:flex items-center ml-2">
              <div className="h-4 w-px bg-wood-medium/40 mr-1" />
              <HeaderDropdownNav />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            <ThemeToggle />

            {isAuthenticated && (
              <>
                {/* Direct Messages */}
                <TenantLink
                  href={getPlatformUrl("/dm")}
                  className="hidden md:inline-flex relative text-cream hover:text-white transition-colors"
                >
                  <Button variant="ghost" size="icon" className="relative text-cream hover:text-white hover:bg-wood-medium/50 h-8 w-8">
                    <MessageSquare className="h-5 w-5" />
                    {dmUnreadCount > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {dmUnreadCount > 9 ? "9+" : dmUnreadCount}
                      </Badge>
                    )}
                  </Button>
                </TenantLink>

                <NotificationsDropdown variant="dashboard" />

                {/* Dashboard / Home */}
                <TenantLink href={getPlatformUrl("/dashboard")}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-cream hover:text-white hover:bg-wood-medium/50 h-8 w-8"
                    aria-label="Dashboard"
                  >
                    <Home className="h-5 w-5" />
                  </Button>
                </TenantLink>

                {/* Sign out — desktop only */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="hidden md:inline-flex text-cream hover:text-white hover:bg-wood-medium/50 h-8 w-8"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}

            {/* Catalog link for non-authenticated users */}
            {!isAuthenticated && (
              <>
                <TenantLink
                  href={getPlatformUrl("/catalog")}
                  className="hidden md:flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream transition-colors text-xs"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{t('nav.catalog')}</span>
                </TenantLink>
                <TenantLink
                  href={getPlatformUrl("/login")}
                  className="text-sm font-medium text-cream hover:text-white transition-colors px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90"
                >
                  {t('nav.signIn')}
                </TenantLink>
              </>
            )}

            {/* Hamburger drawer — always available */}
            <MobileNavDrawer />
          </div>
        </div>
      </div>
    </header>
  );
}
