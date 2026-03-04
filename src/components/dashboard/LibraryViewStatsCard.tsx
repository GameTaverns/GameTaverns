import { Eye, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLibraryViewStats } from "@/hooks/useLibraryViewStats";
import { Skeleton } from "@/components/ui/skeleton";

interface LibraryViewStatsCardProps {
  libraryId: string;
  className?: string;
}

export function LibraryViewStatsCard({ libraryId, className }: LibraryViewStatsCardProps) {
  const { data: stats, isLoading } = useLibraryViewStats(libraryId);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2 px-4 pt-4">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const views7d = stats?.views_7d ?? 0;
  const views30d = stats?.views_30d ?? 0;
  const uniqueViewers7d = stats?.unique_viewers_7d ?? 0;
  const viewsTotal = stats?.views_total ?? 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-secondary" />
          Library Views
        </CardTitle>
        <CardDescription className="text-cream/60 text-xs">
          How many people are checking out your collection
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 text-green-400" />
            </div>
            <div className="text-xl font-bold text-cream">{views7d}</div>
            <div className="text-[10px] text-cream/50">This week</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="h-3 w-3 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-cream">{uniqueViewers7d}</div>
            <div className="text-[10px] text-cream/50">Unique visitors</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Eye className="h-3 w-3 text-cream/40" />
            </div>
            <div className="text-xl font-bold text-cream">{viewsTotal}</div>
            <div className="text-[10px] text-cream/50">All time</div>
          </div>
        </div>
        {views30d > 0 && (
          <p className="text-[10px] text-cream/40 text-center mt-3">
            {views30d} views in the last 30 days
          </p>
        )}
        {viewsTotal === 0 && (
          <p className="text-xs text-cream/50 text-center mt-2">
            Share your library link to start getting views!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
