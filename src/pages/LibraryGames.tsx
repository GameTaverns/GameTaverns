import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Upload, Tag, Building, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { GameUrlImport } from "@/components/games/GameUrlImport";
import { BulkImportDialog } from "@/components/games/BulkImportDialog";
import { CategoryManager } from "@/components/games/CategoryManager";

export default function LibraryGames() {
  const navigate = useNavigate();
  const { library, settings, isLoading, isOwner, tenantSlug } = useTenant();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("add");
  const [showBulkImport, setShowBulkImport] = useState(false);

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
          <Link to={`/?tenant=${tenantSlug}`}>
            <Button>Back to Library</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6 -ml-2"
          onClick={() => navigate(`/?tenant=${tenantSlug}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold">Manage Games</h1>
            <p className="text-muted-foreground">Add, import, and organize your collection</p>
          </div>
          <Link to={`/?tenant=${tenantSlug}&path=/admin/add`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Game Manually
            </Button>
          </Link>
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
                  <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setShowBulkImport(true)}>
                    <CardContent className="pt-6 text-center">
                      <Upload className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-medium mb-1">CSV / Excel</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload a spreadsheet with your games
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setShowBulkImport(true)}>
                    <CardContent className="pt-6 text-center">
                      <Tag className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-medium mb-1">BGG Collection</h3>
                      <p className="text-sm text-muted-foreground">
                        Import from your BoardGameGeek account
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setShowBulkImport(true)}>
                    <CardContent className="pt-6 text-center">
                      <Building className="h-8 w-8 mx-auto mb-3 text-primary" />
                      <h3 className="font-medium mb-1">BGG Links</h3>
                      <p className="text-sm text-muted-foreground">
                        Paste multiple BGG URLs to import
                      </p>
                    </CardContent>
                  </Card>
                </div>
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
          onImportComplete={() => {
            setShowBulkImport(false);
          }}
        />
      </div>
    </Layout>
  );
}
