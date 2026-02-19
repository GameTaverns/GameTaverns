import { useNavigate, useLocation } from "react-router-dom";
import {
  LogOut,
  Library,
  Globe,
  HelpCircle,
  ChevronDown,
  Mail,
  Menu,
  BookOpen,
  User,
  MessageSquare,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries, useUserProfile } from "@/hooks/useLibrary";
import { useUnreadMessageCount } from "@/hooks/useMessages";
import { useUnreadDMCount } from "@/hooks/useDirectMessages";
import { useToast } from "@/hooks/use-toast";
import { NotificationsDropdown } from "@/components/notifications/NotificationsDropdown";
import { getLibraryUrl, getPlatformUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { useTenant } from "@/contexts/TenantContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  onMenuClick?: () => void;
  showMenuToggle?: boolean;
}

export function AppHeader({ onMenuClick, showMenuToggle = false }: AppHeaderProps) {
  const { signOut, isAuthenticated } = useAuth();
  const { tenantSlug } = useTenant();
  const { data: defaultLibrary } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const { data: dmUnreadCount = 0 } = useUnreadDMCount();
  const { data: profile } = useUserProfile();
  const library = defaultLibrary ?? null;
  const { data: unreadCount = 0 } = useUnreadMessageCount(library?.id);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isCatalogPage = location.pathname.startsWith("/catalog");
  const isProfilePage = location.pathname.startsWith("/u/");
  const isListsPage = location.pathname.startsWith("/lists");

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: "Error signing out", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const libraryUrl = library ? getLibraryUrl(library.slug, "/") : null;
  const isSubdomain = !!tenantSlug;

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

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
            {isAuthenticated && (
              <>
                {/* Help */}
                <TenantLink
                  href={getPlatformUrl("/docs")}
                  className="hidden sm:flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream transition-colors text-xs"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Help</span>
                </TenantLink>

                {/* Directory */}
                <TenantLink
                  href={getPlatformUrl("/directory")}
                  className="hidden sm:flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream transition-colors text-xs"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Directory</span>
                </TenantLink>

                {/* Catalog / Dashboard toggle */}
                {isCatalogPage ? (
                  <TenantLink
                    href={getPlatformUrl("/dashboard")}
                    className="hidden sm:flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream transition-colors text-xs"
                  >
                    <span>Dashboard</span>
                  </TenantLink>
                ) : (
                  <TenantLink
                    href={getPlatformUrl("/catalog")}
                    className="hidden sm:flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream transition-colors text-xs"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Catalog</span>
                  </TenantLink>
                )}

                {/* My Library / Dashboard on subdomain */}
                {isSubdomain ? (
                  <TenantLink
                    href={getPlatformUrl("/dashboard")}
                    className="hidden sm:flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream transition-colors text-xs"
                  >
                    <Library className="h-3.5 w-3.5" />
                    <span>Dashboard</span>
                  </TenantLink>
                ) : myLibraries.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="hidden sm:flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream hover:bg-transparent h-auto text-xs"
                      >
                        <Library className="h-3.5 w-3.5" />
                        <span>My Library</span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {myLibraries.map((lib) => (
                        <DropdownMenuItem key={lib.id} asChild>
                          <TenantLink href={getLibraryUrl(lib.slug, "/")} className="cursor-pointer">
                            <Library className="h-3.5 w-3.5 mr-2" />
                            {lib.name}
                          </TenantLink>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : library ? (
                  <TenantLink
                    href={libraryUrl!}
                    className="hidden sm:flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream transition-colors text-xs"
                  >
                    <Library className="h-3.5 w-3.5" />
                    <span>My Library</span>
                  </TenantLink>
                ) : null}

                <div className="h-4 w-px bg-wood-medium/40 hidden sm:block" />
              </>
            )}

            <ThemeToggle />

            {/* Direct Messages icon */}
            {isAuthenticated && (
              <TenantLink href={getPlatformUrl("/dm")} className="relative text-cream hover:text-white transition-colors">
                <Button variant="ghost" size="icon" className="relative text-cream hover:text-white hover:bg-wood-medium/50 h-8 w-8">
                  <MessageSquare className="h-5 w-5" />
                  {dmUnreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {dmUnreadCount > 9 ? "9+" : dmUnreadCount}
                    </Badge>
                  )}
                </Button>
              </TenantLink>
            )}

            {/* Library Messages dropdown */}
            {isAuthenticated && library && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative text-cream hover:text-white hover:bg-wood-medium/50 h-8 w-8"
                  >
                    <Mail className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-3 py-2 text-sm font-medium">Messages</div>
                  {unreadCount > 0 ? (
                    <DropdownMenuItem asChild>
                      <TenantLink href="/inbox" className="cursor-pointer gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{unreadCount} unread message{unreadCount > 1 ? 's' : ''}</p>
                          <p className="text-xs text-muted-foreground">View in {library.name}</p>
                        </div>
                      </TenantLink>
                    </DropdownMenuItem>
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No unread messages
                    </div>
                  )}
                  <DropdownMenuItem asChild>
                    <TenantLink href="/inbox" className="cursor-pointer text-xs justify-center text-muted-foreground">
                      View all messages
                    </TenantLink>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {isAuthenticated && (
              <NotificationsDropdown variant="dashboard" />
            )}

            {/* Catalog link for non-authenticated users */}
            {!isAuthenticated && (
              <TenantLink
                href={getPlatformUrl("/catalog")}
                className="flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream transition-colors text-xs"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Catalog</span>
              </TenantLink>
            )}

            {/* Sign in / Sign out */}
            {isAuthenticated ? (
              <>
                {isProfilePage || isListsPage ? (
                  <TenantLink
                    href={getPlatformUrl("/dashboard")}
                    className="hidden sm:flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream transition-colors text-xs"
                  >
                    <span>Dashboard</span>
                  </TenantLink>
                ) : profile?.username ? (
                  <TenantLink
                    href={getPlatformUrl(`/u/${profile.username}`)}
                    className="hidden sm:flex items-center gap-1 px-2 py-1 text-cream/70 hover:text-cream transition-colors text-xs"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>{profile.display_name || profile.username}</span>
                  </TenantLink>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="text-cream hover:text-white hover:bg-wood-medium/50 h-8 w-8"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <TenantLink
                href={getPlatformUrl("/login")}
                className="text-sm font-medium text-cream/70 hover:text-cream transition-colors px-2"
              >
                Sign In
              </TenantLink>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
