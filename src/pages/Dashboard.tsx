import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { 
  ExternalLink, 
  Settings, 
  LogOut, 
  Plus, 
  Library, 
  Shield, 
  Upload, 
  Star, 
  Heart,
  Gamepad2,
  Palette,
  Mail,
  ArrowRight,
  BarChart3,
  Vote,
  User,
  Calendar,
  BookOpen,
  Trophy,
  AlertTriangle,
  Users,
  Globe,
  MessageSquare,
  DollarSign,
  Target,
  ArrowLeftRight,
  Ticket,
  ChevronDown,
  Zap,
  Activity,
  Pencil
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries, useMaxLibrariesPerUser, useUserProfile } from "@/hooks/useLibrary";
import { useUnreadMessageCount } from "@/hooks/useMessages";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { isSelfHostedSupabaseStack } from "@/config/runtime";
import { DangerZone } from "@/components/settings/DangerZone";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { TwoFactorBanner } from "@/components/dashboard/TwoFactorBanner";
import { AnalyticsTab } from "@/components/analytics/AnalyticsTab";
import { PollsManager } from "@/components/polls/PollsManager";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UpcomingEventsWidget } from "@/components/events/UpcomingEventsWidget";
import { CreateEventDialog } from "@/components/events/CreateEventDialog";
import { LendingDashboard } from "@/components/lending/LendingDashboard";
import { AchievementsDisplay } from "@/components/achievements/AchievementsDisplay";
import { NotificationsDropdown } from "@/components/notifications/NotificationsDropdown";
import { useLending } from "@/hooks/useLending";
import { useMyMemberships, useLibraryMembership } from "@/hooks/useLibraryMembership";
import { RandomGamePicker } from "@/components/games/RandomGamePicker";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { Footer } from "@/components/layout/Footer";
import { MyInquiriesSection } from "@/components/dashboard/MyInquiriesSection";
import { CommunityTab } from "@/components/community/CommunityTab";
import { CommunityMembersCard } from "@/components/community/CommunityMembersCard";
import { ChallengesManager } from "@/components/challenges/ChallengesManager";
import { TradeCenter } from "@/components/trades/TradeCenter";
import { useMyClubs } from "@/hooks/useClubs";
import { ImportProgressWidget } from "@/components/dashboard/ImportProgressWidget";
import { ShelfOfShameWidget } from "@/components/dashboard/ShelfOfShameWidget";
import { CatalogBrowseEmbed } from "@/components/catalog/CatalogBrowseEmbed";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { ExploreChecklist } from "@/components/dashboard/ExploreChecklist";
import { GuidedTour } from "@/components/dashboard/GuidedTour";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { cn } from "@/lib/utils";
import { useTotpStatus } from "@/hooks/useTotpStatus";
import { useTour } from "@/contexts/TourContext";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";

// Icon lookup for dynamic tab icons
const ICON_MAP: Record<string, React.ElementType> = {
  Activity, Zap, MessageSquare, Users, Settings, Star, Trophy, BookOpen,
  Calendar, BarChart3, Target, Heart, Shield, Globe, Mail, Gamepad2,
  Vote, Upload, ArrowLeftRight, AlertTriangle, Plus, DollarSign, Palette, Pencil,
};
function getDynIcon(name: string) { return ICON_MAP[name] || Activity; }

