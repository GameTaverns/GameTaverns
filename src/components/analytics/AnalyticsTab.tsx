import { Library } from "lucide-react";
import { LibraryAnalyticsDashboard } from "@/components/analytics/LibraryAnalyticsDashboard";
import { CollectionValueDashboard } from "@/components/analytics/CollectionValueDashboard";
import { TopNineGrid } from "@/components/analytics/TopNineGrid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { isSelfHostedSupabaseStack } from "@/config/runtime";

interface AnalyticsTabProps {
  isAdmin: boolean;
  libraryId: string | null;
  libraryName?: string;
}

export function AnalyticsTab({ isAdmin, libraryId, libraryName }: AnalyticsTabProps) {
  if (!libraryId) {
    return (
      <div className="text-center py-8 text-cream/60 text-sm">
        Create a library to start tracking analytics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LibraryAnalyticsDashboard libraryId={libraryId} />

      <TopNineGrid libraryId={libraryId} libraryName={libraryName} />

      {isSelfHostedSupabaseStack() && (
        <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-secondary" />
              Collection Value
            </CardTitle>
            <CardDescription className="text-cream/70">
              Track purchase prices and current market value
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CollectionValueDashboard libraryId={libraryId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
