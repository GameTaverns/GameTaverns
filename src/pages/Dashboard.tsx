import { useEffect, useState } from "react";
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
  ArrowLeftRight
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
import { ChallengesManager } from "@/components/challenges/ChallengesManager";
import { TradeCenter } from "@/components/trades/TradeCenter";

export default function Dashboard() {
  const { user, signOut, isAuthenticated, isAdmin, loading } = useAuth();
  const { data: library, isLoading: libraryLoading } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const { data: maxLibraries = 1 } = useMaxLibrariesPerUser();
  const { data: profile } = useUserProfile();
  const { data: unreadCount = 0 } = useUnreadMessageCount(library?.id);
  const { myLentLoans, myBorrowedLoans } = useLending();
  const { data: myMemberships = [] } = useMyMemberships();
  const { memberCount } = useLibraryMembership(library?.id);
  const pendingLoanRequests = myLentLoans.filter((l) => l.status === "requested").length;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editEvent, setEditEvent] = useState<import("@/hooks/useLibraryEvents").CalendarEvent | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "personal");

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    if (!tabFromUrl && activeTab !== "personal") {
      setActiveTab("personal");
    }
  }, [tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    if (value === "personal") {
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
      // Use join filtering to avoid long URL with game IDs
      const { count, error } = await supabase
        .from("game_sessions")
        .select("*, games!inner(library_id)", { count: "exact", head: true })
        .eq("games.library_id", library.id);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!library?.id,
  });
  
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
  
  // Generate proper URLs - uses subdomains in production, query params in preview
  const gamesUrl = library ? getLibraryUrl(library.slug, "/games") : null;
  const settingsUrl = library ? getLibraryUrl(library.slug, "/settings") : null;
  const libraryUrl = library ? getLibraryUrl(library.slug, "/") : null;
  const messagesUrl = library ? getLibraryUrl(library.slug, "/messages") : null;

  const activeBorrowedLoans = myBorrowedLoans.filter(l => ['requested', 'approved', 'active'].includes(l.status));
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
      <AnnouncementBanner />
      {/* Header */}
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoImage} alt="GameTaverns" className="h-10 w-auto" />
            <span className="font-display text-2xl font-bold text-cream">
              GameTaverns
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            <NotificationsDropdown variant="dashboard" />
            
            <Link 
              to="/directory"
              className="flex items-center gap-2 px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 rounded-lg text-cream transition-colors"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Browse Libraries</span>
            </Link>
            
            {library && (
              <a 
                href={libraryUrl!}
                className="flex items-center gap-2 px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 rounded-lg text-cream transition-colors"
              >
                <Library className="h-4 w-4" />
                <span className="hidden sm:inline">My Library</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            )}
            {(isAdmin || library) && (
              <Link 
                to="/docs"
                className="flex items-center gap-2 px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 rounded-lg text-cream transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Guide</span>
              </Link>
            )}
            <span className="text-cream/80 hidden sm:inline">{profile?.display_name || (user as any)?.user_metadata?.display_name || user?.email}</span>
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
      </header>
      
      <main className="container mx-auto px-4 py-12">
        <h1 className="font-display text-4xl font-bold text-cream mb-8">
          Welcome back, {profile?.display_name || (user as any)?.user_metadata?.display_name || user?.email?.split("@")[0]}
        </h1>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-8 bg-wood-dark/60 border border-wood-medium/40 flex-wrap">
            <TabsTrigger 
              value="personal" 
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <User className="h-4 w-4" />
              Personal
            </TabsTrigger>
            <TabsTrigger 
              value="community" 
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <MessageSquare className="h-4 w-4" />
              Community
            </TabsTrigger>
            <TabsTrigger 
              value="library" 
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <Library className="h-4 w-4" />
              Library
              {library && (pendingLoanRequests > 0 || unreadCount > 0) && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingLoanRequests + unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="trades" 
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Trades
            </TabsTrigger>
            <TabsTrigger 
              value="danger" 
              className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
            >
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </TabsTrigger>
          </TabsList>

          {/* ===== COMMUNITY TAB ===== */}
          <TabsContent value="community">
            <CommunityTab />
          </TabsContent>
          <TabsContent value="personal">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Admin Card - Only show for site owners */}
              {isAdmin && (
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-secondary" />
                      Platform Admin
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      Manage the GameTaverns platform
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link to="/admin">
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin Dashboard
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
              
              {/* My Communities Card */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-secondary" />
                    My Communities
                  </CardTitle>
                  <CardDescription className="text-cream/70">
                    {myMemberships.length > 0 
                      ? `You're a member of ${myMemberships.length} ${myMemberships.length === 1 ? 'community' : 'communities'}`
                      : "Join communities to borrow games and participate in events"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {myMemberships.length > 0 ? (
                    <div className="space-y-2">
                      {myMemberships.slice(0, 3).map((membership) => (
                        <a 
                          key={membership.id}
                          href={membership.library?.slug ? getLibraryUrl(membership.library.slug, "/") : "#"}
                          className="flex items-center justify-between p-2 rounded-lg bg-wood-medium/20 hover:bg-wood-medium/40 transition-colors"
                        >
                          <span className="text-sm font-medium truncate">
                            {membership.library?.name}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {membership.role === 'owner' && (
                              <Badge variant="secondary" className="text-xs">Owner</Badge>
                            )}
                            {membership.role === 'moderator' && (
                              <Badge variant="outline" className="text-xs">Mod</Badge>
                            )}
                            <ArrowRight className="h-4 w-4 text-cream/60" />
                          </div>
                        </a>
                      ))}
                      {myMemberships.length > 3 && (
                        <p className="text-xs text-cream/60 text-center pt-2">
                          +{myMemberships.length - 3} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <Link to="/directory">
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <Users className="h-4 w-4 mr-2" />
                        Browse Communities
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>

              {/* Borrowed Games Card */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-secondary" />
                    My Borrowed Games
                    {activeBorrowedLoans.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {activeBorrowedLoans.length}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-cream/70">
                    Games you're currently borrowing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activeBorrowedLoans.length > 0 ? (
                    <div className="space-y-2">
                      {activeBorrowedLoans.slice(0, 3).map((loan) => (
                        <div 
                          key={loan.id}
                          className="flex flex-col p-2 rounded-lg bg-wood-medium/20"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">
                              {loan.game?.title || "Unknown Game"}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {loan.status}
                            </Badge>
                          </div>
                          {loan.library?.name && (
                            <span className="text-xs text-cream/60 mt-1">
                              From: {loan.library.name}
                            </span>
                          )}
                        </div>
                      ))}
                      {activeBorrowedLoans.length > 3 && (
                        <p className="text-xs text-cream/60 text-center pt-2">
                          +{activeBorrowedLoans.length - 3} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 text-cream/40" />
                      <p className="text-sm text-cream/60">No active loans</p>
                      <Link to="/directory" className="mt-2 inline-block">
                        <Button variant="outline" size="sm" className="border-secondary/50">
                          Browse Libraries
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Achievements Card */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-secondary" />
                      Achievements
                    </CardTitle>
                    <Link to="/achievements">
                      <Button variant="ghost" size="sm" className="text-cream/70 hover:text-cream hover:bg-wood-medium/40 -mr-2">
                        View All
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                  <CardDescription className="text-cream/70">
                    Track your progress and unlock badges
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AchievementsDisplay compact />
                </CardContent>
              </Card>

              {/* My Inquiries Section - Full Width */}
              <div className="lg:col-span-3">
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardContent className="pt-6">
                    <MyInquiriesSection />
                  </CardContent>
                </Card>
              </div>

              {/* Account Settings Card - Full Width */}
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream lg:col-span-3">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-secondary" />
                    Account Settings
                  </CardTitle>
                  <CardDescription className="text-cream/70">
                    Manage your profile and login credentials
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <AccountSettings />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== LIBRARY TAB ===== */}
          <TabsContent value="library">
            {library ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Library Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Library className="h-5 w-5 text-secondary" />
                      My Library
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      {library.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end">
                    <div className="space-y-3">
                      <div className="text-sm text-cream/60">
                        <span className="font-medium text-cream">URL:</span>{" "}
                        {library.slug}.gametaverns.com
                      </div>
                      <a href={libraryUrl!} className="block">
                        <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Library
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Manage Games Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gamepad2 className="h-5 w-5 text-secondary" />
                      Manage Games
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      Import, add, and organize your collection
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end">
                    <a href={gamesUrl!}>
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <Upload className="h-4 w-4 mr-2" />
                        Import & Manage
                      </Button>
                    </a>
                  </CardContent>
                </Card>
                
                {/* Library Settings Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5 text-secondary" />
                      Library Settings
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      Theme, branding, and site configuration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end">
                    <a href={settingsUrl!}>
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <Settings className="h-4 w-4 mr-2" />
                        Customize Library
                      </Button>
                    </a>
                  </CardContent>
                </Card>
                
                {/* Messages Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-secondary" />
                      Messages
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-auto">
                          {unreadCount} new
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      View inquiries about games for sale
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end">
                    <a href={messagesUrl!}>
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <Mail className="h-4 w-4 mr-2" />
                        View Messages
                        {unreadCount > 0 && (
                          <Badge variant="outline" className="ml-2 bg-cream/20">
                            {unreadCount}
                          </Badge>
                        )}
                      </Button>
                    </a>
                  </CardContent>
                </Card>
                
                {/* Ratings & Wishlist Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-secondary" />
                      Ratings & Wishlist
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      View user ratings and wishlist requests
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end space-y-2">
                    <a href={getLibraryUrl(library.slug, "/settings?tab=ratings")}>
                      <Button variant="outline" className="w-full border-secondary/50 text-cream hover:bg-wood-medium/50">
                        <Star className="h-4 w-4 mr-2" />
                        View Ratings
                      </Button>
                    </a>
                    <a href={getLibraryUrl(library.slug, "/settings?tab=wishlist")}>
                      <Button variant="outline" className="w-full border-secondary/50 text-cream hover:bg-wood-medium/50">
                        <Heart className="h-4 w-4 mr-2" />
                        View Wishlist
                      </Button>
                    </a>
                  </CardContent>
                </Card>
                
                {/* Stats Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-secondary" />
                      Library Stats
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      Your collection at a glance
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-wood-medium/20 rounded-lg">
                        <div className="text-2xl font-bold text-secondary">
                          {gameCount ?? "--"}
                        </div>
                        <div className="text-xs text-cream/60">Games</div>
                      </div>
                      <div className="text-center p-3 bg-wood-medium/20 rounded-lg">
                        <div className="text-2xl font-bold text-secondary">
                          {playCount ?? "--"}
                        </div>
                        <div className="text-xs text-cream/60">Plays</div>
                      </div>
                      <div className="text-center p-3 bg-wood-medium/20 rounded-lg">
                        <div className="text-2xl font-bold text-secondary">
                          {memberCount ?? 0}
                        </div>
                        <div className="text-xs text-cream/60">Members</div>
                      </div>
                    </div>
                    <a href={getLibraryUrl(library.slug, "/stats")}>
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Monthly Play Stats
                      </Button>
                    </a>
                  </CardContent>
                </Card>

                {/* Lending Dashboard */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream lg:col-span-3">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-secondary" />
                      Game Lending
                      {pendingLoanRequests > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {pendingLoanRequests} pending
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      Manage loan requests and track borrowed games
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <LendingDashboard />
                  </CardContent>
                </Card>


                {/* Group Challenges - Self-hosted feature */}
                {isSelfHostedSupabaseStack() && (
                  <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream lg:col-span-3">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-secondary" />
                        Group Challenges
                      </CardTitle>
                      <CardDescription className="text-cream/70">
                        Create play goals, game challenges, and competitive leaderboards
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChallengesManager libraryId={library.id} canManage={true} />
                    </CardContent>
                  </Card>
                )}

                {/* Show additional libraries */}
                {myLibraries.length > 1 && (
                  <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream lg:col-span-3">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Library className="h-5 w-5 text-secondary" />
                        My Other Libraries
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {myLibraries
                          .filter((l) => l.id !== library?.id)
                          .map((lib) => (
                            <a
                              key={lib.id}
                              href={getLibraryUrl(lib.slug, "/")}
                              className="flex items-center justify-between p-3 rounded-lg bg-wood-medium/20 hover:bg-wood-medium/40 transition-colors"
                            >
                              <div>
                                <div className="font-medium text-sm">{lib.name}</div>
                                <div className="text-xs text-cream/60">{lib.slug}.gametaverns.com</div>
                              </div>
                              <ArrowRight className="h-4 w-4 text-cream/60 flex-shrink-0" />
                            </a>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Create another library if under limit */}
                {myLibraries.length < maxLibraries && (
                  <Card className="bg-wood-medium/30 border-wood-medium/50 border-dashed text-cream">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-secondary" />
                        Create Another Library
                      </CardTitle>
                      <CardDescription className="text-cream/70">
                        You can create up to {maxLibraries} {maxLibraries === 1 ? 'library' : 'libraries'} ({myLibraries.length} used)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link to="/create-library">
                        <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Library
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}

              </div>
            ) : (
              /* Non-owner: Show Create Library prompt */
              <Card className="bg-wood-medium/30 border-wood-medium/50 border-dashed text-cream">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Library className="h-5 w-5 text-secondary" />
                    Create Your Own Library
                  </CardTitle>
                  <CardDescription className="text-cream/70">
                    Start your own board game library to share with your community
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/create-library">
                    <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Library
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== ANALYTICS TAB ===== */}
          <TabsContent value="analytics">
            {(isAdmin || library) ? (
              <AnalyticsTab isAdmin={isAdmin} libraryId={library?.id || null} />
            ) : (
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardContent className="py-12 text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-cream/40" />
                  <h3 className="text-lg font-medium mb-2">Analytics</h3>
                  <p className="text-cream/60">
                    Create a library to see analytics about your collection.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== TRADES TAB ===== */}
          <TabsContent value="trades">
            {isSelfHostedSupabaseStack() ? (
              <TradeCenter />
            ) : (
              <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                <CardContent className="py-12 text-center">
                  <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 text-cream/40" />
                  <h3 className="text-lg font-medium mb-2">Cross-Library Trading</h3>
                  <p className="text-cream/60">
                    This feature is only available on self-hosted deployments.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== DANGER ZONE TAB ===== */}
          <TabsContent value="danger">
            <Card className="bg-wood-medium/30 border-wood-medium/50 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-cream flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-cream/70">
                  Irreversible and destructive actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DangerZone />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ===== PERSISTENT EVENTS & POLLS SECTION (outside tabs) ===== */}
        {library && (
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {/* Upcoming Events */}
            <UpcomingEventsWidget 
              libraryId={library.id} 
              isOwner={true}
              onCreateEvent={() => setShowCreateEvent(true)}
              onEditEvent={(event) => setEditEvent(event)}
            />

            {/* Game Polls */}
            <Card className="bg-wood-medium/30 border-wood-medium/50">
              <CardHeader>
                <CardTitle className="text-cream flex items-center gap-2">
                  <Vote className="h-5 w-5 text-secondary" />
                  Game Polls
                </CardTitle>
                <CardDescription className="text-cream/70">
                  Create and manage game night polls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PollsManager libraryId={library.id} />
              </CardContent>
            </Card>

            {/* Random Game Picker */}
            <RandomGamePicker libraryId={library.id} librarySlug={library.slug} />
            
            {/* Create/Edit Event Dialog */}
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
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}
