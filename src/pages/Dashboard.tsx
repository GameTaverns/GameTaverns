import { Link, useNavigate } from "react-router-dom";
import { Gamepad2, ExternalLink, Settings, LogOut, Plus, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useUserProfile } from "@/hooks/useLibrary";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user, signOut, isAuthenticated } = useAuth();
  const { data: library, isLoading: libraryLoading } = useMyLibrary();
  const { data: profile } = useUserProfile();
  const navigate = useNavigate();
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
      navigate("/");
    }
  };
  
  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }
  
  const libraryUrl = library ? `/?tenant=${library.slug}` : null;
  const settingsUrl = library ? `/?tenant=${library.slug}&path=/settings` : null;
  const gamesUrl = library ? `/?tenant=${library.slug}&path=/admin/games` : null;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900">
      {/* Header */}
      <header className="border-b border-amber-700/50 bg-amber-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Gamepad2 className="h-8 w-8 text-amber-400" />
            <span className="font-display text-2xl font-bold text-amber-100">
              GameTaverns
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="text-amber-200/80">{profile?.display_name || user?.email}</span>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleSignOut}
              className="text-amber-200 hover:text-amber-100 hover:bg-amber-800/50"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-12">
        <h1 className="font-display text-4xl font-bold text-amber-100 mb-8">
          Welcome back, {profile?.display_name || user?.email?.split("@")[0]}
        </h1>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Library Card */}
          <Card className="bg-amber-800/30 border-amber-700/50 text-amber-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Library className="h-5 w-5 text-amber-400" />
                My Library
              </CardTitle>
              <CardDescription className="text-amber-200/70">
                {library ? library.name : "You haven't created a library yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {libraryLoading ? (
                <div className="animate-pulse h-10 bg-amber-700/30 rounded"></div>
              ) : library ? (
                <div className="space-y-3">
                  <div className="text-sm text-amber-200/60">
                    <span className="font-medium text-amber-200">URL:</span>{" "}
                    {library.slug}.gametaverns.com
                  </div>
                  <div className="flex gap-2">
                    <Link to={libraryUrl!} className="flex-1">
                      <Button className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Library
                      </Button>
                    </Link>
                    <Link to={settingsUrl!}>
                      <Button variant="outline" className="border-amber-500/50 text-amber-200 hover:bg-amber-800/50">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <Link to="/create-library">
                  <Button className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Library
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
          
          {/* Stats Card */}
          {library && (
            <Card className="bg-amber-800/30 border-amber-700/50 text-amber-100">
              <CardHeader>
                <CardTitle>Library Stats</CardTitle>
                <CardDescription className="text-amber-200/70">
                  Your collection at a glance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-amber-700/20 rounded-lg">
                    <div className="text-2xl font-bold text-amber-400">--</div>
                    <div className="text-xs text-amber-200/60">Games</div>
                  </div>
                  <div className="text-center p-3 bg-amber-700/20 rounded-lg">
                    <div className="text-2xl font-bold text-amber-400">--</div>
                    <div className="text-xs text-amber-200/60">Plays</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Quick Actions */}
          <Card className="bg-amber-800/30 border-amber-700/50 text-amber-100">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {library && (
                <>
                  <Link to={libraryUrl!} className="block">
                    <Button variant="ghost" className="w-full justify-start text-amber-200 hover:text-amber-100 hover:bg-amber-800/50">
                      Browse Collection
                    </Button>
                  </Link>
                  <Link to={gamesUrl!} className="block">
                    <Button variant="ghost" className="w-full justify-start text-amber-200 hover:text-amber-100 hover:bg-amber-800/50">
                      Manage Games
                    </Button>
                  </Link>
                  <Link to={settingsUrl!} className="block">
                    <Button variant="ghost" className="w-full justify-start text-amber-200 hover:text-amber-100 hover:bg-amber-800/50">
                      Library Settings
                    </Button>
                  </Link>
                </>
              )}
              <Link to="/docs" className="block">
                <Button variant="ghost" className="w-full justify-start text-amber-200 hover:text-amber-100 hover:bg-amber-800/50">
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
