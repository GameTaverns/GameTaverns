import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Upload, Tag, Building, Loader2, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { GameUrlImport } from "@/components/games/GameUrlImport";
import { BulkImportDialog } from "@/components/games/BulkImportDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { useTenantUrl, getPlatformUrl } from "@/hooks/useTenantUrl";

type ImportMode = "csv" | "bgg_collection" | "bgg_links";

export default function LibraryGames() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { library, settings, isLoading, isOwner, tenantSlug } = useTenant();
  const { buildUrl } = useTenantUrl();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("add");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<ImportMode>("csv");
  const [isRefreshingImages, setIsRefreshingImages] = useState(false);
  const [isRefreshingRatings, setIsRefreshingRatings] = useState(false);

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

  const handleRefreshRatings = async () => {
    if (!library?.id) return;
    
    setIsRefreshingRatings(true);
    let totalUpdated = 0;
    let remaining = 999;
    
    try {
      if (isSelfHostedMode()) {
        toast({ title: "Feature not available", description: "Rating refresh is not yet available in self-hosted mode" });
        return;
      }

      while (remaining > 0) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          toast({ title: "Authentication required", description: "Please log in to refresh ratings", variant: "destructive" });
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-ratings`,
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
          throw new Error(error.error || "Failed to refresh ratings");
        }

        const data = await response.json();
        totalUpdated += data.updated || 0;
        remaining = data.remaining || 0;
        if (data.processed === 0) break;
      }

      if (totalUpdated > 0) {
        toast({ title: "Ratings refreshed!", description: `Updated ${totalUpdated} game rating${totalUpdated !== 1 ? 's' : ''} from BGG` });
        queryClient.invalidateQueries({ queryKey: ["game-ratings"] });
      } else {
        toast({ title: "No updates needed", description: "All games with BGG IDs already have community ratings" });
      }
    } catch (error) {
      console.error("Refresh ratings error:", error);
      toast({ title: "Refresh failed", description: error instanceof Error ? error.message : "Failed to refresh ratings", variant: "destructive" });
    } finally {
      setIsRefreshingRatings(false);
    }
  };

  // Platform URL helper (main domain, not tenant subdomain)
  const getPlatformUrl = (path: string = "/dashboard"): string => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    if (hostname.endsWith(".gametaverns.com")) {
      return `${protocol}//gametaverns.com${path}`;
    }

    return path;
  };

  if (isLoading || authLoading) {
    return (
      <Layout hideSidebar>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // IMPORTANT: Don't client-side navigate() to /login inside tenant routes.
  // During cross-subdomain session hydration, isAuthenticated can be false briefly.
  // If we navigate to /login and then auth becomes true, Login.tsx returns null while
  // it redirects to /dashboard (which isn't a tenant route), producing a blank screen.
  if (!isAuthenticated) {
    return (
      <Layout hideSidebar>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">Sign in required</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in on the main site to manage this library.
          </p>
          <a href={getPlatformUrl("/login")}>
            <Button>Sign In</Button>
          </a>
        </div>
      </Layout>
    );
  }

  if (!library || !settings) {
    return (
      <Layout hideSidebar>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">Library Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The library you're looking for doesn't exist or is not active.
          </p>
          <a href={getPlatformUrl("/dashboard")}>
            <Button>Go to Dashboard</Button>
          </a>
        </div>
      </Layout>
    );
  }

  if (!isOwner) {
    return (
      <Layout hideSidebar>
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

  return (
    <Layout hideSidebar>
      <div className="max-w-5xl mx-auto">
        <a href={getPlatformUrl("/dashboard?tab=library")}>
          <Button
            variant="ghost"
            className="mb-6 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </a>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Add Games</h1>
            <p className="text-muted-foreground text-sm">Add and import games to your collection</p>
          </div>
        </div>


        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="add" className="gap-2">
              <Plus className="h-4 w-4" />
              Quick Add
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add">
            <GameUrlImport libraryId={library.id} />
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

                {/* Refresh BGG Ratings Section */}
                <div className="border-t pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium mb-1">Refresh BGG Ratings</h3>
                      <p className="text-sm text-muted-foreground">
                        Pull community ratings from BoardGameGeek and map them to 5-star ratings
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleRefreshRatings}
                      disabled={isRefreshingRatings}
                    >
                      {isRefreshingRatings ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <Star className="h-4 w-4 mr-2" />
                          Refresh Ratings
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
        <BulkImportDialog
          open={showBulkImport}
          onOpenChange={setShowBulkImport}
          defaultMode={bulkImportMode}
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["games"] });
            queryClient.invalidateQueries({ queryKey: ["games-flat"] });
            setShowBulkImport(false);
          }}
        />
      </div>
    </Layout>
  );
}
