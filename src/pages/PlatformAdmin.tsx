import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Database, Settings, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function PlatformAdmin() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  // Check if user is a site owner (has admin role)
  const { data: isSiteOwner, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      return !!data;
    },
    enabled: !!user?.id,
  });
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);
  
  useEffect(() => {
    if (!roleLoading && !isSiteOwner && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isSiteOwner, roleLoading, isAuthenticated, navigate]);
  
  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }
  
  if (!isSiteOwner) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium">
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-secondary" />
            <span className="font-display text-2xl font-bold text-cream">
              Platform Admin
            </span>
          </div>
          <Button 
            variant="ghost" 
            className="text-cream hover:text-white hover:bg-wood-medium/50"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-cream mb-2">
            Site Administration
          </h1>
          <p className="text-cream/70">
            Manage the GameTaverns platform, users, and global settings.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-wood-medium/30 border-wood-medium/50">
            <CardHeader>
              <CardTitle className="text-cream flex items-center gap-2">
                <Users className="h-5 w-5 text-secondary" />
                User Management
              </CardTitle>
              <CardDescription className="text-cream/70">
                View and manage all platform users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                Manage Users
              </Button>
            </CardContent>
          </Card>
          
          <Card className="bg-wood-medium/30 border-wood-medium/50">
            <CardHeader>
              <CardTitle className="text-cream flex items-center gap-2">
                <Database className="h-5 w-5 text-secondary" />
                Libraries
              </CardTitle>
              <CardDescription className="text-cream/70">
                View and moderate all libraries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                View Libraries
              </Button>
            </CardContent>
          </Card>
          
          <Card className="bg-wood-medium/30 border-wood-medium/50">
            <CardHeader>
              <CardTitle className="text-cream flex items-center gap-2">
                <Settings className="h-5 w-5 text-secondary" />
                Platform Settings
              </CardTitle>
              <CardDescription className="text-cream/70">
                Configure global platform settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                Settings
              </Button>
            </CardContent>
          </Card>
          
          <Card className="bg-wood-medium/30 border-wood-medium/50">
            <CardHeader>
              <CardTitle className="text-cream flex items-center gap-2">
                <Activity className="h-5 w-5 text-secondary" />
                Analytics
              </CardTitle>
              <CardDescription className="text-cream/70">
                Platform usage and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                View Analytics
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
