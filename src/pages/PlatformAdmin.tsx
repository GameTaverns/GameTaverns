import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shield, Users, Database, Settings, Activity, MessageCircle, Trophy, HeartPulse, Crown, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { UserManagement } from "@/components/admin/UserManagement";
import { LibraryManagement } from "@/components/admin/LibraryManagement";
import { PlatformSettings } from "@/components/admin/PlatformSettings";
import { PlatformAnalytics } from "@/components/admin/PlatformAnalytics";
import { FeedbackManagement } from "@/components/admin/FeedbackManagement";
import { ClubsManagement } from "@/components/admin/ClubsManagement";
import { SystemHealth } from "@/components/admin/SystemHealth";
import { PremiumRoadmap } from "@/components/admin/PremiumRoadmap";
import { SpecialBadgesManagement } from "@/components/admin/SpecialBadgesManagement";
import { ServerManagement } from "@/components/admin/ServerManagement";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { Badge } from "@/components/ui/badge";
import { useUnreadFeedbackCount } from "@/hooks/usePlatformFeedback";
import { usePendingClubs } from "@/hooks/useClubs";

export default function PlatformAdmin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, loading: authLoading, isAdmin, roleLoading } = useAuth();
  
  // Get initial tab from URL param
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "analytics");
  const { data: unreadFeedbackCount } = useUnreadFeedbackCount();
  const { data: pendingClubs } = usePendingClubs();
  
  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    if (value === "analytics") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", value);
    }
    setSearchParams(newParams, { replace: true });
  };
  
  // Debug logging for admin access issues
  useEffect(() => {
    console.log('[PlatformAdmin] Auth state:', { 
      authLoading, 
      roleLoading, 
      isAuthenticated, 
      isAdmin, 
      userId: user?.id 
    });
  }, [authLoading, roleLoading, isAuthenticated, isAdmin, user?.id]);
  
  useEffect(() => {
    // Wait for auth to load before redirecting
    if (!authLoading && !isAuthenticated) {
      console.log('[PlatformAdmin] Not authenticated, redirecting to login');
      navigate("/login");
    }
  }, [isAuthenticated, authLoading, navigate]);
  
  useEffect(() => {
    // Wait for both auth and role to load before redirecting non-admins
    if (!authLoading && !roleLoading && !isAdmin && isAuthenticated) {
      console.log('[PlatformAdmin] Not admin, redirecting to dashboard');
      navigate("/dashboard");
    }
  }, [isAdmin, roleLoading, authLoading, isAuthenticated, navigate]);
  
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-background">
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
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-cream mb-2">
            Site Administration
          </h1>
          <p className="text-cream/70">
            Manage the GameTaverns platform, users, and global settings.
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-wood-medium/30 border border-wood-medium/50 h-auto flex-wrap gap-1 p-1 w-full overflow-x-auto">
            <TabsTrigger 
              value="analytics" 
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <Activity className="h-4 w-4 mr-1 sm:mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <Users className="h-4 w-4 mr-1 sm:mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="libraries"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <Database className="h-4 w-4 mr-1 sm:mr-2" />
              Libraries
            </TabsTrigger>
            <TabsTrigger 
              value="settings"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <Settings className="h-4 w-4 mr-1 sm:mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger 
              value="feedback"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground relative text-xs sm:text-sm"
            >
              <MessageCircle className="h-4 w-4 mr-1 sm:mr-2" />
              Feedback
              {unreadFeedbackCount && unreadFeedbackCount > 0 && (
                <Badge className="ml-1 h-5 min-w-[20px] px-1 bg-destructive text-destructive-foreground">
                  {unreadFeedbackCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="clubs"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground relative text-xs sm:text-sm"
            >
              <Trophy className="h-4 w-4 mr-1 sm:mr-2" />
              Clubs
              {pendingClubs && pendingClubs.length > 0 && (
                <Badge className="ml-1 h-5 min-w-[20px] px-1 bg-destructive text-destructive-foreground">
                  {pendingClubs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="health"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <HeartPulse className="h-4 w-4 mr-1 sm:mr-2" />
              Health
            </TabsTrigger>
            <TabsTrigger 
              value="premium"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <Crown className="h-4 w-4 mr-1 sm:mr-2" />
              Premium
            </TabsTrigger>
            <TabsTrigger 
              value="server"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <Shield className="h-4 w-4 mr-1 sm:mr-2" />
              Server
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="analytics" className="mt-6">
            <PlatformAnalytics />
          </TabsContent>
          
          <TabsContent value="users" className="mt-6">
            <Tabs defaultValue="list" className="space-y-4">
              <TabsList className="bg-wood-medium/20 border border-wood-medium/30 h-auto">
                <TabsTrigger value="list" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="badges" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm">
                  <BadgeCheck className="h-3.5 w-3.5 mr-1.5" />
                  Special Badges
                </TabsTrigger>
              </TabsList>
              <TabsContent value="list">
                <UserManagement />
              </TabsContent>
              <TabsContent value="badges">
                <SpecialBadgesManagement />
              </TabsContent>
            </Tabs>
          </TabsContent>
          
          <TabsContent value="libraries" className="mt-6">
            <LibraryManagement />
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <PlatformSettings />
          </TabsContent>
          
          <TabsContent value="feedback" className="mt-6">
            <FeedbackManagement />
          </TabsContent>
          
          <TabsContent value="clubs" className="mt-6">
            <ClubsManagement />
          </TabsContent>
          
          <TabsContent value="health" className="mt-6">
            <SystemHealth />
          </TabsContent>
          
          <TabsContent value="premium" className="mt-6">
            <PremiumRoadmap />
          </TabsContent>

          <TabsContent value="server" className="mt-6">
            <ServerManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
