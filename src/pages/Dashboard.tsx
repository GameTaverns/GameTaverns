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
import { supabase } from "@/integrations/backend/client";
import { isSelfHostedSupabaseStack } from "@/config/runtime";
import { DangerZone } from "@/components/settings/DangerZone";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { TwoFactorBanner } from "@/components/dashboard/TwoFactorBanner";
import { PollsManager } from "@/components/polls/PollsManager";
import { AccountSettings } from "@/components/settings/AccountSettings";
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
import { Footer } from "@/components/layout/Footer";
import { MyInquiriesSection } from "@/components/dashboard/MyInquiriesSection";
import { CommunityTab } from "@/components/community/CommunityTab";
import { CommunityMembersCard } from "@/components/community/CommunityMembersCard";
import { ChallengesManager } from "@/components/challenges/ChallengesManager";
import { TradeCenter } from "@/components/trades/TradeCenter";
import { useMyClubs } from "@/hooks/useClubs";
import { ShelfOfShameWidget } from "@/components/dashboard/ShelfOfShameWidget";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { useQuery } from "@tanstack/react-query";

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

  const { data: unreadCount = 0 } = useUnreadMessageCount(library?.id);
  const { myLentLoans, myBorrowedLoans } = useLending();
  const { data: myMemberships = [] } = useMyMemberships();
  const { data: myClubs = [] } = useMyClubs();
  const pendingLoanRequests = myLentLoans.filter((l) => l.status === "requested").length;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editEvent, setEditEvent] = useState<import("@/hooks/useLibraryEvents").CalendarEvent | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "library");

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

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: "Error signing out", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  // Legacy tab redirects
  const legacyTabMap: Record<string, string> = { overview: "library", more: "personal", settings: "personal" };
  if (tabFromUrl && legacyTabMap[tabFromUrl]) {
    handleTabChange(legacyTabMap[tabFromUrl]);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const gamesUrl = library ? getLibraryUrl(library.slug, "/games") : null;
  const settingsUrl = library ? getLibraryUrl(library.slug, "/settings") : null;
  const libraryUrl = library ? getLibraryUrl(library.slug, "/") : null;
  const messagesUrl = library ? getLibraryUrl(library.slug, "/messages") : null;
  const activeBorrowedLoans = myBorrowedLoans.filter(l => ['requested', 'approved', 'active'].includes(l.status));

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
      <AnnouncementBanner />
      <div className="container mx-auto px-4 pt-3">
        <TwoFactorBanner />
      </div>

      {/* Header */}
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoImage} alt="GameTaverns" className="h-7 sm:h-8 w-auto" />
              <span className="font-display text-base sm:text-lg font-bold text-cream">
                GameTaverns
              </span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <NotificationsDropdown variant="dashboard" />
              <span className="text-cream/80 hidden md:inline text-xs">
                {profile?.display_name || (user as any)?.user_metadata?.display_name || user?.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="text-cream hover:text-white hover:bg-wood-medium/50 h-8 w-8"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Compact nav links */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Link
              to="/directory"
              className="flex items-center gap-1 px-2 py-1 bg-secondary/20 hover:bg-secondary/30 rounded text-cream transition-colors text-xs"
            >
              <Globe className="h-3 w-3" />
              <span>Browse Libraries</span>
            </Link>
            {library && (
              <a
                href={libraryUrl!}
                className="flex items-center gap-1 px-2 py-1 bg-secondary/20 hover:bg-secondary/30 rounded text-cream transition-colors text-xs"
              >
                <Library className="h-3 w-3" />
                <span>My Library</span>
              </a>
            )}
            {library && (
              <a
                href={gamesUrl!}
                className="flex items-center gap-1 px-2 py-1 bg-secondary/20 hover:bg-secondary/30 rounded text-cream transition-colors text-xs"
              >
                <Settings className="h-3 w-3" />
                <span>Manage Games</span>
              </a>
            )}
            {library && (
              <a
                href={settingsUrl!}
                className="flex items-center gap-1 px-2 py-1 bg-secondary/20 hover:bg-secondary/30 rounded text-cream transition-colors text-xs"
              >
                <Settings className="h-3 w-3" />
                <span>Settings</span>
              </a>
            )}
            {(isAdmin || library) && (
              <Link
                to="/docs"
                className="flex items-center gap-1 px-2 py-1 bg-secondary/20 hover:bg-secondary/30 rounded text-cream transition-colors text-xs"
              >
                <BookOpen className="h-3 w-3" />
                <span>Guide</span>
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1 px-2 py-1 bg-secondary/20 hover:bg-secondary/30 rounded text-cream transition-colors text-xs"
              >
                <Shield className="h-3 w-3" />
                <span>Admin</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-cream mb-5">
          Welcome back, {profile?.display_name || (user as any)?.user_metadata?.display_name || user?.email?.split("@")[0]}
        </h1>

        {/* ===== TABS ===== */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-wood-dark/60 border border-wood-medium/40 h-auto flex-wrap gap-1 p-1 mb-6">
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
              value="personal"
              className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <User className="h-3.5 w-3.5" />
              Personal
            </TabsTrigger>
            <TabsTrigger
              value="danger"
              className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-red-700 data-[state=active]:text-white data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Danger Zone
            </TabsTrigger>
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

            <div className="space-y-4">
              {/* Lending Dashboard */}
              {library && (
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-secondary" />
                      Game Lending
                      {pendingLoanRequests > 0 && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">{pendingLoanRequests} pending</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4"><LendingDashboard libraryId={library.id} /></CardContent>
                </Card>
              )}

              {/* Messages */}
              {library && unreadCount > 0 && (
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-secondary" />
                      <span className="text-sm font-medium">Messages</span>
                      <Badge variant="destructive" className="text-[10px]">{unreadCount} new</Badge>
                    </div>
                    <a href={messagesUrl!}>
                      <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs h-7">
                        View
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              )}

              {/* Events */}
              {library && (
                <UpcomingEventsWidget
                  libraryId={library.id}
                  isOwner={true}
                  onCreateEvent={() => setShowCreateEvent(true)}
                  onEditEvent={(event) => setEditEvent(event)}
                />
              )}

              {/* Polls */}
              {library && (
                <Card className="bg-wood-medium/30 border-wood-medium/50 overflow-hidden">
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="text-cream flex items-center gap-2 text-sm">
                      <Vote className="h-4 w-4 text-secondary" />
                      Game Polls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 overflow-x-auto"><PollsManager libraryId={library.id} /></CardContent>
                </Card>
              )}

              {/* Shelf of Shame */}
              {library && <ShelfOfShameWidget libraryId={library.id} />}

              {/* Random Game Picker */}
              {library && <RandomGamePicker libraryId={library.id} librarySlug={library.slug} />}

              {/* Ratings & Wishlist */}
              {library && (
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardContent className="py-3 px-4">
                    <div className="flex gap-2">
                      <a href={getLibraryUrl(library.slug, "/settings?tab=ratings")} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full border-secondary/50 text-cream hover:bg-wood-medium/50 text-xs h-8">
                          <Star className="h-3.5 w-3.5 mr-1.5" /> Ratings
                        </Button>
                      </a>
                      <a href={getLibraryUrl(library.slug, "/settings?tab=wishlist")} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full border-secondary/50 text-cream hover:bg-wood-medium/50 text-xs h-8">
                          <Heart className="h-3.5 w-3.5 mr-1.5" /> Wishlist
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Create Another Library */}
              {library && myLibraries.length < maxLibraries && (
                <Card className="bg-wood-medium/30 border-wood-medium/50 border-dashed text-cream">
                  <CardContent className="py-4 px-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Create Another Library</p>
                      <p className="text-xs text-cream/60">{myLibraries.length}/{maxLibraries} used</p>
                    </div>
                    <Link to="/create-library">
                      <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs h-7">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Create
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ==================== COMMUNITY TAB ==================== */}
          <TabsContent value="community">
            <div className="space-y-4">
              {/* Forums */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardHeader className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-secondary" />
                      Forums
                    </CardTitle>
                    <InfoPopover title="Community Forums" description="See activity from libraries you follow, discover popular games, and engage with the broader GameTaverns community." className="text-cream/40 hover:text-cream/70" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4"><CommunityTab /></CardContent>
              </Card>

              {/* Clubs */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardHeader className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-secondary" />
                        My Clubs
                        {myClubs.length > 0 && <Badge variant="secondary" className="text-[10px]">{myClubs.length}</Badge>}
                      </CardTitle>
                      <InfoPopover title="Clubs" description="Clubs connect multiple board game libraries, letting members search across collections and organize joint events." className="text-cream/40 hover:text-cream/70" />
                    </div>
                    <div className="flex gap-1.5">
                      <Link to="/join-club">
                        <Button variant="outline" size="sm" className="text-cream border-wood-medium/50 hover:bg-wood-medium/40 gap-1 text-xs h-7">
                          <Ticket className="h-3 w-3" /> Join
                        </Button>
                      </Link>
                      <Link to="/request-club">
                        <Button size="sm" className="bg-secondary text-secondary-foreground gap-1 text-xs h-7">
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

              {/* Community Members */}
              <CommunityMembersCard />

              {/* Trades */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ArrowLeftRight className="h-4 w-4 text-secondary" />
                    Cross-Library Trading
                  </CardTitle>
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
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-secondary" />
                      Group Challenges
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4"><ChallengesManager libraryId={library.id} canManage={true} /></CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ==================== PERSONAL TAB ==================== */}
          <TabsContent value="personal">
            <div className="space-y-4">
              {/* Account Settings */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Settings className="h-4 w-4 text-secondary" />
                    Account Settings
                  </CardTitle>
                  <CardDescription className="text-cream/70 text-xs">Profile &amp; security</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4"><AccountSettings /></CardContent>
              </Card>

              {/* Achievements */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardHeader className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Trophy className="h-4 w-4 text-secondary" />
                      Achievements
                    </CardTitle>
                    <Link to="/achievements">
                      <Button variant="ghost" size="sm" className="text-cream/70 hover:text-cream hover:bg-wood-medium/40 -mr-2 text-xs h-7">
                        View All <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4"><AchievementsDisplay compact /></CardContent>
              </Card>

              {/* My Communities */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-secondary" />
                    My Communities
                  </CardTitle>
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
                          <Button size="sm" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs">
                            <Users className="h-3.5 w-3.5 mr-1.5" /> Browse Communities
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
                              {entry.role === 'moderator' && <Badge variant="outline" className="text-[10px]">Mod</Badge>}
                              <ArrowRight className="h-3 w-3 text-cream/60" />
                            </div>
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* My Inquiries */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardContent className="pt-4 px-4 pb-4"><MyInquiriesSection /></CardContent>
              </Card>

              {/* Borrowed Games */}
              {activeBorrowedLoans.length > 0 && (
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-secondary" />
                      My Borrowed Games
                      <Badge variant="secondary" className="ml-auto text-[10px]">{activeBorrowedLoans.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
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
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ==================== DANGER ZONE TAB ==================== */}
          <TabsContent value="danger">
            <div className="space-y-4">
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
            </div>
          </TabsContent>
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
