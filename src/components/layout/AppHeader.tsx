import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Menu,
  BookOpen,
  MessageSquare,
  LayoutDashboard,
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
      toast({ title: "Error signing out", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };


  return (
    <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm sticky top-0 z-30">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
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
            {/* Logo always uses TenantLink to stay within native router */}
            <TenantLink href={getPlatformUrl("/dashboard")} className="flex items-center gap-2">
              <img src={logoImage} alt="GameTaverns" className="h-7 sm:h-8 w-auto" />
              <span className="font-display text-base sm:text-lg font-bold text-cream">
                GameTaverns
              </span>
            </TenantLink>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Desktop nav links — hidden on small screens */}
            {isAuthenticated && (
              <>
                <div className="h-4 w-px bg-wood-medium/40 hidden md:block" />
              </>
            )}

            <LanguageSwitcher />
            <ThemeToggle />

            {/* Icons visible on all sizes on desktop; hidden on mobile (handled by drawer) */}
            {isAuthenticated && (
              <>
                {/* Dashboard link — always visible for authenticated users */}
                <TenantLink
                  href={getPlatformUrl("/dashboard")}
                  className="hidden md:inline-flex relative text-cream hover:text-white transition-colors"
                >
                  <Button variant="ghost" size="icon" className="relative text-cream hover:text-white hover:bg-wood-medium/50 h-8 w-8">
                    <LayoutDashboard className="h-5 w-5" />
                  </Button>
                </TenantLink>

                {/* Direct Messages icon — desktop only; drawer handles mobile */}
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
                  className="text-sm font-medium text-cream/70 hover:text-cream transition-colors px-2"
                >
                  {t('nav.signIn')}
                </TenantLink>
              </>
            )}

            {/* Mobile hamburger removed — bottom tab bar handles navigation */}
          </div>
        </div>
      </div>
    </header>
  );
}
