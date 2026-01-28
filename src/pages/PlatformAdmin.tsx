import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Database, Settings, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { UserManagement } from "@/components/admin/UserManagement";
import { LibraryManagement } from "@/components/admin/LibraryManagement";
import { PlatformSettings } from "@/components/admin/PlatformSettings";
import { PlatformAnalytics } from "@/components/admin/PlatformAnalytics";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";

export default function PlatformAdmin() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("analytics");
  
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
    // Wait for auth to load before redirecting
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, authLoading, navigate]);
  
  useEffect(() => {
    // Wait for both auth and role to load before redirecting non-admins
    if (!authLoading && !roleLoading && !isSiteOwner && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isSiteOwner, roleLoading, authLoading, isAuthenticated, navigate]);
  
  if (authLoading || roleLoading) {
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
      <AnnouncementBanner />
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
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-wood-medium/30 border border-wood-medium/50">
            <TabsTrigger 
              value="analytics" 
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <Activity className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="libraries"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <Database className="h-4 w-4 mr-2" />
              Libraries
            </TabsTrigger>
            <TabsTrigger 
              value="settings"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="analytics" className="mt-6">
            <PlatformAnalytics />
          </TabsContent>
          
          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>
          
          <TabsContent value="libraries" className="mt-6">
            <LibraryManagement />
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <PlatformSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
