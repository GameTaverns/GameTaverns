import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ExternalLink,
  Settings,
  LogOut,
  Plus,
  Library,
  Shield,
  Star,
  Heart,
  Mail,
  ArrowRight,
  Vote,
  User,
  BookOpen,
  Trophy,
  AlertTriangle,
  Users,
  Globe,
  MessageSquare,
  Target,
  ArrowLeftRight,
  Ticket,
  BarChart3,
  Calendar,
  Shuffle,
  HelpCircle,
  ChevronDown,
  Eye,
  Gamepad2,
  Flame,
  ListOrdered,
} from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries, useMaxLibrariesPerUser, useUserProfile } from "@/hooks/useLibrary";
import { useUnreadMessageCount } from "@/hooks/useMessages";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/backend/client";
import { isSelfHostedSupabaseStack } from "@/config/runtime";
import { HotnessLeaderboard } from "@/components/games/HotnessLeaderboard";

import { DangerZone } from "@/components/settings/DangerZone";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { TwoFactorBanner } from "@/components/dashboard/TwoFactorBanner";
import { PollsManager } from "@/components/polls/PollsManager";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { ProfileThemeCustomizer } from "@/components/settings/ProfileThemeCustomizer";

function AccountSettingsTabs() {
  return (
    <Tabs defaultValue="profile">
      <TabsList className="mb-4">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="appearance">Appearance</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">
        <AccountSettings />
      </TabsContent>
      <TabsContent value="appearance">
        <ProfileThemeCustomizer />
      </TabsContent>
    </Tabs>
  );
}
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UpcomingEventsWidget } from "@/components/events/UpcomingEventsWidget";
import { CreateEventDialog } from "@/components/events/CreateEventDialog";
import { LendingDashboard } from "@/components/lending/LendingDashboard";
import { AchievementsDisplay } from "@/components/achievements/AchievementsDisplay";
import { NotificationsDropdown } from "@/components/notifications/NotificationsDropdown";
import { useLending } from "@/hooks/useLending";
import { useMyMemberships } from "@/hooks/useLibraryMembership";
import { RandomGamePicker } from "@/components/games/RandomGamePicker";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { Footer } from "@/components/layout/Footer";

import { CommunityTab } from "@/components/community/CommunityTab";
import { SocialTab } from "@/components/social/SocialTab";
import { AnalyticsTab } from "@/components/analytics/AnalyticsTab";
import { CommunityMembersCard } from "@/components/community/CommunityMembersCard";
import { ReferralPanel } from "@/components/referral/ReferralPanel";
import { ChallengesManager } from "@/components/challenges/ChallengesManager";
import { TradeCenter } from "@/components/trades/TradeCenter";
import { useMyClubs } from "@/hooks/useClubs";
import { ShelfOfShameWidget } from "@/components/dashboard/ShelfOfShameWidget";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { useTotpStatus } from "@/hooks/useTotpStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/backend/client";
import { InfoPopover } from "@/components/ui/InfoPopover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

// Admin panel imports
import { UserManagement } from "@/components/admin/UserManagement";
import { LibraryManagement } from "@/components/admin/LibraryManagement";
import { PlatformSettings } from "@/components/admin/PlatformSettings";
import { PlatformAnalytics } from "@/components/admin/PlatformAnalytics";
import { FeedbackManagement } from "@/components/admin/FeedbackManagement";
import { ClubsManagement } from "@/components/admin/ClubsManagement";
import { SystemHealth } from "@/components/admin/SystemHealth";
import { PremiumRoadmap } from "@/components/admin/PremiumRoadmap";
import { ServerManagement } from "@/components/admin/ServerManagement";
import { CatalogBrowseEmbed } from "@/components/catalog/CatalogBrowseEmbed";
import { useUnreadFeedbackCount } from "@/hooks/usePlatformFeedback";
import { usePendingClubs } from "@/hooks/useClubs";
import { Activity, Database, MessageCircle, HeartPulse, Crown, Terminal, BookMarked } from "lucide-react";

