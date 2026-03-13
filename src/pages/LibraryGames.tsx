import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Tag, Loader2, RefreshCw, Star, Search } from "lucide-react";
import { BackLink } from "@/components/navigation/BackLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { CatalogSearchAdd } from "@/components/games/CatalogSearchAdd";
import { BulkImportDialog } from "@/components/games/BulkImportDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { useTenantUrl, getPlatformUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { Capacitor } from "@capacitor/core";

type ImportMode = "csv" | "bgg_collection" | "bgg_links";

const BULK_IMPORT_KEY = "bulk_import_open";
const BULK_IMPORT_MODE_KEY = "bulk_import_mode";

function getPersistedBulkImport(): { open: boolean; mode: ImportMode } {
  if (!Capacitor.isNativePlatform()) return { open: false, mode: "csv" };
  try {
    const open = sessionStorage.getItem(BULK_IMPORT_KEY) === "true";
    const mode = (sessionStorage.getItem(BULK_IMPORT_MODE_KEY) as ImportMode) || "csv";
    return { open, mode };
  } catch { return { open: false, mode: "csv" }; }
}

export default function LibraryGames() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { library, settings, isLoading, isOwner, tenantSlug } = useTenant();
  const { buildUrl } = useTenantUrl();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("add");

  const persisted = getPersistedBulkImport();
  const [showBulkImport, setShowBulkImportRaw] = useState(persisted.open);
  const [bulkImportMode, setBulkImportMode] = useState<ImportMode>(persisted.mode);
  const [isRefreshingImages, setIsRefreshingImages] = useState(false);
  

  const setShowBulkImport = useCallback((v: boolean) => {
    setShowBulkImportRaw(v);
    if (Capacitor.isNativePlatform()) {
      try { sessionStorage.setItem(BULK_IMPORT_KEY, String(v)); } catch {}
    }
  }, []);

  const openBulkImport = (mode: ImportMode) => {
    setBulkImportMode(mode);
    if (Capacitor.isNativePlatform()) {
      try { sessionStorage.setItem(BULK_IMPORT_MODE_KEY, mode); } catch {}
    }
    setShowBulkImport(true);
  };

  const handleRefreshImages = async () => {
    if (!library?.id) return;
    setIsRefreshingImages(true);
    let totalUpdated = 0;
    let remaining = 999;
    try {
      if (isSelfHostedMode()) {
        toast({ title: "Feature not available", description: "Image refresh is not yet available in self-hosted mode" });
        return;
      }
      while (remaining > 0) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) { toast({ title: "Authentication required", description: "Please log in to refresh images", variant: "destructive" }); return; }
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-images`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ library_id: library.id, limit: 30 }),
        });
        if (!response.ok) { const error = await response.json(); throw new Error(error.error || "Failed to refresh images"); }
        const data = await response.json();
        totalUpdated += data.updated || 0;
        remaining = data.remaining || 0;
        if (data.processed === 0) break;
      }
      if (totalUpdated > 0) toast({ title: "Images refreshed!", description: `Updated ${totalUpdated} game image${totalUpdated !== 1 ? 's' : ''}` });
      else toast({ title: "No updates needed", description: "All games already have images" });
    } catch (error) {
      console.error("Refresh images error:", error);
      toast({ title: "Refresh failed", description: error instanceof Error ? error.message : "Failed to refresh images", variant: "destructive" });
    } finally { setIsRefreshingImages(false); }
  };


  const getLocalPlatformUrl = (path: string = "/dashboard"): string => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    if (hostname.endsWith(".gametaverns.com")) return `${protocol}//gametaverns.com${path}`;
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

  if (!isAuthenticated) {
    return (
      <Layout hideSidebar>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">{t('libraryGames.signInRequired')}</h1>
          <p className="text-muted-foreground mb-6">{t('libraryGames.signInMessage')}</p>
          <TenantLink href={getLocalPlatformUrl("/login")}>
            <Button>{t('libraryGames.signIn')}</Button>
          </TenantLink>
        </div>
      </Layout>
    );
  }

  if (!library || !settings) {
    return (
      <Layout hideSidebar>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">{t('libraryGames.libraryNotFound')}</h1>
          <p className="text-muted-foreground mb-6">{t('libraryGames.libraryNotFoundDesc')}</p>
          <TenantLink href={getLocalPlatformUrl("/dashboard")}>
            <Button>{t('libraryGames.goToDashboard')}</Button>
          </TenantLink>
        </div>
      </Layout>
    );
  }

  if (!isOwner) {
    return (
      <Layout hideSidebar>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">{t('libraryGames.accessDenied')}</h1>
          <p className="text-muted-foreground mb-6">{t('libraryGames.accessDeniedDesc')}</p>
          <TenantLink href={buildUrl("/")}>
            <Button>{t('libraryGames.backToLibrary')}</Button>
          </TenantLink>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideSidebar>
      <div className="max-w-5xl mx-auto">
        <BackLink fallback="/dashboard" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">{t('libraryGames.addGames')}</h1>
            <p className="text-muted-foreground text-sm">{t('libraryGames.addGamesDesc')}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="add" className="gap-2">
              <Search className="h-4 w-4" />
              {t('libraryGames.quickAdd')}
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              {t('libraryGames.bulkImport')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add">
            <CatalogSearchAdd libraryId={library.id} />
          </TabsContent>

          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>{t('libraryGames.bulkImportTitle')}</CardTitle>
                <CardDescription>{t('libraryGames.bulkImportDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => openBulkImport("csv")}>
                    <CardContent className="pt-6 text-center">
                      <Upload className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-medium mb-1">{t('libraryGames.csvExcel')}</h3>
                      <p className="text-sm text-muted-foreground">{t('libraryGames.csvExcelDesc')}</p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => openBulkImport("bgg_collection")}>
                    <CardContent className="pt-6 text-center">
                      <Tag className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-medium mb-1">{t('libraryGames.bggCollection')}</h3>
                      <p className="text-sm text-muted-foreground">{t('libraryGames.bggCollectionDesc')}</p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => openBulkImport("bgg_links")}>
                    <CardContent className="pt-6 text-center">
                      <Building className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-medium mb-1">{t('libraryGames.bggLinks')}</h3>
                      <p className="text-sm text-muted-foreground">{t('libraryGames.bggLinksDesc')}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="border-t pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium mb-1">{t('libraryGames.refreshImages')}</h3>
                      <p className="text-sm text-muted-foreground">{t('libraryGames.refreshImagesDesc')}</p>
                    </div>
                    <Button variant="outline" onClick={handleRefreshImages} disabled={isRefreshingImages}>
                      {isRefreshingImages ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('libraryGames.refreshing')}</>) : (<><RefreshCw className="h-4 w-4 mr-2" />{t('libraryGames.refreshImages')}</>)}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6">
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
            try { sessionStorage.removeItem(BULK_IMPORT_KEY); sessionStorage.removeItem(BULK_IMPORT_MODE_KEY); } catch {}
          }}
        />
      </div>
    </Layout>
  );
}
