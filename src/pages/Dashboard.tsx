import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dices, ExternalLink, Settings, LogOut, Plus, Library, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useUserProfile } from "@/hooks/useLibrary";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);
  
  if (!isAuthenticated) {
    return null;
  }
  
  const libraryUrl = library ? `/?tenant=${library.slug}` : null;
  const settingsUrl = library ? `/?tenant=${library.slug}&path=/settings` : null;
  const gamesUrl = library ? `/?tenant=${library.slug}&path=/games` : null;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium">
      {/* Header */}
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Dices className="h-8 w-8 text-secondary" />
            <span className="font-display text-2xl font-bold text-cream">
              GameTaverns
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="text-cream/80">{profile?.display_name || user?.email}</span>
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
                  <div className="flex gap-2">
                    <a href={libraryUrl!} className="flex-1">
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Library
                      </Button>
                    </a>
                    <a href={settingsUrl!}>
                      <Button variant="outline" className="border-secondary/50 text-cream hover:bg-wood-medium/50">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
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
                    <div className="text-2xl font-bold text-secondary">--</div>
                    <div className="text-xs text-cream/60">Games</div>
                  </div>
                  <div className="text-center p-3 bg-wood-medium/20 rounded-lg">
                    <div className="text-2xl font-bold text-secondary">--</div>
                    <div className="text-xs text-cream/60">Plays</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Quick Actions */}
          <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {library && (
                <>
                  <a href={libraryUrl!} className="block">
                    <Button variant="ghost" className="w-full justify-start text-cream hover:text-white hover:bg-wood-medium/50">
                      Browse Collection
                    </Button>
                  </a>
                  <a href={gamesUrl!} className="block">
                    <Button variant="ghost" className="w-full justify-start text-cream hover:text-white hover:bg-wood-medium/50">
                      Manage Games
                    </Button>
                  </a>
                  <a href={settingsUrl!} className="block">
                    <Button variant="ghost" className="w-full justify-start text-cream hover:text-white hover:bg-wood-medium/50">
                      Library Settings
                    </Button>
                  </a>
                </>
              )}
              <Link to="/docs" className="block">
                <Button variant="ghost" className="w-full justify-start text-cream hover:text-white hover:bg-wood-medium/50">
                  Documentation
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
