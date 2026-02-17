import { Link } from "react-router-dom";
import { ArrowLeft, Activity, Users, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getPlatformUrl } from "@/hooks/useTenantUrl";
import { useFollowingFeed, usePlatformFeed } from "@/hooks/useActivityFeed";
import { ActivityFeedItem } from "@/components/social/ActivityFeedItem";
import { supabase } from "@/integrations/backend/client";
import { useEffect, useState } from "react";
import logoImage from "@/assets/logo.png";

export default function ActivityFeed() {
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id);
    });
  }, []);

  const { data: followingEvents, isLoading: followingLoading } = useFollowingFeed(currentUserId);
  const { data: platformEvents, isLoading: platformLoading } = usePlatformFeed();

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoImage} alt="GameTaverns" className="h-10 w-auto" />
            <span className="font-display text-2xl font-bold text-cream">GameTaverns</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <a href={getPlatformUrl("/dashboard")}>
              <Button variant="outline" className="gap-2 border-wood-medium/50 text-cream hover:bg-wood-medium/30">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Activity Feed</h1>
        </div>

        <Tabs defaultValue={currentUserId ? "following" : "platform"}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="following" className="flex-1 gap-2" disabled={!currentUserId}>
              <Users className="h-4 w-4" />
              Following
            </TabsTrigger>
            <TabsTrigger value="platform" className="flex-1 gap-2">
              <Globe className="h-4 w-4" />
              Platform
            </TabsTrigger>
          </TabsList>

          <TabsContent value="following">
            <Card className="bg-card/90 backdrop-blur-sm border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">From People You Follow</CardTitle>
              </CardHeader>
              <CardContent>
                {followingLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Loading feed...</p>
                ) : !followingEvents || followingEvents.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No activity yet. Follow some users to see their updates here!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {followingEvents.map((event) => (
                      <ActivityFeedItem key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="platform">
            <Card className="bg-card/90 backdrop-blur-sm border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">Platform Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {platformLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Loading feed...</p>
                ) : !platformEvents || platformEvents.length === 0 ? (
                  <div className="text-center py-8">
                    <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No platform activity yet. Check back soon!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {platformEvents.map((event) => (
                      <ActivityFeedItem key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
