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
      <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900 flex items-center justify-center">
        <div className="animate-pulse text-amber-200">Loading...</div>
      </div>
    );
  }
  
  if (!isSiteOwner) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900">
      <header className="border-b border-amber-700/50 bg-amber-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-amber-400" />
            <span className="font-display text-2xl font-bold text-amber-100">
              Platform Admin
            </span>
          </div>
          <Button 
            variant="ghost" 
            className="text-amber-200 hover:text-amber-100 hover:bg-amber-800/50"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-amber-100 mb-2">
            Site Administration
          </h1>
          <p className="text-amber-200/70">
            Manage the GameTaverns platform, users, and global settings.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-amber-800/30 border-amber-700/50">
            <CardHeader>
              <CardTitle className="text-amber-100 flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-400" />
                User Management
              </CardTitle>
              <CardDescription className="text-amber-200/70">
                View and manage all platform users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400">
                Manage Users
              </Button>
            </CardContent>
          </Card>
          
          <Card className="bg-amber-800/30 border-amber-700/50">
            <CardHeader>
              <CardTitle className="text-amber-100 flex items-center gap-2">
                <Database className="h-5 w-5 text-amber-400" />
                Libraries
              </CardTitle>
              <CardDescription className="text-amber-200/70">
                View and moderate all libraries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400">
                View Libraries
              </Button>
            </CardContent>
          </Card>
          
          <Card className="bg-amber-800/30 border-amber-700/50">
            <CardHeader>
              <CardTitle className="text-amber-100 flex items-center gap-2">
                <Settings className="h-5 w-5 text-amber-400" />
                Platform Settings
              </CardTitle>
              <CardDescription className="text-amber-200/70">
                Configure global platform settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400">
                Settings
              </Button>
            </CardContent>
          </Card>
          
          <Card className="bg-amber-800/30 border-amber-700/50">
            <CardHeader>
              <CardTitle className="text-amber-100 flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-400" />
                Analytics
              </CardTitle>
              <CardDescription className="text-amber-200/70">
                Platform usage and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400">
                View Analytics
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
