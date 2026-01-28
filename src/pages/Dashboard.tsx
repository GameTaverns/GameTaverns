import { useEffect } from "react";
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
  ArrowRight
} from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useUserProfile } from "@/hooks/useLibrary";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DangerZone } from "@/components/settings/DangerZone";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";

export default function Dashboard() {
  const { user, signOut, isAuthenticated } = useAuth();
  const { data: library, isLoading: libraryLoading } = useMyLibrary();
  const { data: profile } = useUserProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  
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
                {library ? library.name : "You haven't created a library yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {libraryLoading ? (
                <div className="animate-pulse h-10 bg-wood-medium/30 rounded"></div>
              ) : library ? (
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
              ) : (
                <Link to="/create-library">
                  <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Library
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
          
          {/* Manage Games Card */}
          {library && (
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
          )}
          
          {/* Library Settings Card */}
          {library && (
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
          )}
          
          {/* Messages Card */}
          {library && (
            <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-secondary" />
                  Messages
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
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}
          
          {/* Ratings & Wishlist Card */}
          {library && (
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
          )}
          
          {/* Stats Card */}
          {library && (
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
          )}
        </div>
        
        {/* Danger Zone Section */}
        <div className="mt-12">
          <DangerZone />
        </div>
      </main>
    </div>
  );
}