import { useMemo } from "react";
import { Users, Globe, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFollowingFeed } from "@/hooks/useActivityFeed";
import { ActivityFeedItem } from "@/components/social/ActivityFeedItem";
import { ActivityFeedBatchItem } from "@/components/social/ActivityFeedBatchItem";
import { SocialDiscovery } from "@/components/social/SocialDiscovery";
import { groupActivityEvents } from "@/utils/groupActivityEvents";

export function SocialTab({ currentUserId }: { currentUserId: string | undefined }) {
  const { data: events, isLoading } = useFollowingFeed(currentUserId);
  const groupedEvents = useMemo(() => groupActivityEvents(events || []), [events]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Tabs defaultValue="feed">
        <TabsList className="bg-wood-dark/60 border border-wood-medium/40 h-auto gap-1 p-1">
          <TabsTrigger
            value="feed"
            className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
          >
            <Users className="h-3.5 w-3.5" />
            Following Feed
          </TabsTrigger>
          <TabsTrigger
            value="discover"
            className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Discover
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2 text-cream">
                <Users className="h-4 w-4 text-secondary" />
                Following Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-cream/50 py-8 text-center">Loading feed...</p>
              ) : groupedEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Globe className="h-10 w-10 mx-auto text-cream/20 mb-3" />
                  <p className="text-sm text-cream/50">
                    No activity yet. Follow some users to see their updates here!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedEvents.map((item, idx) =>
                    item.type === "batch" ? (
                      <ActivityFeedBatchItem key={`batch-${idx}`} batch={item} showUser />
                    ) : (
                      <ActivityFeedItem key={item.event.id} event={item.event} showUser />
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discover">
          <SocialDiscovery />
        </TabsContent>
      </Tabs>
    </div>
  );
}
