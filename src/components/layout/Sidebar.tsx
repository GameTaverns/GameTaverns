import { useMemo, useState } from "react";
import { Link, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { 
  Library, 
  Gamepad2,
  Puzzle, 
  Clock, 
  Building2, 
  Star,
  CircleOff,
  LogIn,
  LogOut,
  User,
  Settings,
  ChevronDown,
  PackageOpen,
  ShoppingCart,
  ALargeSmall,
  Users,
  Baby,
  Heart,
  TrendingUp,
  Calendar,
  MapPin,
  Wand2,
  Globe,
  BarChart3,
  Search,
  Gauge,
  X,
  Plus,
  PenTool,
  Palette,
  ListOrdered,
} from "lucide-react";
import { format, isToday } from "date-fns";
import logoImage from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { DIFFICULTY_OPTIONS, GAME_TYPE_OPTIONS, PLAY_TIME_OPTIONS, GENRE_OPTIONS } from "@/types/game";
import { useMechanics, usePublishers, useDesigners, useArtists } from "@/hooks/useGames";
import { useDemoMode } from "@/contexts/DemoContext";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { siteConfig } from "@/config/site";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useTenant, useTenantSettings } from "@/contexts/TenantContext";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import { useUpcomingEvents } from "@/hooks/useLibraryEvents";
import { Badge } from "@/components/ui/badge";
import { TenantLogoImage } from "@/components/tenant/TenantLogoImage";
import { OnboardingSidebarLink } from "@/components/dashboard/OnboardingSidebarLink";

interface SidebarProps {
  isOpen: boolean;
}

// Mechanic category groupings
const MECHANIC_CATEGORIES: Record<string, string[]> = {
  "Strategy": [
    "Worker Placement", "Area Control", "Engine Building", "Route Building",
    "Network Building", "Tile Placement", "Area Majority / Influence",
    "Modular Board", "Tech Trees / Tech Tracks", "Rondel",
    "Action Points", "Action Queue", "Action Retrieval",
    "Grid Movement", "Hexagon Grid", "Point to Point Movement",
    "Area Movement", "Map Reduction",
  ],
  "Card & Deck": [
    "Hand Management", "Deck Building", "Deck Construction", "Card Drafting",
    "Card Play Conflict Resolution", "Trick-taking", "Set Collection",
    "Multi-Use Cards", "Tableau Building", "Layering",
    "Ladder Climbing", "Matching", "Pattern Building", "Contracts", "Market",
  ],
  "Dice & Luck": [
    "Dice Rolling", "Die Icon Resolution", "Random Production",
    "Push Your Luck", "Betting and Bluffing", "Chit-Pull System",
    "Bag Building", "Pool Building", "Catch the Leader",
    "Re-rolling and Locking", "Stat Check Resolution",
  ],
  "Social": [
    "Negotiation", "Trading", "Voting", "Alliances", "Bribes",
    "Team-Based Game", "Cooperative Game", "Semi-Cooperative Game",
    "Traitor Game", "Hidden Roles", "Role Playing", "Storytelling",
    "Communication Limits", "Acting", "Player Elimination",
  ],
  "Economy": [
    "Resource Management", "Commodity Speculation", "Stock Holding",
    "Income", "Loans", "Auction / Bidding", "Ownership", "Investment",
  ],
  "Combat": [
    "Variable Player Powers", "Simultaneous Action Selection",
    "Take That", "Tug of War", "Siege", "Line of Sight",
    "Command Cards", "Campaign / Battle Card Driven",
    "Scenario / Mission / Campaign Game", "Wargame",
  ],
  "Puzzle": [
    "Pattern Recognition", "Connections", "Enclosure",
    "Drafting", "Open Drafting", "Closed Drafting",
    "Deduction", "Induction", "Memory", "Programmed Movement",
  ],
};

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, icon, children, defaultOpen = false }: FilterSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="mt-4">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5">
        <nav className="space-y-0.5">
          {children}
        </nav>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Compact chip-style filter for categories with few options
