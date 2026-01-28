import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Palette, Settings, ToggleRight, Image, Loader2, Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { LibrarySettingsGeneral } from "@/components/settings/LibrarySettingsGeneral";
import { LibraryThemeCustomizer } from "@/components/settings/LibraryThemeCustomizer";
import { RatingsAdmin } from "@/components/settings/RatingsAdmin";
import { WishlistAdmin } from "@/components/settings/WishlistAdmin";
import { LibraryBranding } from "@/components/settings/LibraryBranding";

export default function LibrarySettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { library, settings, isLoading, isOwner, tenantSlug } = useTenant();
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  // Get initial tab from URL param
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "general");

  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    if (value === "general") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", value);
    }
    setSearchParams(newParams, { replace: true });
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
            You don't have permission to manage this library's settings.
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
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="theme" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Theme</span>
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="ratings" className="gap-2">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Ratings</span>
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="gap-2">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">Wishlist</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-2">
              <ToggleRight className="h-4 w-4" />
              <span className="hidden sm:inline">Advanced</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <LibrarySettingsGeneral />
          </TabsContent>

          <TabsContent value="theme">
            <LibraryThemeCustomizer />
          </TabsContent>

          <TabsContent value="branding">
            <LibraryBranding />
          </TabsContent>

          <TabsContent value="ratings">
            <RatingsAdmin />
          </TabsContent>

          <TabsContent value="wishlist">
            <WishlistAdmin />
          </TabsContent>

          <TabsContent value="advanced">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  Additional configuration options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center">
                  <ToggleRight className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Advanced settings coming soon
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-2">
                    Turnstile protection, custom domains (premium), and more
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
