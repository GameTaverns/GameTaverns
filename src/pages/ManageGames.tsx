import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Tag, Loader2, Plus, Upload } from "lucide-react";
import { BackLink } from "@/components/navigation/BackLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { CategoryManager } from "@/components/games/CategoryManager";
import { GameCollectionTable } from "@/components/games/GameCollectionTable";
import { BulkImportDialog } from "@/components/games/BulkImportDialog";
import { useTenantUrl, getPlatformUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { useQueryClient } from "@tanstack/react-query";

type ImportMode = "csv" | "bgg_collection" | "bgg_links";

export default function ManageGames() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { library, settings, isLoading, isOwner } = useTenant();
  const { buildUrl } = useTenantUrl();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("collection");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<ImportMode>("csv");

  const openBulkImport = useCallback((mode: ImportMode) => {
    setBulkImportMode(mode);
    setShowBulkImport(true);
  }, []);

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
          <h1 className="text-2xl font-display font-bold mb-4">{t('manageGames.signInRequired')}</h1>
          <p className="text-muted-foreground mb-6">{t('manageGames.signInMessage')}</p>
          <TenantLink href={getMainPlatformUrl("/login")}><Button>Sign In</Button></TenantLink>
        </div>
      </Layout>
    );
  }

  if (!library || !settings) {
    return (
      <Layout hideSidebar>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">{t('manageGames.libraryNotFound')}</h1>
          <p className="text-muted-foreground mb-6">{t('manageGames.libraryNotFoundDesc')}</p>
          <TenantLink href={getMainPlatformUrl("/dashboard")}><Button>Go to Dashboard</Button></TenantLink>
        </div>
      </Layout>
    );
  }

  if (!isOwner) {
    return (
      <Layout hideSidebar>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">{t('manageGames.accessDenied')}</h1>
          <p className="text-muted-foreground mb-6">{t('manageGames.accessDeniedDesc')}</p>
          <TenantLink href={buildUrl("/")}><Button>Back to Library</Button></TenantLink>
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
            <h1 className="text-2xl sm:text-3xl font-display font-bold">{t('manageGames.title')}</h1>
            <p className="text-muted-foreground text-sm">{t('manageGames.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openBulkImport("csv")}>
              <Upload className="h-4 w-4 mr-2" />
              Import Games
            </Button>
            <TenantLink href={buildUrl("/add")}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('manageGames.addGameManually')}
              </Button>
            </TenantLink>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="collection" className="gap-2">
              {t('manageGames.collection')}
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="h-4 w-4" />
              {t('manageGames.categories')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="collection">
            <Card>
              <CardHeader>
                <CardTitle>{t('manageGames.fullCollection')}</CardTitle>
                <CardDescription>{t('manageGames.fullCollectionDesc')}</CardDescription>
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