function ChipFilterSection({
  title,
  icon,
  options,
  filterKey,
  isActive,
  onFilterClick,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  options: string[];
  filterKey: string;
  isActive: (filter: string, value: string) => boolean;
  onFilterClick: (filter: string, value: string) => void;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5">
        <div className="flex flex-wrap gap-1 px-4 py-1">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => onFilterClick(filterKey, opt)}
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium transition-colors border",
                isActive(filterKey, opt)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary"
                  : "border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
// Grouped mechanics filter with search
function MechanicsFilter({
  mechanics,
  isActive,
  onFilterClick,
}: {
  mechanics: { id: string; name: string }[];
  isActive: (filter: string, value: string) => boolean;
  onFilterClick: (filter: string, value: string) => void;
}) {
  const [search, setSearch] = useState("");
  
  const mechanicNameSet = useMemo(() => new Set(mechanics.map(m => m.name)), [mechanics]);
  
  // Build grouped categories, only showing mechanics that exist in this library
  const groupedCategories = useMemo(() => {
    const result: Record<string, string[]> = {};
    const assigned = new Set<string>();

    for (const [category, mechs] of Object.entries(MECHANIC_CATEGORIES)) {
      const existing = mechs.filter(m => mechanicNameSet.has(m));
      if (existing.length > 0) {
        result[category] = existing;
        existing.forEach(m => assigned.add(m));
      }
    }

    // "Other" bucket for uncategorized mechanics
    const uncategorized = mechanics
      .filter(m => !assigned.has(m.name))
      .map(m => m.name)
      .sort();
    if (uncategorized.length > 0) {
      result["Other"] = uncategorized;
    }

    return result;
  }, [mechanics, mechanicNameSet]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return groupedCategories;
    const q = search.toLowerCase();
    const result: Record<string, string[]> = {};
    for (const [cat, mechs] of Object.entries(groupedCategories)) {
      const matches = mechs.filter(m => m.toLowerCase().includes(q));
      if (matches.length > 0) result[cat] = matches;
    }
    return result;
  }, [groupedCategories, search]);

  return (
    <div className="space-y-1">
      {/* Search within mechanics */}
      <div className="relative px-3 mb-1">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-3 w-3 text-sidebar-foreground/40" />
        <Input
          placeholder="Search mechanics..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 pl-7 pr-6 text-xs bg-sidebar-accent/30 border-sidebar-border"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-5 top-1/2 -translate-y-1/2"
          >
            <X className="h-3 w-3 text-sidebar-foreground/40 hover:text-sidebar-foreground" />
          </button>
        )}
      </div>
      
      <div className="max-h-56 overflow-y-auto px-2">
        {Object.entries(filtered).map(([category, mechs]) => (
          <Collapsible key={category} defaultOpen={mechs.some(m => isActive("mechanic", m))}>
            <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-semibold text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
              <span>{category}</span>
              <span className="flex items-center gap-1">
                <span className="text-sidebar-foreground/30">{mechs.length}</span>
                <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-0.5 px-1 pb-1">
                {mechs.map((mech) => (
                  <button
                    key={mech}
                    onClick={() => onFilterClick("mechanic", mech)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] transition-colors border",
                      isActive("mechanic", mech)
                        ? "bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary"
                        : "border-sidebar-border text-sidebar-foreground/60 hover:bg-sidebar-accent"
                    )}
                  >
                    {mech}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}


function SidebarUpcomingEvents({ libraryId }: { libraryId: string }) {
  const { data: events = [], isLoading } = useUpcomingEvents(libraryId, 3);
  
  if (isLoading || events.length === 0) return null;
  
  return (
    <div className="mt-6 px-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 mb-2">
        <Calendar className="h-4 w-4" />
        Upcoming Events
      </div>
      <div className="space-y-2">
        {events.map((event) => {
          const eventDate = new Date(event.event_date);
          const eventIsToday = isToday(eventDate);
          
          return (
            <div 
              key={event.id} 
              className="p-2 rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className={cn(
                  "flex flex-col items-center justify-center min-w-[36px] h-9 rounded text-center text-xs",
                  eventIsToday 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "bg-sidebar-accent/50 text-sidebar-foreground"
                )}>
                  <span className="font-medium uppercase leading-tight">
                    {format(eventDate, "MMM")}
                  </span>
                  <span className="font-bold leading-none">
                    {format(eventDate, "d")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-sidebar-foreground truncate">
                    {event.title}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-sidebar-foreground/60">
                    <Clock className="h-3 w-3" />
                    {format(eventDate, "h:mm a")}
                    {eventIsToday && (
                      <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">
                        Today
                      </Badge>
                    )}
                  </div>
                  {event.event_location && (
                    <div className="flex items-center gap-1 text-[10px] text-sidebar-foreground/60 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{event.event_location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({ isOpen }: SidebarProps) {
  const isAdvancedFilterActive = ["letter", "players", "difficulty", "playtime", "type", "genre", "mechanic", "publisher", "designer", "artist"].includes(
    new URLSearchParams(window.location.search).get("filter") || ""
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(isAdvancedFilterActive);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: dbMechanics = [] } = useMechanics();
  const { data: dbPublishers = [] } = usePublishers();
  const { data: dbDesigners = [] } = useDesigners();
  const { data: dbArtists = [] } = useArtists();
  const { isDemoMode, demoGames } = useDemoMode();
  const { isAuthenticated, user, signOut, isAdmin } = useAuth();
  const { data: settings } = useSiteSettings();
  const { forSale, comingSoon, wishlist, events } = useFeatureFlags();
  const { toast } = useToast();
  const { tenantSlug, library, isTenantMode, isOwner } = useTenant();
  const tenantSettings = useTenantSettings();
  const { buildUrl } = useTenantUrl();

  // Build the base library URL based on mode
  const libraryBaseUrl = isDemoMode ? "/?demo=true" : buildUrl("/");

  // Use demo data for mechanics/publishers when in demo mode
  // Dedupe by name since imported games may have different IDs for the same mechanic
  const mechanics = useMemo(() => {
    if (!isDemoMode) return dbMechanics;
    const mechMap = new Map<string, { id: string; name: string }>();
    demoGames.forEach(g => {
      g.mechanics.forEach(m => mechMap.set(m.name, m));
    });
    return Array.from(mechMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [isDemoMode, dbMechanics, demoGames]);

  const publishers = useMemo(() => {
    if (!isDemoMode) return dbPublishers;
    // Dedupe by name since imported games may have different IDs for the same publisher
    const pubMap = new Map<string, { id: string; name: string }>();
    demoGames.forEach(g => {
      if (g.publisher) pubMap.set(g.publisher.name, g.publisher);
    });
    return Array.from(pubMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [isDemoMode, dbPublishers, demoGames]);

  const designers = useMemo(() => {
    if (!isDemoMode) return dbDesigners;
    return [];
  }, [isDemoMode, dbDesigners]);

  const artists = useMemo(() => {
    if (!isDemoMode) return dbArtists;
    return [];
  }, [isDemoMode, dbArtists]);

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
  // On subdomain deployments, we don't need ?tenant param (already on correct subdomain)
  // Only use ?tenant for Lovable preview/localhost where subdomains don't work
  const handleFilterClick = (filter: string, value: string) => {
    const newParams: Record<string, string> = { filter, value };
    if (isDemoMode) {
      newParams.demo = "true";
    }

    // Stay on the current page — apply filters in-place
    setSearchParams(newParams);
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
        {/* Library Header */}
        <div className="flex flex-col items-center border-b border-sidebar-border px-6 py-4">
          <Link 
            to={libraryBaseUrl} 
            className="flex items-center gap-2 text-center hover:opacity-80 transition-opacity"
          >
            {!isTenantMode && <img src={logoImage} alt="GameTaverns" className="h-8 w-auto" />}
            <span className="font-display text-lg font-semibold text-sidebar-foreground">
              {isTenantMode && library ? library.name : (settings?.site_name || siteConfig.name)}
            </span>
          </Link>
          
          {/* Library Logo - full width to match title */}
          {isTenantMode && tenantSettings?.logo_url && (
            <Link to={libraryBaseUrl} className="mt-3 w-full">
              <TenantLogoImage
                url={tenantSettings.logo_url}
                alt={`${library?.name || "Library"} logo`}
                className="w-full max-h-40 object-contain rounded-xl bg-sidebar-accent/20"
              />
            </Link>
          )}
        </div>

        <ScrollArea className="flex-1 px-4 py-6">
          {/* ── Navigation ── */}
          <nav className="space-y-1">
            <Link
              to={libraryBaseUrl}
              className={cn(
                "sidebar-link",
                location.pathname === "/" && !currentFilter && "sidebar-link-active"
              )}
            >
              <Library className="h-5 w-5" />
              <span>Full Collection</span>
            </Link>
            
            {/* Owner quick links removed — use top admin bar instead */}
            {comingSoon && (
              <button
                onClick={() => handleFilterClick("status", "coming-soon")}
                className={cn(
                  "sidebar-link w-full text-left",
                  isActive("status", "coming-soon") && "sidebar-link-active"
                )}
              >
                <PackageOpen className="h-5 w-5" />
                <span>Coming Soon</span>
              </button>
            )}
            {forSale && (
              <button
                onClick={() => handleFilterClick("status", "for-sale")}
                className={cn(
                  "sidebar-link w-full text-left",
                  isActive("status", "for-sale") && "sidebar-link-active"
                )}
              >
                <ShoppingCart className="h-5 w-5" />
                <span>For Sale</span>
              </button>
            )}
            {!isTenantMode && (
              <Link
                to="/directory"
                className={cn(
                  "sidebar-link",
                  location.pathname === "/directory" && "sidebar-link-active"
                )}
              >
                <Globe className="h-5 w-5" />
                <span>Browse Libraries</span>
              </Link>
            )}
          </nav>

          {/* Upcoming Events */}
          {isTenantMode && library && events && <SidebarUpcomingEvents libraryId={library.id} />}

          <div className="mt-4 border-t border-sidebar-border/50" />

          {/* ── Quick Filters (always visible) ── */}
          <div className="mt-3">
            <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              Quick Filters
            </div>
            <nav className="space-y-0.5 px-1">
              <button
                onClick={() => handleFilterClick("status", "favorites")}
                className={cn(
                  "sidebar-link w-full text-left text-sm",
                  isActive("status", "favorites") && "sidebar-link-active"
                )}
              >
                <Star className="h-4 w-4" />
                <span>Favorites</span>
              </button>
              <button
                onClick={() => handleFilterClick("status", "top-rated")}
                className={cn(
                  "sidebar-link w-full text-left text-sm",
                  isActive("status", "top-rated") && "sidebar-link-active"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                <span>Top Rated</span>
              </button>
              {wishlist && (
                <button
                  onClick={() => handleFilterClick("status", "wishlist")}
                  className={cn(
                    "sidebar-link w-full text-left text-sm",
                    isActive("status", "wishlist") && "sidebar-link-active"
                  )}
                >
                  <Heart className="h-4 w-4" />
                  <span>Most Wanted</span>
                </button>
              )}
              <button
                onClick={() => handleFilterClick("status", "unplayed")}
                className={cn(
                  "sidebar-link w-full text-left text-sm",
                  isActive("status", "unplayed") && "sidebar-link-active"
                )}
              >
                <CircleOff className="h-4 w-4" />
                <span>Unplayed</span>
              </button>
              <button
                onClick={() => handleFilterClick("status", "expansions")}
                className={cn(
                  "sidebar-link w-full text-left text-sm",
                  isActive("status", "expansions") && "sidebar-link-active"
                )}
              >
                <Puzzle className="h-4 w-4" />
                <span>Expansions</span>
              </button>
            </nav>
          </div>

          {/* ── Advanced Filters (toggle) ── */}
          <Collapsible
            open={showAdvancedFilters}
            onOpenChange={setShowAdvancedFilters}
            className="mt-3"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors rounded-lg hover:bg-sidebar-accent/30">
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Advanced Filters
              </span>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                showAdvancedFilters && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 space-y-1">
                {/* A-Z Filter */}
                <Collapsible defaultOpen={currentFilter === "letter"}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                    <span className="flex items-center gap-2">
                      <ALargeSmall className="h-4 w-4" />
                      A-Z
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-7 gap-0.5 px-3 mt-0.5">
                      {"ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("").map((letter) => (
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
                  </CollapsibleContent>
                </Collapsible>

                {/* Players */}
                <ChipFilterSection
                  title="Players"
                  icon={<Users className="h-3.5 w-3.5" />}
                  options={["1 Player", "2 Players", "3-4 Players", "5-6 Players", "7+ Players"]}
                  filterKey="players"
                  isActive={isActive}
                  onFilterClick={handleFilterClick}
                  defaultOpen={currentFilter === "players"}
                />
                {/* Difficulty */}
                <ChipFilterSection
                  title="Difficulty"
                  icon={<Gauge className="h-3.5 w-3.5" />}
                  options={DIFFICULTY_OPTIONS}
                  filterKey="difficulty"
                  isActive={isActive}
                  onFilterClick={handleFilterClick}
                  defaultOpen={currentFilter === "difficulty"}
                />
                {/* Play Time */}
                <ChipFilterSection
                  title="Play Time"
                  icon={<Clock className="h-3.5 w-3.5" />}
                  options={PLAY_TIME_OPTIONS}
                  filterKey="playtime"
                  isActive={isActive}
                  onFilterClick={handleFilterClick}
                  defaultOpen={currentFilter === "playtime"}
                />
                {/* Type */}
                <ChipFilterSection
                  title="Type"
                  icon={<Gamepad2 className="h-3.5 w-3.5" />}
                  options={GAME_TYPE_OPTIONS}
                  filterKey="type"
                  isActive={isActive}
                  onFilterClick={handleFilterClick}
                  defaultOpen={currentFilter === "type"}
                />
                {/* Genre */}
                <ChipFilterSection
                  title="Genre"
                  icon={<Wand2 className="h-3.5 w-3.5" />}
                  options={GENRE_OPTIONS}
                  filterKey="genre"
                  isActive={isActive}
                  onFilterClick={handleFilterClick}
                  defaultOpen={currentFilter === "genre"}
                />
                {/* Mechanics */}
                <FilterSection title="Mechanics" icon={<Puzzle className="h-3.5 w-3.5" />} defaultOpen={currentFilter === "mechanic"}>
                  <MechanicsFilter
                    mechanics={mechanics}
                    isActive={isActive}
                    onFilterClick={handleFilterClick}
                  />
                </FilterSection>
                {/* Publishers */}
                <FilterSection title="Publishers" icon={<Building2 className="h-3.5 w-3.5" />} defaultOpen={currentFilter === "publisher"}>
                  <div className="max-h-40 overflow-y-auto px-2">
                    {publishers.map((pub) => (
                      <button
                        key={pub.id}
                        onClick={() => handleFilterClick("publisher", pub.name)}
                        className={cn(
                          "sidebar-link text-xs w-full text-left py-1",
                          isActive("publisher", pub.name) && "sidebar-link-active"
                        )}
                      >
                        {pub.name}
                      </button>
                    ))}
                  </div>
                </FilterSection>
                {/* Designers */}
                {designers.length > 0 && (
                  <FilterSection title={`Designers (${designers.length})`} icon={<PenTool className="h-3.5 w-3.5" />} defaultOpen={currentFilter === "designer"}>
                    <div className="max-h-64 overflow-y-auto px-2">
                      <Input
                        placeholder="Search designers..."
                        className="h-6 text-xs mb-1 bg-sidebar-accent/30 border-sidebar-border"
                        onChange={(e) => {
                          const container = e.target.closest('.max-h-40');
                          const buttons = container?.querySelectorAll('button');
                          buttons?.forEach(btn => {
                            btn.style.display = btn.textContent?.toLowerCase().includes(e.target.value.toLowerCase()) ? '' : 'none';
                          });
                        }}
                      />
                      {designers.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => handleFilterClick("designer", d.name)}
                          className={cn(
                            "sidebar-link text-xs w-full text-left py-1",
                            isActive("designer", d.name) && "sidebar-link-active"
                          )}
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                  </FilterSection>
                )}
                {/* Artists */}
                {artists.length > 0 && (
                  <FilterSection title={`Artists (${artists.length})`} icon={<Palette className="h-3.5 w-3.5" />} defaultOpen={currentFilter === "artist"}>
                    <div className="max-h-64 overflow-y-auto px-2">
                      <Input
                        placeholder="Search artists..."
                        className="h-6 text-xs mb-1 bg-sidebar-accent/30 border-sidebar-border"
                        onChange={(e) => {
                          const container = e.target.closest('.max-h-40');
                          const buttons = container?.querySelectorAll('button');
                          buttons?.forEach(btn => {
                            btn.style.display = btn.textContent?.toLowerCase().includes(e.target.value.toLowerCase()) ? '' : 'none';
                          });
                        }}
                      />
                      {artists.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => handleFilterClick("artist", a.name)}
                          className={cn(
                            "sidebar-link text-xs w-full text-left py-1",
                            isActive("artist", a.name) && "sidebar-link-active"
                          )}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </FilterSection>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </ScrollArea>


        {/* User Section - Only show when authenticated */}
        {isAuthenticated && (
          <div className="border-t border-sidebar-border p-4 space-y-2">
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-sidebar-foreground/80">
              <User className="h-4 w-4" />
              <span className="truncate">{user?.email}</span>
            </div>
            
            {/* Play Stats - show when in tenant mode and user is owner */}
            {isTenantMode && isOwner && (
              <Link
                to={buildUrl("/stats")}
                className={cn(
                  "sidebar-link",
                  location.pathname === "/stats" && "sidebar-link-active"
                )}
              >
                <BarChart3 className="h-5 w-5" />
                <span>Play Stats</span>
              </Link>
            )}

            {/* Curated Lists */}
            {isTenantMode && (
              <Link
                to={buildUrl("/lists")}
                className={cn(
                  "sidebar-link",
                  location.pathname.startsWith("/lists") && "sidebar-link-active"
                )}
              >
                <ListOrdered className="h-5 w-5" />
                <span>Lists</span>
              </Link>
            )}
            
            {/* Dashboard link - only show when NOT in tenant mode (accessible via header in tenant mode) */}
            {!isTenantMode && (
              <Link
                to="/dashboard"
                className={cn(
                  "sidebar-link justify-center",
                  location.pathname === "/dashboard" && "sidebar-link-active"
                )}
              >
                <Library className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
            )}
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
