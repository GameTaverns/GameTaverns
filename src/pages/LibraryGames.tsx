import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Upload, Tag, Building, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { GameUrlImport } from "@/components/games/GameUrlImport";
import { BulkImportDialog } from "@/components/games/BulkImportDialog";
import { CategoryManager } from "@/components/games/CategoryManager";
import { GameCollectionTable } from "@/components/games/GameCollectionTable";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { useTenantUrl } from "@/hooks/useTenantUrl";

type ImportMode = "csv" | "bgg_collection" | "bgg_links";

export default function LibraryGames() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { library, settings, isLoading, isOwner, tenantSlug } = useTenant();
  const { buildUrl } = useTenantUrl();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("add");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<ImportMode>("csv");
  const [isRefreshingImages, setIsRefreshingImages] = useState(false);

  const openBulkImport = (mode: ImportMode) => {
    setBulkImportMode(mode);
    setShowBulkImport(true);
  };

  const handleRefreshImages = async () => {
    if (!library?.id) return;
    
    setIsRefreshingImages(true);
    let totalUpdated = 0;
    let remaining = 999;
    
    try {
      // Self-hosted mode: use local API
      if (isSelfHostedMode()) {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          toast({
            title: "Authentication required",
            description: "Please log in to refresh images",
            variant: "destructive",
          });
          return;
        }

        // Self-hosted may not have this feature yet
        toast({
          title: "Feature not available",
          description: "Image refresh is not yet available in self-hosted mode",
        });
        return;
      }

      // Cloud mode: use Supabase Edge Function
      // Process in batches until no more remaining
      while (remaining > 0) {
        // Refresh session on each iteration to prevent JWT expiration during long operations
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        
        if (!token) {
          toast({
            title: "Authentication required",
            description: "Please log in to refresh images",
            variant: "destructive",
          });
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-images`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ library_id: library.id, limit: 30 }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to refresh images");
        }

        const data = await response.json();
        totalUpdated += data.updated || 0;
        remaining = data.remaining || 0;

        if (data.processed === 0) break; // No more to process
      }

      if (totalUpdated > 0) {
        toast({
          title: "Images refreshed!",
          description: `Updated ${totalUpdated} game image${totalUpdated !== 1 ? 's' : ''}`,
        });
      } else {
        toast({
          title: "No updates needed",
          description: "All games already have images",
        });
      }
    } catch (error) {
      console.error("Refresh images error:", error);
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "Failed to refresh images",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingImages(false);
    }
  };

  // Redirect if not authenticated or not owner
  if (!authLoading && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  if (isLoading || authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!library || !settings) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">Library Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The library you're looking for doesn't exist or is not active.
          </p>
          <Link to="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (!isOwner) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to manage this library's games.
          </p>
          <a href={buildUrl("/")}>
            <Button>Back to Library</Button>
          </a>
        </div>
      </Layout>
    );
  }

  // Get the base platform URL for dashboard link
  const getPlatformUrl = (path: string = "/dashboard"): string => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    if (hostname.endsWith(".gametaverns.com")) {
      return `${protocol}//gametaverns.com${path}`;
    }
    
    return path;
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <a href={getPlatformUrl("/dashboard")}>
          <Button
            variant="ghost"
            className="mb-6 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </a>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold">Manage Games</h1>
            <p className="text-muted-foreground">Add, import, and organize your collection</p>
          </div>
          <a href={buildUrl("/add")}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Game Manually
            </Button>
          </a>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="add" className="gap-2">
              <Plus className="h-4 w-4" />
              Quick Add
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Import
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="h-4 w-4" />
              Categories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add">
            <GameUrlImport />
          </TabsContent>

          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Import</CardTitle>
                <CardDescription>
                  Import multiple games at once from CSV, BGG collection, or BGG links
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => openBulkImport("csv")}>
                    <CardContent className="pt-6 text-center">
                      <Upload className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-medium mb-1">CSV / Excel</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload a spreadsheet with your games
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => openBulkImport("bgg_collection")}>
                    <CardContent className="pt-6 text-center">
                      <Tag className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-medium mb-1">BGG Collection</h3>
                      <p className="text-sm text-muted-foreground">
                        Import your full BoardGameGeek collection
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => openBulkImport("bgg_links")}>
                    <CardContent className="pt-6 text-center">
                      <Building className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-medium mb-1">BGG Links</h3>
                      <p className="text-sm text-muted-foreground">
                        Paste multiple BGG URLs to import
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Refresh Images Section */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium mb-1">Refresh Missing Images</h3>
                      <p className="text-sm text-muted-foreground">
                        Re-fetch images from BoardGameGeek for games that are missing images
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleRefreshImages}
                      disabled={isRefreshingImages}
                    >
                      {isRefreshingImages ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Images
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <CategoryManager />
          </TabsContent>
        </Tabs>

        {/* Collection Table - Always visible below tabs */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Full Collection</CardTitle>
            <CardDescription>
              View, edit, and manage all games in your library
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GameCollectionTable />
          </CardContent>
        </Card>

        <BulkImportDialog
          open={showBulkImport}
          onOpenChange={setShowBulkImport}
          defaultMode={bulkImportMode}
          onImportComplete={() => {
            setShowBulkImport(false);
          }}
        />
      </div>
    </Layout>
  );
}
