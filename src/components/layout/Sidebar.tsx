import { Link, useLocation, useSearchParams, useNavigate } from "react-router-dom";
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
  Settings,
  ChevronDown,
  PackageOpen,
  ShoppingCart,
  ALargeSmall,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DIFFICULTY_OPTIONS, GAME_TYPE_OPTIONS, PLAY_TIME_OPTIONS } from "@/types/game";
import { useMechanics, usePublishers } from "@/hooks/useGames";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { siteConfig } from "@/config/site";
import { useSiteSettings } from "@/hooks/useSiteSettings";

interface SidebarProps {
  isOpen: boolean;
}

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, icon, children, defaultOpen = false }: FilterSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="mt-6">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <nav className="space-y-1">
          {children}
        </nav>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Sidebar({ isOpen }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: mechanics = [] } = useMechanics();
  const { data: publishers = [] } = usePublishers();
  const { isAuthenticated, user, signOut, isAdmin } = useAuth();
  const { data: settings } = useSiteSettings();
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

  // Use setSearchParams for filter updates to avoid page flash
  const handleFilterClick = (filter: string, value: string) => {
    // If we're not on the home page, navigate there first
    if (location.pathname !== "/") {
      navigate(`/?filter=${encodeURIComponent(filter)}&value=${encodeURIComponent(value)}`);
    } else {
      setSearchParams({ filter, value });
    }
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
              {settings?.site_name || siteConfig.name}
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
            <Link
              to="/?filter=status&value=coming-soon"
              className={cn(
                "sidebar-link",
                isActive("status", "coming-soon") && "sidebar-link-active"
              )}
            >
              <PackageOpen className="h-5 w-5" />
              <span>Coming Soon</span>
            </Link>
            <Link
              to="/?filter=status&value=for-sale"
              className={cn(
                "sidebar-link",
                isActive("status", "for-sale") && "sidebar-link-active"
              )}
            >
              <ShoppingCart className="h-5 w-5" />
              <span>For Sale</span>
            </Link>
          </nav>

          {/* Player Count */}
          <FilterSection title="Player Count" icon={<Users className="h-4 w-4" />} defaultOpen={currentFilter === "players"}>
            {["1 Player", "2 Players", "3-4 Players", "5-6 Players", "7+ Players"].map((option) => (
              <button
                key={option}
                onClick={() => handleFilterClick("players", option)}
                className={cn(
                  "sidebar-link text-sm w-full text-left",
                  isActive("players", option) && "sidebar-link-active"
                )}
              >
                {option}
              </button>
            ))}
          </FilterSection>

          {/* Difficulty */}
          <FilterSection title="Difficulty" icon={<Star className="h-4 w-4" />} defaultOpen={currentFilter === "difficulty"}>
            {DIFFICULTY_OPTIONS.map((diff) => (
              <button
                key={diff}
                onClick={() => handleFilterClick("difficulty", diff)}
                className={cn(
                  "sidebar-link text-sm w-full text-left",
                  isActive("difficulty", diff) && "sidebar-link-active"
                )}
              >
                {diff}
              </button>
            ))}
          </FilterSection>

          {/* Game Type */}
          <FilterSection title="Type" icon={<Gamepad2 className="h-4 w-4" />} defaultOpen={currentFilter === "type"}>
            {GAME_TYPE_OPTIONS.map((type) => (
              <button
                key={type}
                onClick={() => handleFilterClick("type", type)}
                className={cn(
                  "sidebar-link text-sm w-full text-left",
                  isActive("type", type) && "sidebar-link-active"
                )}
              >
                {type}
              </button>
            ))}
          </FilterSection>

          {/* Play Time */}
          <FilterSection title="Play Time" icon={<Clock className="h-4 w-4" />} defaultOpen={currentFilter === "playtime"}>
            {PLAY_TIME_OPTIONS.map((time) => (
              <button
                key={time}
                onClick={() => handleFilterClick("playtime", time)}
                className={cn(
                  "sidebar-link text-sm w-full text-left",
                  isActive("playtime", time) && "sidebar-link-active"
                )}
              >
                {time}
              </button>
            ))}
          </FilterSection>

          {/* Mechanics */}
          <FilterSection title="Mechanics" icon={<Puzzle className="h-4 w-4" />} defaultOpen={currentFilter === "mechanic"}>
            {mechanics.slice(0, 10).map((mech) => (
              <button
                key={mech.id}
                onClick={() => handleFilterClick("mechanic", mech.name)}
                className={cn(
                  "sidebar-link text-sm w-full text-left",
                  isActive("mechanic", mech.name) && "sidebar-link-active"
                )}
              >
                {mech.name}
              </button>
            ))}
          </FilterSection>

          {/* Publishers */}
          <FilterSection title="Publishers" icon={<Building2 className="h-4 w-4" />} defaultOpen={currentFilter === "publisher"}>
            {publishers.slice(0, 8).map((pub) => (
              <button
                key={pub.id}
                onClick={() => handleFilterClick("publisher", pub.name)}
                className={cn(
                  "sidebar-link text-sm w-full text-left",
                  isActive("publisher", pub.name) && "sidebar-link-active"
                )}
              >
                {pub.name}
              </button>
            ))}
          </FilterSection>

          {/* A-Z Filter */}
          <FilterSection title="A-Z" icon={<ALargeSmall className="h-4 w-4" />} defaultOpen={currentFilter === "letter"}>
            <div className="grid grid-cols-6 gap-1 px-2">
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => (
                <button
                  key={letter}
                  onClick={() => handleFilterClick("letter", letter)}
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded text-sm font-medium transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive("letter", letter) 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground/70"
                  )}
                >
                  {letter}
                </button>
              ))}
            </div>
          </FilterSection>
        </ScrollArea>

        {/* User Section - Only show when authenticated */}
        {isAuthenticated && (
          <div className="border-t border-sidebar-border p-4 space-y-2">
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
          </div>
        )}
      </div>
    </aside>
  );
}
