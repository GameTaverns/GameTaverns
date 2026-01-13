import { Link, useLocation, useSearchParams } from "react-router-dom";
import { 
  Library, 
  Gamepad2, 
  Puzzle, 
  Clock, 
  Building2, 
  Star,
  LogIn,
  LogOut,
  User,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DIFFICULTY_OPTIONS, GAME_TYPE_OPTIONS, PLAY_TIME_OPTIONS } from "@/types/game";
import { useMechanics, usePublishers } from "@/hooks/useGames";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data: mechanics = [] } = useMechanics();
  const { data: publishers = [] } = usePublishers();
  const { isAuthenticated, user, signOut, isAdmin } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    }
  };

  const currentFilter = searchParams.get("filter");
  const currentValue = searchParams.get("value");

  const createFilterUrl = (filter: string, value: string) => {
    return `/?filter=${encodeURIComponent(filter)}&value=${encodeURIComponent(value)}`;
  };

  const isActive = (filter: string, value: string) => {
    return currentFilter === filter && currentValue === value;
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen w-72 wood-grain border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-20 items-center justify-center border-b border-sidebar-border px-6">
          <Link to="/" className="flex items-center gap-3">
            <Gamepad2 className="h-8 w-8 text-sidebar-primary" />
            <span className="font-display text-xl font-semibold text-sidebar-foreground">
              Game Library
            </span>
          </Link>
        </div>

        <ScrollArea className="flex-1 px-4 py-6">
          {/* Main Navigation */}
          <nav className="space-y-2">
            <Link
              to="/"
              className={cn(
                "sidebar-link",
                location.pathname === "/" && !currentFilter && "sidebar-link-active"
              )}
            >
              <Library className="h-5 w-5" />
              <span>Full Collection</span>
            </Link>
          </nav>

          {/* Difficulty */}
          <div className="mt-8">
            <h3 className="mb-3 flex items-center gap-2 px-4 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              <Star className="h-4 w-4" />
              Difficulty
            </h3>
            <nav className="space-y-1">
              {DIFFICULTY_OPTIONS.map((diff) => (
                <Link
                  key={diff}
                  to={createFilterUrl("difficulty", diff)}
                  className={cn(
                    "sidebar-link text-sm",
                    isActive("difficulty", diff) && "sidebar-link-active"
                  )}
                >
                  {diff}
                </Link>
              ))}
            </nav>
          </div>

          {/* Game Type */}
          <div className="mt-8">
            <h3 className="mb-3 flex items-center gap-2 px-4 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              <Gamepad2 className="h-4 w-4" />
              Type
            </h3>
            <nav className="space-y-1">
              {GAME_TYPE_OPTIONS.map((type) => (
                <Link
                  key={type}
                  to={createFilterUrl("type", type)}
                  className={cn(
                    "sidebar-link text-sm",
                    isActive("type", type) && "sidebar-link-active"
                  )}
                >
                  {type}
                </Link>
              ))}
            </nav>
          </div>

          {/* Play Time */}
          <div className="mt-8">
            <h3 className="mb-3 flex items-center gap-2 px-4 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              <Clock className="h-4 w-4" />
              Play Time
            </h3>
            <nav className="space-y-1">
              {PLAY_TIME_OPTIONS.map((time) => (
                <Link
                  key={time}
                  to={createFilterUrl("playtime", time)}
                  className={cn(
                    "sidebar-link text-sm",
                    isActive("playtime", time) && "sidebar-link-active"
                  )}
                >
                  {time}
                </Link>
              ))}
            </nav>
          </div>

          {/* Mechanics */}
          <div className="mt-8">
            <h3 className="mb-3 flex items-center gap-2 px-4 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              <Puzzle className="h-4 w-4" />
              Mechanics
            </h3>
            <nav className="space-y-1">
              {mechanics.slice(0, 10).map((mech) => (
                <Link
                  key={mech.id}
                  to={createFilterUrl("mechanic", mech.name)}
                  className={cn(
                    "sidebar-link text-sm",
                    isActive("mechanic", mech.name) && "sidebar-link-active"
                  )}
                >
                  {mech.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Publishers */}
          <div className="mt-8">
            <h3 className="mb-3 flex items-center gap-2 px-4 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              <Building2 className="h-4 w-4" />
              Publishers
            </h3>
            <nav className="space-y-1">
              {publishers.slice(0, 8).map((pub) => (
                <Link
                  key={pub.id}
                  to={createFilterUrl("publisher", pub.name)}
                  className={cn(
                    "sidebar-link text-sm",
                    isActive("publisher", pub.name) && "sidebar-link-active"
                  )}
                >
                  {pub.name}
                </Link>
              ))}
            </nav>
          </div>
        </ScrollArea>

        {/* User Section */}
        <div className="border-t border-sidebar-border p-4 space-y-2">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2 text-sm text-sidebar-foreground/80">
                <User className="h-4 w-4" />
                <span className="truncate">{user?.email}</span>
              </div>
              <Link
                to="/settings"
                className={cn(
                  "sidebar-link justify-center",
                  location.pathname === "/settings" && "sidebar-link-active"
                )}
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </Button>
            </>
          ) : (
            <Link
              to="/login"
              className="sidebar-link justify-center bg-sidebar-accent"
            >
              <LogIn className="h-5 w-5" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