export default function Dashboard() {
  const { user, signOut, isAuthenticated, isAdmin, loading } = useAuth();
  const { data: defaultLibrary } = useMyLibrary();
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

  const _ = useUnreadMessageCount(library?.id); // kept for cache warming
  const { status: totpStatus } = useTotpStatus();
  const { myLentLoans, myBorrowedLoans } = useLending();
  const { data: myMemberships = [] } = useMyMemberships();
  const { data: myClubs = [] } = useMyClubs();
  const pendingLoanRequests = myLentLoans.filter((l) => l.status === "requested").length;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editEvent, setEditEvent] = useState<import("@/hooks/useLibraryEvents").CalendarEvent | null>(null);

  // Onboarding checklist data
  const { data: gameCountData } = useQuery({
    queryKey: ["onboarding-game-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return { count: 0 };
      const { count } = await _supabase.from("games").select("id", { count: "exact", head: true }).eq("library_id", library.id);
      return { count: count ?? 0 };
    },
    enabled: !!library?.id,
    staleTime: 60000,
  });
  const { data: playCountData } = useQuery({
    queryKey: ["onboarding-play-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return { count: 0 };
      const { data: gameIds } = await _supabase.from("games").select("id").eq("library_id", library.id);
      if (!gameIds?.length) return { count: 0 };
      const ids = gameIds.map((g: any) => g.id);
      const { count } = await _supabase.from("game_sessions").select("id", { count: "exact", head: true }).in("game_id", ids);
      return { count: count ?? 0 };
    },
    enabled: !!library?.id,
    staleTime: 60000,
  });
  const { data: memberCountData } = useQuery({
    queryKey: ["onboarding-member-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return { count: 0 };
      const { count } = await _supabase.from("library_members").select("id", { count: "exact", head: true }).eq("library_id", library.id);
      return { count: count ?? 0 };
    },
    enabled: !!library?.id,
    staleTime: 60000,
  });
  const { data: eventCountData } = useQuery({
    queryKey: ["onboarding-event-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return { count: 0 };
      const { count } = await _supabase.from("library_events").select("id", { count: "exact", head: true }).eq("library_id", library.id);
      return { count: count ?? 0 };
    },
    enabled: !!library?.id,
    staleTime: 60000,
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "library");

  // Admin sub-tab state
  const [adminSubTab, setAdminSubTab] = useState("analytics");
  const { data: unreadFeedbackCount } = useUnreadFeedbackCount();
  const { data: pendingClubs } = usePendingClubs();

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    if (!tabFromUrl && activeTab !== "library") {
      setActiveTab("library");
    }
  }, [tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    if (value === "library") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", value);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Sign out handled by AppHeader

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  // Legacy tab redirects
  const legacyTabMap: Record<string, string> = { overview: "library", more: "personal", settings: "personal", lending: "library" };
  if (tabFromUrl && legacyTabMap[tabFromUrl]) {
    handleTabChange(legacyTabMap[tabFromUrl]);
  }

  // Don't block on loading if we already know the user is authenticated
  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const gamesUrl = library ? getLibraryUrl(library.slug, "/games") : null;
  const settingsUrl = library ? getLibraryUrl(library.slug, "/settings") : null;
  const libraryUrl = library ? getLibraryUrl(library.slug, "/") : null;
  const statsUrl = library ? getLibraryUrl(library.slug, "/stats") : null;
  const activeBorrowedLoans = myBorrowedLoans.filter(l => ['requested', 'approved', 'active'].includes(l.status));

  // Uniform card class for consistency
  const cardClass = "bg-wood-medium/30 border-wood-medium/50 text-cream";
  const btnPrimary = "bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs h-7 gap-1.5";
  const btnOutline = "border-secondary/50 text-cream hover:bg-wood-medium/50 text-xs h-7 gap-1.5";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <AnnouncementBanner />
      <div className="container mx-auto px-4 pt-3">
        <TwoFactorBanner />
      </div>

      <AppHeader />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-cream mb-5">
          Welcome back, {profile?.display_name || (user as any)?.user_metadata?.display_name || user?.email?.split("@")[0]}
        </h1>

        {/* ===== TABS ===== */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-wood-dark/60 border border-wood-medium/40 h-auto flex-wrap gap-1 p-1 mb-6 overflow-x-auto no-scrollbar">
            <TabsTrigger
              value="library"
              className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <Library className="h-3.5 w-3.5" />
              Library
              {pendingLoanRequests > 0 && <Badge variant="destructive" className="text-[10px] ml-1 px-1">{pendingLoanRequests}</Badge>}
            </TabsTrigger>
            <TabsTrigger
              value="community"
              className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <Users className="h-3.5 w-3.5" />
              Community
            </TabsTrigger>
            <TabsTrigger
              value="social"
              className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <Globe className="h-3.5 w-3.5" />
              Social
            </TabsTrigger>
            <TabsTrigger
              value="personal"
              className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <User className="h-3.5 w-3.5" />
              Personal
            </TabsTrigger>
            <TabsTrigger
              value="referrals"
              className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <Users className="h-3.5 w-3.5" />
              Referrals
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="danger"
              className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-red-700 data-[state=active]:text-white data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Danger
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="admin"
                className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </TabsTrigger>
            )}
          </TabsList>

          {/* ==================== LIBRARY TAB ==================== */}
          <TabsContent value="library">
            {/* Library Switcher */}
            {myLibraries.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-xs text-cream/70 font-medium">Active Library:</span>
                {myLibraries.map((lib) => (
                  <Button
                    key={lib.id}
                    size="sm"
                    variant={lib.id === library?.id ? "default" : "outline"}
                    className={`text-xs h-7 ${
                      lib.id === library?.id
                        ? "bg-secondary text-secondary-foreground"
                        : "border-secondary/50 text-cream hover:bg-wood-medium/50"
                    }`}
                    onClick={() => setActiveLibraryId(lib.id)}
                  >
                    {lib.name}
                  </Button>
                ))}
              </div>
            )}

            {!library ? (
              <Card className={cardClass}>
                <CardContent className="py-8 text-center">
                  <Library className="h-10 w-10 mx-auto text-cream/30 mb-3" />
                  <p className="text-sm text-cream/70 mb-4">You don't have a library yet. Create one to get started!</p>
                  <Link to="/create-library">
                    <Button className={btnPrimary}>
                      <Plus className="h-3.5 w-3.5" /> Create Library
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* ── Onboarding Checklist ── shown until dismissed */}
                <OnboardingChecklist
                  librarySlug={library.slug}
                  gameCount={gameCountData?.count ?? 0}
                  playCount={playCountData?.count ?? 0}
                  memberCount={memberCountData?.count ?? 0}
                  hasCustomTheme={false}
                  hasEvents={(eventCountData?.count ?? 0) > 0}
                  has2FA={totpStatus?.isEnabled ?? false}
                />

                {/* ── Trending This Month ── full-width prominent section */}
                <Card className={`${cardClass} md:col-span-2 lg:col-span-3`}>
                  <CardHeader className="px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Flame className="h-4 w-4 text-orange-400" />
                        Trending This Month
                      </CardTitle>
                    </div>
                    <CardDescription className="text-cream/60 text-xs">Games generating the most buzz in your library right now</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <HotnessLeaderboard libraryId={library.id} tenantSlug={library.slug} limit={10} />
                  </CardContent>
                </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Games Card */}
                <Card className={cardClass}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Gamepad2 className="h-4 w-4 text-secondary" />
                      My Games
                    </CardTitle>
                    <CardDescription className="text-cream/60 text-xs">Add or manage your collection</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex flex-col gap-1.5">
                      <TenantLink href={getLibraryUrl(library.slug, "/games")}>
                        <Button size="sm" className={`w-full ${btnPrimary}`}>
                          <Plus className="h-3 w-3" /> Add Games
                        </Button>
                      </TenantLink>
                      <TenantLink href={getLibraryUrl(library.slug, "/manage")}>
                        <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                          <Settings className="h-3 w-3" /> Manage Collection
                        </Button>
                      </TenantLink>
                      <TenantLink href={libraryUrl!}>
                        <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                          <Eye className="h-3 w-3" /> View Public Page
                        </Button>
                      </TenantLink>
                    </div>
                  </CardContent>
                </Card>

                {/* Events Card */}
                <Card className={cardClass}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-secondary" />
                        Events
                      </span>
                      <Button
                        size="sm"
                        className={btnPrimary}
                        onClick={() => setShowCreateEvent(true)}
                      >
                        <Plus className="h-3 w-3" /> Create
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <UpcomingEventsWidget
                      libraryId={library.id}
                      isOwner={true}
                      onCreateEvent={() => setShowCreateEvent(true)}
                      onEditEvent={(event) => setEditEvent(event)}
                    />
                  </CardContent>
                </Card>

                {/* Polls Card */}
                <Card className={`${cardClass} overflow-hidden`}>
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Vote className="h-4 w-4 text-secondary" />
                      Polls
                    </CardTitle>
                    <CardDescription className="text-cream/60 text-xs">Create and manage game night polls</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 overflow-x-auto">
                    <PollsManager libraryId={library.id} />
                  </CardContent>
                </Card>

                {/* Lending Card */}
                <Card className={cardClass}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-secondary" />
                      Lending
                      {pendingLoanRequests > 0 && (
                        <Badge variant="destructive" className="text-[10px]">{pendingLoanRequests} pending</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-cream/60 text-xs">Track loans and borrow requests</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <LendingDashboard libraryId={library.id} />
                  </CardContent>
                </Card>

                {/* Ratings & Wishlist Card */}
                <Card className={cardClass}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Star className="h-4 w-4 text-secondary" />
                      Ratings & Wishlist
                    </CardTitle>
                    <CardDescription className="text-cream/60 text-xs">Community feedback and wanted games</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex flex-col gap-1.5">
                      <TenantLink href={getLibraryUrl(library.slug, "/settings?tab=ratings")}>
                        <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                          <Star className="h-3.5 w-3.5" /> View Ratings
                        </Button>
                      </TenantLink>
                      <TenantLink href={getLibraryUrl(library.slug, "/settings?tab=wishlist")}>
                        <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                          <Heart className="h-3.5 w-3.5" /> View Wishlist
                        </Button>
                      </TenantLink>
                    </div>
                  </CardContent>
                </Card>

                {/* Shelf of Shame */}
                <ShelfOfShameWidget libraryId={library.id} />

                {/* Random Picker Card */}
                <Card className={cardClass}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Shuffle className="h-4 w-4 text-secondary" />
                      Random Picker
                    </CardTitle>
                    <CardDescription className="text-cream/60 text-xs">Can't decide? Let fate choose!</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <RandomGamePicker libraryId={library.id} librarySlug={library.slug} />
                  </CardContent>
                </Card>

                {/* Settings Card */}
                <Card className={cardClass}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Settings className="h-4 w-4 text-secondary" />
                      Library Settings
                    </CardTitle>
                    <CardDescription className="text-cream/60 text-xs">Customize your library configuration</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <TenantLink href={settingsUrl!}>
                      <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                        <Settings className="h-3.5 w-3.5" /> Manage Settings
                      </Button>
                    </TenantLink>
                  </CardContent>
                </Card>

                {/* Create Another Library */}
                {myLibraries.length < maxLibraries && (
                  <Card className={`${cardClass} border-dashed`}>
                    <CardContent className="py-4 px-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Create Another Library</p>
                        <p className="text-xs text-cream/60">{myLibraries.length}/{maxLibraries} used</p>
                      </div>
                      <Link to="/create-library">
                        <Button size="sm" className={btnPrimary}>
                          <Plus className="h-3.5 w-3.5" /> Create
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}

                {/* Curated Lists Card */}
                <Card className={cardClass}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <ListOrdered className="h-4 w-4 text-secondary" />
                        Curated Lists
                      </CardTitle>
                      <Link to="/lists">
                        <Button variant="ghost" size="sm" className="text-cream/70 hover:text-cream hover:bg-wood-medium/40 text-xs h-7 gap-1">
                          View All <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                    <CardDescription className="text-cream/60 text-xs">Ranked game lists — vote for community favourites</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <Link to="/lists">
                      <Button size="sm" className={`w-full ${btnPrimary}`}>
                        <ListOrdered className="h-3.5 w-3.5" /> Browse &amp; Create Lists
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
              </div>
            )}
          </TabsContent>

          {/* ==================== COMMUNITY TAB ==================== */}
          <TabsContent value="community">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Forums */}
              <Card className={`${cardClass} md:col-span-2 lg:col-span-3`}>
                <CardHeader className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <MessageSquare className="h-4 w-4 text-secondary" />
                        Forums
                      </CardTitle>
                      <InfoPopover title="Community Forums" description="Engage with the broader GameTaverns community. Library and club forums are accessible from their respective pages." className="text-cream/40 hover:text-cream/70" />
                    </div>
                    <Link to="/community">
                      <Button variant="ghost" size="sm" className="text-cream/70 hover:text-cream hover:bg-wood-medium/40 text-xs h-7 gap-1">
                        View All <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4"><CommunityTab /></CardContent>
              </Card>

              {/* Clubs */}
              <Card className={cardClass}>
                <CardHeader className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-secondary" />
                      My Clubs
                      {myClubs.length > 0 && <Badge variant="secondary" className="text-[10px]">{myClubs.length}</Badge>}
                    </CardTitle>
                    <div className="flex gap-1.5">
                      <Link to="/join-club">
                        <Button variant="outline" size="sm" className={`text-cream ${btnOutline}`}>
                          <Ticket className="h-3 w-3" /> Join
                        </Button>
                      </Link>
                      <Link to="/request-club">
                        <Button size="sm" className={btnPrimary}>
                          <Plus className="h-3 w-3" /> Request
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {myClubs.length === 0 ? (
                    <div className="text-center py-4">
                      <Users className="h-8 w-8 mx-auto text-cream/30 mb-2" />
                      <p className="text-cream/60 text-xs">No clubs yet. Create or join one to connect libraries.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myClubs.map((club) => (
                        <div key={club.id} className="flex items-center justify-between p-2 rounded-lg bg-wood-medium/20">
                          <div className="min-w-0 mr-2">
                            <div className="text-xs font-medium truncate">{club.name}</div>
                            <Badge variant={club.status === 'approved' ? 'secondary' : 'outline'} className="text-[10px] mt-0.5">{club.status}</Badge>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Link to={`/club/${club.slug}`}>
                              <Button variant="secondary" size="sm" className="gap-1 h-6 text-[10px] px-2">
                                <ExternalLink className="h-2.5 w-2.5" /> View
                              </Button>
                            </Link>
                            {club.owner_id === user?.id && (
                              <Link to={`/club/${club.slug}/manage`}>
                                <Button variant="outline" size="sm" className="gap-1 h-6 text-cream border-wood-medium/50 px-2">
                                  <Settings className="h-2.5 w-2.5" />
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

              {/* My Communities */}
              <Card className={cardClass}>
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-secondary" />
                    My Communities
                  </CardTitle>
                  <CardDescription className="text-cream/60 text-xs">Libraries you own or belong to</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
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
                          <Button size="sm" className={`w-full ${btnPrimary}`}>
                            <Users className="h-3.5 w-3.5" /> Browse Communities
                          </Button>
                        </Link>
                      );
                    }
                    return (
                      <div className="space-y-1.5">
                        {allEntries.map((entry) => (
                          <a key={entry.key} href={entry.slug ? getLibraryUrl(entry.slug, "/") : "#"} className="flex items-center justify-between p-2 rounded-lg bg-wood-medium/20 hover:bg-wood-medium/40 transition-colors">
                            <span className="text-xs font-medium truncate">{entry.name}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {entry.role === 'owner' && <Badge variant="secondary" className="text-[10px]">Owner</Badge>}
                              {entry.role === 'admin' && <Badge className="text-[10px] bg-blue-600">Admin</Badge>}
                              {entry.role === 'moderator' && <Badge variant="outline" className="text-[10px]">Mod</Badge>}
                              {entry.role === 'member' && <Badge variant="outline" className="text-[10px]">Member</Badge>}
                              <ArrowRight className="h-3 w-3 text-cream/60" />
                            </div>
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Members */}
              <CommunityMembersCard />

              {/* Trades */}
              <Card className={cardClass}>
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ArrowLeftRight className="h-4 w-4 text-secondary" />
                    Trading
                  </CardTitle>
                  <CardDescription className="text-cream/60 text-xs">Buy, sell, and trade games</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {isSelfHostedSupabaseStack() ? (
                    <TradeCenter />
                  ) : (
                    <div className="text-center py-4">
                      <ArrowLeftRight className="h-8 w-8 mx-auto text-cream/30 mb-2" />
                      <p className="text-cream/60 text-xs">Available on self-hosted deployments only.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Challenges */}
              {library && isSelfHostedSupabaseStack() && (
                <Card className={cardClass}>
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-secondary" />
                      Challenges
                    </CardTitle>
                    <CardDescription className="text-cream/60 text-xs">Community gaming challenges</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4"><ChallengesManager libraryId={library.id} canManage={true} /></CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ==================== SOCIAL TAB ==================== */}
          <TabsContent value="social">
            <SocialTab currentUserId={user?.id} />
          </TabsContent>

          {/* ==================== PERSONAL TAB ==================== */}
          <TabsContent value="personal">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* My Public Profile */}
              {profile?.username && (
                <Card className={cardClass}>
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-secondary" />
                      My Profile
                    </CardTitle>
                    <CardDescription className="text-cream/60 text-xs">Your public profile page</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <Link to={`/u/${profile.username}`}>
                      <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                        <Eye className="h-3.5 w-3.5" /> View Profile
                        <ArrowRight className="h-3 w-3 ml-auto" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}

              {/* Account Settings */}
              <Card className={`${cardClass} md:col-span-2 lg:col-span-3`}>
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Settings className="h-4 w-4 text-secondary" />
                    Account Settings
                  </CardTitle>
                  <CardDescription className="text-cream/70 text-xs">Profile, appearance &amp; security</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <AccountSettingsTabs />
                </CardContent>
              </Card>

              {/* Achievements */}
              <Card className={cardClass}>
                <CardHeader className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Trophy className="h-4 w-4 text-secondary" />
                      Achievements
                    </CardTitle>
                    <Link to="/achievements">
                      <Button variant="ghost" size="sm" className="text-cream/70 hover:text-cream hover:bg-wood-medium/40 -mr-2 text-xs h-7 gap-1">
                        View All <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4"><AchievementsDisplay compact /></CardContent>
              </Card>

              {/* Inbox Link */}
              <Card className={cardClass}>
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-secondary" />
                    Messages
                  </CardTitle>
                  <CardDescription className="text-cream/60 text-xs">View your inbox</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <Link to="/inbox">
                    <Button variant="outline" size="sm" className="w-full border-secondary/50 text-cream gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      Open Inbox
                      <ArrowRight className="h-3 w-3 ml-auto" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Borrowed Games */}
              <Card className={cardClass}>
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-secondary" />
                    Borrowed Games
                    {activeBorrowedLoans.length > 0 && <Badge variant="secondary" className="ml-auto text-[10px]">{activeBorrowedLoans.length}</Badge>}
                  </CardTitle>
                  <CardDescription className="text-cream/60 text-xs">Games you're currently borrowing</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {activeBorrowedLoans.length === 0 ? (
                    <p className="text-xs text-cream/60 text-center py-2">No active borrows</p>
                  ) : (
                    <div className="space-y-1.5">
                      {activeBorrowedLoans.slice(0, 5).map((loan) => (
                        <div key={loan.id} className="flex flex-col p-2 rounded-lg bg-wood-medium/20">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium truncate">{loan.game?.title || "Unknown Game"}</span>
                            <Badge variant="outline" className="text-[10px]">{loan.status}</Badge>
                          </div>
                          {loan.library?.name && (
                            <span className="text-[10px] text-cream/60 mt-0.5">From: {loan.library.name}</span>
                          )}
                        </div>
                      ))}
                      {activeBorrowedLoans.length > 5 && (
                        <p className="text-[10px] text-cream/60 text-center pt-1">+{activeBorrowedLoans.length - 5} more</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== REFERRALS TAB ==================== */}
          <TabsContent value="referrals">
            <div className="max-w-2xl">
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold mb-1">Invite & Earn Badges</h2>
                <p className="text-muted-foreground text-sm">Share GameTaverns with friends and earn exclusive badges as they join.</p>
              </div>
              <ReferralPanel />
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            {library ? (
              <AnalyticsTab isAdmin={isAdmin} libraryId={library.id} libraryName={library.name} />
            ) : (
              <Card className={cardClass}>
                <CardContent className="py-8 text-center">
                  <BarChart3 className="h-10 w-10 mx-auto text-cream/30 mb-3" />
                  <p className="text-sm text-cream/60">Create a library to start tracking analytics.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== DANGER ZONE TAB ==================== */}
          <TabsContent value="danger">
            <Card className="bg-red-950/60 border-red-700/50 text-cream">
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-red-300/70 text-xs">Irreversible and destructive actions</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4"><DangerZone /></CardContent>
            </Card>
          </TabsContent>

          {/* ==================== ADMIN TAB (admin only) - embedded panel ==================== */}
          {isAdmin && (
            <TabsContent value="admin">
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="h-5 w-5 text-secondary" />
                  <h2 className="font-display text-lg font-bold text-cream">Site Administration</h2>
                </div>

                {/* Admin sub-tabs */}
                <Tabs value={adminSubTab} onValueChange={setAdminSubTab} className="w-full">
                  <TabsList className="bg-wood-dark/60 border border-wood-medium/40 h-auto flex-wrap gap-1 p-1 mb-4 overflow-x-auto no-scrollbar">
                    <TabsTrigger value="analytics" className="gap-1 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                      <Activity className="h-3 w-3" /> Analytics
                    </TabsTrigger>
                    <TabsTrigger value="users" className="gap-1 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                      <Users className="h-3 w-3" /> Users
                    </TabsTrigger>
                    <TabsTrigger value="libraries" className="gap-1 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                      <Database className="h-3 w-3" /> Libraries
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-1 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                      <Settings className="h-3 w-3" /> Settings
                    </TabsTrigger>
                    <TabsTrigger value="feedback" className="gap-1 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground relative">
                      <MessageCircle className="h-3 w-3" /> Feedback
                      {unreadFeedbackCount && unreadFeedbackCount > 0 && (
                        <Badge className="ml-1 h-4 min-w-[16px] px-1 text-[10px] bg-destructive text-destructive-foreground">
                          {unreadFeedbackCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="clubs" className="gap-1 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground relative">
                      <Trophy className="h-3 w-3" /> Clubs
                      {pendingClubs && pendingClubs.length > 0 && (
                        <Badge className="ml-1 h-4 min-w-[16px] px-1 text-[10px] bg-destructive text-destructive-foreground">
                          {pendingClubs.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="health" className="gap-1 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                      <HeartPulse className="h-3 w-3" /> Health
                    </TabsTrigger>
                    <TabsTrigger value="premium" className="gap-1 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                      <Crown className="h-3 w-3" /> Premium
                    </TabsTrigger>
                    <TabsTrigger value="server" className="gap-1 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                      <Terminal className="h-3 w-3" /> Server
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="analytics"><PlatformAnalytics /></TabsContent>
                  <TabsContent value="users"><UserManagement /></TabsContent>
                  <TabsContent value="libraries"><LibraryManagement /></TabsContent>
                  <TabsContent value="settings"><PlatformSettings /></TabsContent>
                  <TabsContent value="feedback"><FeedbackManagement /></TabsContent>
                  <TabsContent value="clubs"><ClubsManagement /></TabsContent>
                  <TabsContent value="health"><SystemHealth /></TabsContent>
                  <TabsContent value="premium"><PremiumRoadmap /></TabsContent>
                  <TabsContent value="server"><ServerManagement /></TabsContent>
                </Tabs>
              </div>
            </TabsContent>
          )}
        </Tabs>

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