export default function Dashboard() {
  const { user, signOut, isAuthenticated, isAdmin, loading } = useAuth();
  const { data: defaultLibrary, isLoading: libraryLoading } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const { data: maxLibraries = 1 } = useMaxLibrariesPerUser();
  const { data: profile } = useUserProfile();
  
  const [activeLibraryId, setActiveLibraryId] = useState<string | null>(null);
  const library = myLibraries.find((l) => l.id === activeLibraryId) ?? defaultLibrary ?? null;
  
  useEffect(() => {
    if (!activeLibraryId && defaultLibrary) {
      setActiveLibraryId(defaultLibrary.id);
    }
  }, [defaultLibrary, activeLibraryId]);

  const { data: unreadCount = 0 } = useUnreadMessageCount(library?.id);
  const { myLentLoans, myBorrowedLoans } = useLending();
  const { data: myMemberships = [] } = useMyMemberships();
  const { data: myClubs = [] } = useMyClubs();
  const { memberCount } = useLibraryMembership(library?.id);
  const { status: totpStatus } = useTotpStatus();
  const { data: layoutConfig } = useDashboardLayout();
  const pendingLoanRequests = myLentLoans.filter((l) => l.status === "requested").length;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editEvent, setEditEvent] = useState<import("@/hooks/useLibraryEvents").CalendarEvent | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || layoutConfig?.tabs[0]?.id || "overview");

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    if (!tabFromUrl && activeTab !== "overview") {
      setActiveTab("overview");
    }
  }, [tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    if (value === "overview") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", value);
    }
    setSearchParams(newParams, { replace: true });
  };
  
  // Fetch library stats
  const { data: gameCount } = useQuery({
    queryKey: ["library-game-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return 0;
      const { count, error } = await supabase
        .from("games")
        .select("*", { count: "exact", head: true })
        .eq("library_id", library.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!library?.id,
  });
  
  const { data: playCount } = useQuery({
    queryKey: ["library-play-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return 0;
      const { count, error } = await supabase
        .from("game_sessions")
        .select("*, games!inner(library_id)", { count: "exact", head: true })
        .eq("games.library_id", library.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!library?.id,
  });

  const { data: librarySettings } = useQuery({
    queryKey: ["library-settings-onboarding", library?.id],
    queryFn: async () => {
      if (!library?.id) return null;
      const { data, error } = await supabase
        .from("library_settings")
        .select("logo_url, theme_primary_h, background_image_url, bgg_username, feature_community_forum")
        .eq("library_id", library.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!library?.id,
  });

  const { data: eventCount } = useQuery({
    queryKey: ["library-event-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return 0;
      const { count, error } = await supabase
        .from("library_events")
        .select("*", { count: "exact", head: true })
        .eq("library_id", library.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!library?.id,
  });

  const { data: pollCount } = useQuery({
    queryKey: ["library-poll-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return 0;
      const { count, error } = await supabase
        .from("game_polls")
        .select("*", { count: "exact", head: true })
        .eq("library_id", library.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!library?.id,
  });

  const { data: forumThreadCount } = useQuery({
    queryKey: ["library-forum-thread-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return 0;
      const { count, error } = await supabase
        .from("forum_threads")
        .select("*, forum_categories!inner(library_id)", { count: "exact", head: true })
        .eq("forum_categories.library_id", library.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!library?.id,
  });

  const { data: userAchievementCount } = useQuery({
    queryKey: ["user-achievement-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from("user_achievements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const { data: tradeListingCount } = useQuery({
    queryKey: ["user-trade-listing-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return 0;
      const { count, error } = await (supabase as any)
        .from("trade_listings")
        .select("*, games!inner(library_id)", { count: "exact", head: true })
        .eq("games.library_id", library.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!library?.id,
  });

  const { setCompletions: setTourCompletions } = useTour();
  const hasCustomTheme = !!(librarySettings?.logo_url || librarySettings?.theme_primary_h || librarySettings?.background_image_url);
  useEffect(() => {
    setTourCompletions({
      has_library: !!library,
      has_games: (gameCount ?? 0) > 0,
      has_custom_theme: hasCustomTheme,
      has_2fa: totpStatus?.isEnabled ?? false,
    });
  }, [library, gameCount, hasCustomTheme, totpStatus, setTourCompletions]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/");
    }
  };
  
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  const gamesUrl = library ? getLibraryUrl(library.slug, "/games") : null;
  const settingsUrl = library ? getLibraryUrl(library.slug, "/settings") : null;
  const libraryUrl = library ? getLibraryUrl(library.slug, "/") : null;
  const messagesUrl = library ? getLibraryUrl(library.slug, "/messages") : null;

  const activeBorrowedLoans = myBorrowedLoans.filter(l => ['requested', 'approved', 'active'].includes(l.status));

  const defaultTabId = layoutConfig?.tabs[0]?.id || "overview";

  // Build the widget render map — each widget ID maps to its JSX
  const widgetMap: Record<string, React.ReactNode> = {
    "import-progress": <ImportProgressWidget libraryIds={myLibraries.map(l => l.id)} />,
    "onboarding": library ? (
      <OnboardingChecklist
        librarySlug={library.slug}
        gameCount={gameCount ?? 0}
        playCount={playCount ?? 0}
        memberCount={memberCount ?? 0}
        hasCustomTheme={hasCustomTheme}
        hasEvents={(eventCount ?? 0) > 0}
        has2FA={totpStatus?.isEnabled ?? false}
      />
    ) : null,
    "lending": library ? (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-secondary" />
            Game Lending
            {pendingLoanRequests > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingLoanRequests} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent><LendingDashboard libraryId={library.id} /></CardContent>
      </Card>
    ) : null,
    "messages": library && unreadCount > 0 ? (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-secondary" />
            Messages
            <Badge variant="destructive" className="ml-auto">{unreadCount} new</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <a href={messagesUrl!}>
            <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Mail className="h-4 w-4 mr-2" /> View Messages
            </Button>
          </a>
        </CardContent>
      </Card>
    ) : null,
    "borrowed": activeBorrowedLoans.length > 0 ? (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-secondary" />
            My Borrowed Games
            <Badge variant="secondary" className="ml-auto">{activeBorrowedLoans.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeBorrowedLoans.slice(0, 3).map((loan) => (
              <div key={loan.id} className="flex flex-col p-2 rounded-lg bg-wood-medium/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{loan.game?.title || "Unknown Game"}</span>
                  <Badge variant="outline" className="text-xs">{loan.status}</Badge>
                </div>
                {loan.library?.name && (
                  <span className="text-xs text-cream/60 mt-1">From: {loan.library.name}</span>
                )}
              </div>
            ))}
            {activeBorrowedLoans.length > 3 && (
              <p className="text-xs text-cream/60 text-center pt-1">+{activeBorrowedLoans.length - 3} more</p>
            )}
          </div>
        </CardContent>
      </Card>
    ) : null,
    "communities": (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-secondary" />
            My Communities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const ownedEntries = myLibraries.map((lib) => ({
              key: `owned-${lib.id}`, name: lib.name, slug: lib.slug, role: 'owner' as const,
            }));
            const memberEntries = myMemberships
              .filter((m) => !myLibraries.some((lib) => lib.id === m.library?.id))
              .map((m) => ({
                key: `member-${m.id}`, name: m.library?.name ?? 'Unknown', slug: m.library?.slug, role: m.role as string,
              }));
            const allEntries = [...ownedEntries, ...memberEntries];
            if (allEntries.length === 0) {
              return (
                <Link to="/directory">
                  <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                    <Users className="h-4 w-4 mr-2" /> Browse Communities
                  </Button>
                </Link>
              );
            }
            return (
              <div className="space-y-2">
                {allEntries.slice(0, 4).map((entry) => (
                  <a key={entry.key} href={entry.slug ? getLibraryUrl(entry.slug, "/") : "#"} className="flex items-center justify-between p-2 rounded-lg bg-wood-medium/20 hover:bg-wood-medium/40 transition-colors">
                    <span className="text-sm font-medium truncate">{entry.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {entry.role === 'owner' && <Badge variant="secondary" className="text-xs">Owner</Badge>}
                      {entry.role === 'moderator' && <Badge variant="outline" className="text-xs">Mod</Badge>}
                      <ArrowRight className="h-4 w-4 text-cream/60" />
                    </div>
                  </a>
                ))}
                {allEntries.length > 4 && (
                  <p className="text-xs text-cream/60 text-center pt-1">+{allEntries.length - 4} more</p>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    ),
    "achievements": (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-secondary" />
              Achievements
            </CardTitle>
            <Link to="/achievements">
              <Button variant="ghost" size="sm" className="text-cream/70 hover:text-cream hover:bg-wood-medium/40 -mr-2">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent><AchievementsDisplay compact /></CardContent>
      </Card>
    ),
    "shelf-of-shame": library ? <ShelfOfShameWidget libraryId={library.id} /> : null,
    "events": library ? (
      <UpcomingEventsWidget
        libraryId={library.id}
        isOwner={true}
        onCreateEvent={() => setShowCreateEvent(true)}
        onEditEvent={(event) => setEditEvent(event)}
      />
    ) : null,
    "polls": library ? (
      <Card className="bg-wood-medium/30 border-wood-medium/50 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-cream flex items-center gap-2">
            <Vote className="h-5 w-5 text-secondary" />
            Game Polls
          </CardTitle>
          <CardDescription className="text-cream/70">Create and manage game night polls</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto"><PollsManager libraryId={library.id} /></CardContent>
      </Card>
    ) : null,
    "inquiries": (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardContent className="pt-6"><MyInquiriesSection /></CardContent>
      </Card>
    ),
    "explore": library ? (
      <ExploreChecklist
        librarySlug={library.slug}
        hasPlaySessions={(playCount ?? 0) > 0}
        hasPolls={(pollCount ?? 0) > 0}
        hasBggSync={!!librarySettings?.bgg_username}
        hasForum={(forumThreadCount ?? 0) > 0}
        hasClubs={myClubs.length > 0}
        hasEvents={(eventCount ?? 0) > 0}
        hasAchievements={(userAchievementCount ?? 0) > 0}
        hasTrades={(tradeListingCount ?? 0) > 0}
      />
    ) : null,
    "ratings-wishlist": library ? (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-secondary" />
            Ratings & Wishlist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <a href={getLibraryUrl(library.slug, "/settings?tab=ratings")} className="flex-1">
              <Button variant="outline" className="w-full border-secondary/50 text-cream hover:bg-wood-medium/50">
                <Star className="h-4 w-4 mr-2" /> Ratings
              </Button>
            </a>
            <a href={getLibraryUrl(library.slug, "/settings?tab=wishlist")} className="flex-1">
              <Button variant="outline" className="w-full border-secondary/50 text-cream hover:bg-wood-medium/50">
                <Heart className="h-4 w-4 mr-2" /> Wishlist
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    ) : null,
    "challenges": library && isSelfHostedSupabaseStack() ? (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-secondary" />
            Group Challenges
          </CardTitle>
        </CardHeader>
        <CardContent><ChallengesManager libraryId={library.id} canManage={true} /></CardContent>
      </Card>
    ) : null,
    "random-picker": library ? <RandomGamePicker libraryId={library.id} librarySlug={library.slug} /> : null,
    "create-library": library && myLibraries.length < maxLibraries ? (
      <Card className="bg-wood-medium/30 border-wood-medium/50 border-dashed text-cream">
        <CardContent className="py-6 flex items-center justify-between">
          <div>
            <p className="font-medium">Create Another Library</p>
            <p className="text-sm text-cream/60">{myLibraries.length}/{maxLibraries} used</p>
          </div>
          <Link to="/create-library">
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-2" /> Create
            </Button>
          </Link>
        </CardContent>
      </Card>
    ) : null,

    // --- Community widgets ---
    "forums": (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-secondary" />
              Forums
            </CardTitle>
            <InfoPopover title="Community Forums" description="See activity from libraries you follow, discover popular games, and engage with the broader GameTaverns community." className="text-cream/40 hover:text-cream/70" />
          </div>
        </CardHeader>
        <CardContent><CommunityTab /></CardContent>
      </Card>
    ),
    "clubs": (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-secondary" />
                My Clubs
                {myClubs.length > 0 && <Badge variant="secondary" className="text-xs">{myClubs.length}</Badge>}
              </CardTitle>
              <InfoPopover title="Clubs" description="Clubs connect multiple board game libraries, letting members search across collections and organize joint events." className="text-cream/40 hover:text-cream/70" />
            </div>
            <div className="flex gap-2">
              <Link to="/join-club">
                <Button variant="outline" size="sm" className="text-cream border-wood-medium/50 hover:bg-wood-medium/40 gap-1">
                  <Ticket className="h-3.5 w-3.5" /> Join
                </Button>
              </Link>
              <Link to="/request-club">
                <Button size="sm" className="bg-secondary text-secondary-foreground gap-1">
                  <Plus className="h-3.5 w-3.5" /> Request
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {myClubs.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-10 w-10 mx-auto text-cream/30 mb-3" />
              <p className="text-cream/60 text-sm">No clubs yet. Create or join one to connect libraries.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myClubs.map((club) => (
                <div key={club.id} className="flex items-center justify-between p-3 rounded-lg bg-wood-medium/20">
                  <div className="min-w-0 mr-2">
                    <div className="text-sm font-medium truncate">{club.name}</div>
                    <Badge variant={club.status === 'approved' ? 'secondary' : 'outline'} className="text-xs mt-1">{club.status}</Badge>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Link to={`/club/${club.slug}`}>
                      <Button variant="secondary" size="sm" className="gap-1 h-8">
                        <ExternalLink className="h-3 w-3" /> View
                      </Button>
                    </Link>
                    {club.owner_id === user?.id && (
                      <Link to={`/club/${club.slug}/manage`}>
                        <Button variant="outline" size="sm" className="gap-1 h-8 text-cream border-wood-medium/50">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    ),
    "community-members": <CommunityMembersCard />,

    // --- More widgets ---
    "trades": (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-secondary" />
            Cross-Library Trading
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isSelfHostedSupabaseStack() ? (
            <TradeCenter />
          ) : (
            <div className="text-center py-6">
              <ArrowLeftRight className="h-10 w-10 mx-auto text-cream/30 mb-3" />
              <p className="text-cream/60 text-sm">Available on self-hosted deployments only.</p>
            </div>
          )}
        </CardContent>
      </Card>
    ),
    "analytics": (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-secondary" />
            Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(isAdmin || library) ? (
            <AnalyticsTab isAdmin={isAdmin} libraryId={library?.id || null} />
          ) : (
            <div className="text-center py-6">
              <BarChart3 className="h-10 w-10 mx-auto text-cream/30 mb-3" />
              <p className="text-cream/60 text-sm">Create a library to see analytics.</p>
            </div>
          )}
        </CardContent>
      </Card>
    ),
    "catalog": isAdmin ? (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-secondary" />
              Game Catalog
            </CardTitle>
            <Link to="/catalog">
              <Button size="sm" className="bg-secondary text-secondary-foreground gap-1">
                <ExternalLink className="h-3.5 w-3.5" /> Full Catalog
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent><CatalogBrowseEmbed /></CardContent>
      </Card>
    ) : null,
    "account-settings": (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-secondary" />
            Account Settings
          </CardTitle>
          <CardDescription className="text-cream/70">Manage your profile and login credentials</CardDescription>
        </CardHeader>
        <CardContent><AccountSettings /></CardContent>
      </Card>
    ),
    "danger-zone": (
      <Card className="bg-wood-medium/30 border-wood-medium/50 border-red-500/30 text-cream">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-cream/70">Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent><DangerZone /></CardContent>
      </Card>
    ),
  };

  // Legacy tab redirect
  useEffect(() => {
    if (tabFromUrl === "library") {
      handleTabChange(defaultTabId);
    }
    if (tabFromUrl === "more") {
      handleTabChange("settings");
    }
  }, [tabFromUrl]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
      <GuidedTour librarySlug={library?.slug} />
      <AnnouncementBanner />
      <div className="container mx-auto px-4 pt-3">
        <TwoFactorBanner />
      </div>
      
      {/* Header */}
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 sm:gap-3">
              <img src={logoImage} alt="GameTaverns" className="h-8 sm:h-10 w-auto" />
              <span className="font-display text-lg sm:text-2xl font-bold text-cream">
                GameTaverns
              </span>
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              <NotificationsDropdown variant="dashboard" />
              <span className="text-cream/80 hidden md:inline text-sm">{profile?.display_name || (user as any)?.user_metadata?.display_name || user?.email}</span>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleSignOut}
                className="text-cream hover:text-white hover:bg-wood-medium/50"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {/* Navigation links */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Link 
              to="/directory"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 rounded-lg text-cream transition-colors text-sm"
            >
              <Globe className="h-4 w-4" />
              <span>Browse Libraries</span>
            </Link>
            
            {library && (
              <a 
                href={libraryUrl!}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 rounded-lg text-cream transition-colors text-sm"
              >
                <Library className="h-4 w-4" />
                <span>My Library</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            )}
            {(isAdmin || library) && (
              <Link 
                to="/docs"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 rounded-lg text-cream transition-colors text-sm"
              >
                <BookOpen className="h-4 w-4" />
                <span>Guide</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8 sm:py-12 max-w-full">
        <h1 className="font-display text-2xl sm:text-4xl font-bold text-cream mb-6">
          Welcome back, {profile?.display_name || (user as any)?.user_metadata?.display_name || user?.email?.split("@")[0]}
        </h1>

        {/* ===== STATS BAR ===== */}
        {library && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-wood-medium/30 border border-wood-medium/50 rounded-xl p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-secondary">{gameCount ?? "--"}</div>
              <div className="text-xs text-cream/60 mt-1">Games</div>
            </div>
            <div className="bg-wood-medium/30 border border-wood-medium/50 rounded-xl p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-secondary">{playCount ?? "--"}</div>
              <div className="text-xs text-cream/60 mt-1">Plays</div>
            </div>
            <div className="bg-wood-medium/30 border border-wood-medium/50 rounded-xl p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-secondary">{memberCount ?? 0}</div>
              <div className="text-xs text-cream/60 mt-1">Members</div>
            </div>
            <div className="bg-wood-medium/30 border border-wood-medium/50 rounded-xl p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-secondary">{unreadCount + pendingLoanRequests}</div>
              <div className="text-xs text-cream/60 mt-1">Action Items</div>
            </div>
          </div>
        )}

        {/* ===== QUICK ACTIONS ===== */}
        {library && (
          <div className="flex flex-wrap gap-2 mb-8">
            <a href={libraryUrl!}>
              <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> View Library
              </Button>
            </a>
            <a href={gamesUrl!}>
              <Button size="sm" variant="outline" className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Manage Games
              </Button>
            </a>
            <a href={settingsUrl!}>
              <Button size="sm" variant="outline" className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5">
                <Settings className="h-3.5 w-3.5" /> Library Settings
              </Button>
            </a>
            <Link to="/picker">
              <Button size="sm" variant="outline" className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5">
                <Gamepad2 className="h-3.5 w-3.5" /> Random Game
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5"
              onClick={() => handleTabChange("overview")}
            >
              <Star className="h-3.5 w-3.5" /> Explore Features
            </Button>
            {myLibraries.length < maxLibraries && (
              <Link to="/create-library">
                <Button size="sm" variant="outline" className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New Library
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin">
                <Button size="sm" variant="outline" className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Admin
                </Button>
              </Link>
            )}
          </div>
        )}
        
        {layoutConfig && (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="bg-wood-dark/60 border border-wood-medium/40 h-auto flex-wrap gap-1 p-1 mb-8">
              {layoutConfig.tabs.map(tab => {
                const TabIcon = getDynIcon(tab.icon);
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
                  >
                    <TabIcon className="h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {layoutConfig.tabs.map(tab => (
              <TabsContent key={tab.id} value={tab.id}>
                {/* Library Switcher - show on first tab only */}
                {tab.id === layoutConfig.tabs[0]?.id && myLibraries.length > 1 && (
                  <div className="flex items-center gap-3 flex-wrap mb-4">
                    <span className="text-sm text-cream/70 font-medium">Active Library:</span>
                    {myLibraries.map((lib) => (
                      <Button
                        key={lib.id}
                        size="sm"
                        variant={lib.id === library?.id ? "default" : "outline"}
                        className={
                          lib.id === library?.id
                            ? "bg-secondary text-secondary-foreground"
                            : "border-secondary/50 text-cream hover:bg-wood-medium/50"
                        }
                        onClick={() => setActiveLibraryId(lib.id)}
                      >
                        {lib.name}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="space-y-6">
                  {tab.widgets.map(widgetId => {
                    const content = widgetMap[widgetId];
                    if (content === undefined || content === null) return null;
                    return <div key={widgetId}>{content}</div>;
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Editor link for admins */}
        {isAdmin && (
          <div className="flex justify-end mt-4">
            <Link to="/dashboard/editor">
              <Button size="sm" variant="outline" className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit Layout
              </Button>
            </Link>
          </div>
        )}

        {/* Create/Edit Event Dialog */}
        {library && (
          <CreateEventDialog
            open={showCreateEvent || !!editEvent}
            onOpenChange={(open) => {
              if (!open) {
                setShowCreateEvent(false);
                setEditEvent(null);
              }
            }}
            libraryId={library.id}
            editEvent={editEvent}
          />
        )}
      </main>
      
      <Footer />
    </div>
  );
}
