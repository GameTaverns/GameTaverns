import {
  useRatingTags,
  useCatalogTagAggregation,
  useCatalogPlayerCountRatings,
} from "@/hooks/useRatingTags";
import { Star, Users, TrendingUp, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReviewInsightsProps {
  catalogId: string;
}

export function ReviewInsights({ catalogId }: ReviewInsightsProps) {
  const { data: allTags = [] } = useRatingTags();
  const { data: tagAgg = [] } = useCatalogTagAggregation(catalogId);
  const { data: pcRatings = [] } = useCatalogPlayerCountRatings(catalogId);

  if (tagAgg.length === 0 && pcRatings.length === 0) return null;

  const tagMap = Object.fromEntries(allTags.map(t => [t.id, t]));

  return (
    <div className="space-y-4">
      {/* Player Count Ratings */}
      {pcRatings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Rating by Player Count
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-2">
              {pcRatings.map(pc => {
                const color =
                  pc.average >= 8 ? "text-green-600 dark:text-green-400" :
                  pc.average >= 6 ? "text-amber-600 dark:text-amber-400" :
                  "text-red-600 dark:text-red-400";
                return (
                  <div
                    key={pc.player_count}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-muted/50 border min-w-[60px]"
                  >
                    <span className="text-xs text-muted-foreground">
                      {pc.player_count}P
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Star className={cn("h-3 w-3 fill-current", color)} />
                      <span className={cn("text-sm font-bold", color)}>
                        {pc.average}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {pc.votes} vote{pc.votes !== 1 ? "s" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Community Tags */}
      {tagAgg.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Community Consensus
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-1.5">
              {tagAgg.slice(0, 12).map(agg => {
                const tag = tagMap[agg.tag_id];
                if (!tag) return null;
                const opacity = Math.max(0.6, Math.min(1, agg.percentage / 60));
                return (
                  <Badge
                    key={agg.tag_id}
                    variant="outline"
                    className={cn(
                      "gap-1 text-xs",
                      tag.is_positive === true && "border-green-500/30 bg-green-500/5",
                      tag.is_positive === false && "border-red-500/30 bg-red-500/5",
                      tag.is_positive === null && "border-border"
                    )}
                    style={{ opacity }}
                  >
                    {tag.icon && <span>{tag.icon}</span>}
                    {tag.label}
                    <span className="text-muted-foreground ml-0.5">({agg.percentage}%)</span>
                  </Badge>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Based on tags selected by reviewers
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
