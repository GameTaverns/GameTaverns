import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useFollowingFeed } from "@/hooks/useActivityFeed";
import { groupActivityEvents } from "@/utils/groupActivityEvents";
import { ActivityFeedItem } from "@/components/social/ActivityFeedItem";
import { ActivityFeedBatchItem } from "@/components/social/ActivityFeedBatchItem";
import { useActivityFilters, ActivityFilterBar } from "@/components/social/ActivityFilterBar";
import { Users, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function DashboardActivityFeed() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: events = [], isLoading } = useFollowingFeed(user?.id, 40);
  const grouped = groupActivityEvents(events);
  const { filteredItems, hiddenTypes, toggleType, availableTypes } = useActivityFilters(grouped);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card-handcrafted p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="h-9 w-9 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-muted rounded" />
                <div className="h-3 w-2/3 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card-handcrafted p-8 text-center">
        <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="font-display text-lg text-foreground mb-1">
          {t('dashboard.emptyFeedTitle', 'Your feed is quiet')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('dashboard.emptyFeedDesc', 'Follow libraries and connect with other collectors to see their activity here.')}
        </p>
        <Link to="/directory">
          <Button variant="secondary" size="sm" className="gap-2">
            <Globe className="h-4 w-4" />
            {t('dashboard.browseDirectory', 'Browse Directory')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {availableTypes.length > 1 && (
        <ActivityFilterBar
          availableTypes={availableTypes}
          hiddenTypes={hiddenTypes}
          toggleType={toggleType}
        />
      )}
      <div className="space-y-3">
        {filteredItems.map((item, idx) =>
          item.type === "batch" ? (
            <div key={`batch-${idx}`} className="card-handcrafted p-4">
              <ActivityFeedBatchItem batch={item} showUser />
            </div>
          ) : (
            <div key={item.event.id} className="card-handcrafted p-4">
              <ActivityFeedItem event={item.event} showUser />
            </div>
          )
        )}
      </div>
    </div>
  );
}
