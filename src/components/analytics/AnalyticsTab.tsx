import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Shield, Library } from "lucide-react";
import { LibraryAnalyticsDashboard } from "@/components/analytics/LibraryAnalyticsDashboard";
import { CollectionValueDashboard } from "@/components/analytics/CollectionValueDashboard";
import { PlatformAnalytics } from "@/components/admin/PlatformAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { isSelfHostedSupabaseStack } from "@/config/runtime";

interface AnalyticsTabProps {
  isAdmin: boolean;
  libraryId: string | null;
}

export function AnalyticsTab({ isAdmin, libraryId }: AnalyticsTabProps) {
  const defaultTab = isAdmin ? "platform" : libraryId ? "library" : "platform";

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="bg-wood-dark/60 border border-wood-medium/40">
        {isAdmin && (
          <TabsTrigger 
            value="platform"
            className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
          >
            <Shield className="h-4 w-4" />
            Platform
          </TabsTrigger>
        )}
        {libraryId && (
          <TabsTrigger 
            value="library"
            className="gap-2 text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
          >
            <Library className="h-4 w-4" />
            Library
          </TabsTrigger>
        )}
      </TabsList>

      {isAdmin && (
        <TabsContent value="platform" className="mt-6">
          <PlatformAnalytics />
        </TabsContent>
      )}

      {libraryId && (
        <TabsContent value="library" className="mt-6 space-y-6">
          <LibraryAnalyticsDashboard libraryId={libraryId} />

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
        </TabsContent>
      )}
    </Tabs>
  );
}
