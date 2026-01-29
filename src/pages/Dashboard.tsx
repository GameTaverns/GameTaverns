import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Trophy
} from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useUserProfile } from "@/hooks/useLibrary";
import { useUnreadMessageCount } from "@/hooks/useMessages";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DangerZone } from "@/components/settings/DangerZone";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { LibraryAnalyticsDashboard } from "@/components/analytics/LibraryAnalyticsDashboard";
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
import { Users } from "lucide-react";

export default function Dashboard() {
  const { user, signOut, isAuthenticated } = useAuth();
  const { data: library, isLoading: libraryLoading } = useMyLibrary();
  const { data: profile } = useUserProfile();
  const { data: unreadCount = 0 } = useUnreadMessageCount(library?.id);
  const { myLentLoans, myBorrowedLoans } = useLending();
  const { data: myMemberships = [] } = useMyMemberships();
  const pendingLoanRequests = myLentLoans.filter((l) => l.status === "requested").length;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editEvent, setEditEvent] = useState<import("@/hooks/useLibraryEvents").CalendarEvent | null>(null);
  // Check if user is a site owner (has admin role)
  const { data: isSiteOwner } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });
  
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
      // Get all game IDs for this library first
      const { data: games } = await supabase
        .from("games")
        .select("id")
        .eq("library_id", library.id);
      
      if (!games || games.length === 0) return 0;
      
      const gameIds = games.map(g => g.id);
      const { count, error } = await supabase
        .from("game_sessions")
        .select("*", { count: "exact", head: true })
        .in("game_id", gameIds);
      
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
  
  const { loading } = useAuth();
  
  useEffect(() => {
    // Only redirect after loading completes
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);
  
  // Show loader while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  const gamesUrl = library ? `/?tenant=${library.slug}&path=/games` : null;
  const settingsUrl = library ? `/?tenant=${library.slug}&path=/settings` : null;
  const libraryUrl = library ? `/?tenant=${library.slug}` : null;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium">
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
            {/* Notifications */}
            <NotificationsDropdown variant="dashboard" />
            
            {/* Quick link to library */}
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
            <span className="text-cream/80 hidden sm:inline">{profile?.display_name || user?.email}</span>
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
          Welcome back, {profile?.display_name || user?.email?.split("@")[0]}
        </h1>
        
        {library ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-8 bg-wood-medium/30 flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="lending" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Lending
                {pendingLoanRequests > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {pendingLoanRequests}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="achievements" className="gap-2">
                <Trophy className="h-4 w-4" />
                Achievements
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="polls" className="gap-2">
                <Vote className="h-4 w-4" />
                Game Polls
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-2">
                <User className="h-4 w-4" />
                Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Admin Card - Only show for site owners */}
                {isSiteOwner && (
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
                
                {/* Library Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Library className="h-5 w-5 text-secondary" />
                      My Library
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      {library.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-cream/60">
                        <span className="font-medium text-cream">URL:</span>{" "}
                        {library.slug}.tavern.tzolak.com
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
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gamepad2 className="h-5 w-5 text-secondary" />
                      Manage Games
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      Import, add, and organize your collection
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a href={gamesUrl!}>
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <Upload className="h-4 w-4 mr-2" />
                        Import & Manage
                      </Button>
                    </a>
                  </CardContent>
                </Card>
                
                {/* Library Settings Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5 text-secondary" />
                      Library Settings
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      Theme, branding, and site configuration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a href={settingsUrl!}>
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <Settings className="h-4 w-4 mr-2" />
                        Customize Library
                      </Button>
                    </a>
                  </CardContent>
                </Card>
                
                {/* Messages Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
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
                  <CardContent>
                    <a href={`/?tenant=${library.slug}&path=/messages`}>
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
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-secondary" />
                      Ratings & Wishlist
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      View user ratings and wishlist requests
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <a href={`/?tenant=${library.slug}&path=/settings&tab=ratings`}>
                      <Button variant="outline" className="w-full border-secondary/50 text-cream hover:bg-wood-medium/50">
                        <Star className="h-4 w-4 mr-2" />
                        View Ratings
                      </Button>
                    </a>
                    <a href={`/?tenant=${library.slug}&path=/settings&tab=wishlist`}>
                      <Button variant="outline" className="w-full border-secondary/50 text-cream hover:bg-wood-medium/50">
                        <Heart className="h-4 w-4 mr-2" />
                        View Wishlist
                      </Button>
                    </a>
                  </CardContent>
                </Card>
                
                {/* Stats Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardHeader>
                    <CardTitle>Library Stats</CardTitle>
                    <CardDescription className="text-cream/70">
                      Your collection at a glance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                  </CardContent>
                </Card>

                {/* My Communities Card - shows other communities user is member of */}
                {myMemberships.length > 0 && (
                  <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-secondary" />
                        My Communities
                      </CardTitle>
                      <CardDescription className="text-cream/70">
                        Other communities you've joined
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {myMemberships.slice(0, 3).map((membership) => (
                          <a 
                            key={membership.id}
                            href={`/?tenant=${membership.library?.slug}`}
                            className="flex items-center justify-between p-2 rounded-lg bg-wood-medium/20 hover:bg-wood-medium/40 transition-colors"
                          >
                            <span className="text-sm font-medium truncate">
                              {membership.library?.name}
                            </span>
                            <ArrowRight className="h-4 w-4 text-cream/60 flex-shrink-0" />
                          </a>
                        ))}
                        {myMemberships.length > 3 && (
                          <p className="text-xs text-cream/60 text-center pt-2">
                            +{myMemberships.length - 3} more
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Upcoming Events Widget */}
                <div className="col-span-full lg:col-span-2">
                  <UpcomingEventsWidget 
                    libraryId={library.id} 
                    isOwner={true}
                    onCreateEvent={() => setShowCreateEvent(true)}
                    onEditEvent={(event) => setEditEvent(event)}
                  />
                </div>
              </div>
              
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
            </TabsContent>

            <TabsContent value="lending">
              <Card className="bg-wood-medium/30 border-wood-medium/50">
                <CardHeader>
                  <CardTitle className="text-cream flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-secondary" />
                    Game Lending
                  </CardTitle>
                  <CardDescription className="text-cream/70">
                    Manage loan requests and track borrowed games
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LendingDashboard />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="achievements">
              <Card className="bg-wood-medium/30 border-wood-medium/50">
                <CardHeader>
                  <CardTitle className="text-cream flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-secondary" />
                    Your Achievements
                  </CardTitle>
                  <CardDescription className="text-cream/70">
                    Track your progress and unlock badges
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AchievementsDisplay />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <Card className="bg-wood-medium/30 border-wood-medium/50">
                <CardHeader>
                  <CardTitle className="text-cream flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-secondary" />
                    Library Analytics
                  </CardTitle>
                  <CardDescription className="text-cream/70">
                    Insights into your collection's activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LibraryAnalyticsDashboard libraryId={library.id} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="polls">
              <Card className="bg-wood-medium/30 border-wood-medium/50">
                <CardContent className="pt-6">
                  <PollsManager libraryId={library.id} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account">
              <Card className="bg-wood-medium/30 border-wood-medium/50">
                <CardHeader>
                  <CardTitle className="text-cream flex items-center gap-2">
                    <User className="h-5 w-5 text-secondary" />
                    Account Settings
                  </CardTitle>
                  <CardDescription className="text-cream/70">
                    Manage your profile and login credentials
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AccountSettings />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-8 bg-wood-medium/30">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="achievements" className="gap-2">
                <Trophy className="h-4 w-4" />
                Achievements
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-2">
                <User className="h-4 w-4" />
                Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Admin Card - Only show for site owners */}
                {isSiteOwner && (
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
                
                {/* Create Library Card */}
                <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Library className="h-5 w-5 text-secondary" />
                      My Library
                    </CardTitle>
                    <CardDescription className="text-cream/70">
                      You haven't created a library yet
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link to="/create-library">
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Library
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

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
                            href={`/?tenant=${membership.library?.slug}`}
                            className="flex items-center justify-between p-2 rounded-lg bg-wood-medium/20 hover:bg-wood-medium/40 transition-colors"
                          >
                            <span className="text-sm font-medium truncate">
                              {membership.library?.name}
                            </span>
                            <ArrowRight className="h-4 w-4 text-cream/60 flex-shrink-0" />
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

                {/* Active Loans Card - if user has borrowed games */}
                {myBorrowedLoans.length > 0 && (
                  <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-secondary" />
                        My Borrowed Games
                      </CardTitle>
                      <CardDescription className="text-cream/70">
                        {myBorrowedLoans.filter(l => ['requested', 'approved', 'active'].includes(l.status)).length} active loans
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {myBorrowedLoans
                          .filter(l => ['requested', 'approved', 'active'].includes(l.status))
                          .slice(0, 3)
                          .map((loan) => (
                            <div 
                              key={loan.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-wood-medium/20"
                            >
                              <span className="text-sm font-medium truncate">
                                {loan.game?.title || "Unknown Game"}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {loan.status}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="achievements">
              <Card className="bg-wood-medium/30 border-wood-medium/50">
                <CardHeader>
                  <CardTitle className="text-cream flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-secondary" />
                    Your Achievements
                  </CardTitle>
                  <CardDescription className="text-cream/70">
                    Track your progress and unlock badges
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AchievementsDisplay />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account">
              <Card className="bg-wood-medium/30 border-wood-medium/50">
                <CardHeader>
                  <CardTitle className="text-cream flex items-center gap-2">
                    <User className="h-5 w-5 text-secondary" />
                    Account Settings
                  </CardTitle>
                  <CardDescription className="text-cream/70">
                    Manage your profile and login credentials
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AccountSettings />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
        
        {/* Danger Zone Section */}
        <div className="mt-12">
          <DangerZone />
        </div>
      </main>
    </div>
  );
}