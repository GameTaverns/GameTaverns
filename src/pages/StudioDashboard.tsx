import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, LogOut } from "lucide-react";
import logoImage from "@/assets/logo.png";
import { supabase } from "@/integrations/backend/client";

export default function StudioDashboard() {
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();

  const ALLOWED_DOMAIN = "gametaverns.com";

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/studio/login", { replace: true });
    } else if (!loading && isAuthenticated && user?.email) {
      const domain = user.email.split("@")[1]?.toLowerCase();
      if (domain !== ALLOWED_DOMAIN) {
        navigate("/studio/login", { replace: true });
      }
    }
  }, [isAuthenticated, loading, navigate, user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/studio/login", { replace: true });
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="GameTaverns" className="h-8 w-auto" />
            <div>
              <span className="font-display text-lg font-bold text-foreground">GameTaverns</span>
              <span className="ml-2 text-xs font-medium text-secondary inline-flex items-center gap-1">
                <Shield className="h-3 w-3" /> Studio
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-6">Studio Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-card/80 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-display">Welcome</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                This is the GameTaverns Studio — your internal workspace for managing the platform.
                More tools and features will be added here over time.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
