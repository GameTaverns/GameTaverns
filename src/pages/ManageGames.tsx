import { useState } from "react";
import { ArrowLeft, Tag, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { CategoryManager } from "@/components/games/CategoryManager";
import { GameCollectionTable } from "@/components/games/GameCollectionTable";
import { useTenantUrl, getPlatformUrl } from "@/hooks/useTenantUrl";

export default function ManageGames() {
  const { library, settings, isLoading, isOwner } = useTenant();
  const { buildUrl } = useTenantUrl();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("collection");

  const getMainPlatformUrl = (path: string = "/dashboard"): string => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    if (hostname.endsWith(".gametaverns.com")) {
      return `${protocol}//gametaverns.com${path}`;
    }
    return path;
  };

  if (isLoading || authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">Sign in required</h1>
          <p className="text-muted-foreground mb-6">Please sign in on the main site to manage this library.</p>
          <a href={getMainPlatformUrl("/login")}><Button>Sign In</Button></a>
        </div>
      </Layout>
    );
  }

  if (!library || !settings) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">Library Not Found</h1>
          <p className="text-muted-foreground mb-6">The library you're looking for doesn't exist or is not active.</p>
          <a href={getMainPlatformUrl("/dashboard")}><Button>Go to Dashboard</Button></a>
        </div>
      </Layout>
    );
  }

  if (!isOwner) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">You don't have permission to manage this library's games.</p>
          <a href={buildUrl("/")}><Button>Back to Library</Button></a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <a href={getMainPlatformUrl("/dashboard?tab=library")}>
          <Button variant="ghost" className="mb-6 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </a>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Manage Collection</h1>
            <p className="text-muted-foreground text-sm">Edit, organize, and manage your existing games</p>
          </div>
          <a href={buildUrl("/add")}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Game Manually
            </Button>
          </a>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="collection" className="gap-2">
              Collection
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="h-4 w-4" />
              Categories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="collection">
            <Card>
              <CardHeader>
                <CardTitle>Full Collection</CardTitle>
                <CardDescription>View, edit, and manage all games in your library</CardDescription>
              </CardHeader>
              <CardContent>
                <GameCollectionTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <CategoryManager />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
