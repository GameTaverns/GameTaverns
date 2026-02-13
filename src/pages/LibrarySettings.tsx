import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Palette, Settings, ToggleRight, Image, Loader2, Star, Heart, MessageSquare, Users, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { getLibraryUrl, getPlatformUrl } from "@/hooks/useTenantUrl";
import { Layout } from "@/components/layout/Layout";
import { LibrarySettingsGeneral } from "@/components/settings/LibrarySettingsGeneral";
import { LibraryThemeCustomizer } from "@/components/settings/LibraryThemeCustomizer";
import { RatingsAdmin } from "@/components/settings/RatingsAdmin";
import { WishlistAdmin } from "@/components/settings/WishlistAdmin";
import { LibraryBranding } from "@/components/settings/LibraryBranding";
import { LibraryDiscordSettings } from "@/components/settings/LibraryDiscordSettings";
import { LibraryFeatureFlagsAdmin } from "@/components/settings/LibraryFeatureFlagsAdmin";
import { LibraryMemberManagement } from "@/components/settings/LibraryMemberManagement";
import { BGGSyncSettings } from "@/components/settings/BGGSyncSettings";
import { cn } from "@/lib/utils";

// Define tab groups for progressive disclosure
const ESSENTIAL_TABS = [
  { value: "general", label: "General", icon: Settings },
  { value: "theme", label: "Theme", icon: Palette },
  { value: "branding", label: "Branding", icon: Image },
  { value: "features", label: "Features", icon: ToggleRight },
];

const ADVANCED_TABS = [
  { value: "members", label: "Members", icon: Users },
  { value: "ratings", label: "Ratings", icon: Star },
  { value: "wishlist", label: "Wishlist", icon: Heart },
  { value: "discord", label: "Discord", icon: MessageSquare },
  { value: "bgg-sync", label: "BGG Sync", icon: RefreshCw },
];

export default function LibrarySettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { library, settings, isLoading, isOwner, tenantSlug } = useTenant();
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "general");
  
  // Auto-expand advanced section if an advanced tab is active
  const isAdvancedTab = ADVANCED_TABS.some(t => t.value === activeTab);
  const [showAdvanced, setShowAdvanced] = useState(isAdvancedTab);

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
      if (ADVANCED_TABS.some(t => t.value === tabFromUrl)) {
        setShowAdvanced(true);
      }
    }
  }, [tabFromUrl]);

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
          <a href={getPlatformUrl("/dashboard")}>
            <Button>Go to Dashboard</Button>
          </a>
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
          <Link to={tenantSlug ? getLibraryUrl(tenantSlug, "/") : "/"}>
            <Button>Back to Library</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <a href={getPlatformUrl("/dashboard?tab=library")}>
          <Button variant="ghost" className="mb-6 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </a>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="space-y-2">
            {/* Essential tabs - always visible */}
            <TabsList className="w-full h-auto flex-wrap gap-1 p-1">
              {ESSENTIAL_TABS.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Advanced toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
            >
              <ChevronDown className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                showAdvanced && "rotate-180"
              )} />
              {showAdvanced ? "Hide advanced settings" : "Show advanced settings"}
              {isAdvancedTab && !showAdvanced && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>

            {/* Advanced tabs - toggle visibility */}
            {showAdvanced && (
              <TabsList className="w-full h-auto flex-wrap gap-1 p-1">
                {ADVANCED_TABS.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                    <tab.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            )}
          </div>

          <TabsContent value="general">
            <LibrarySettingsGeneral />
          </TabsContent>

          <TabsContent value="members">
            <LibraryMemberManagement />
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

          <TabsContent value="discord">
            <LibraryDiscordSettings />
          </TabsContent>

          <TabsContent value="bgg-sync">
            <BGGSyncSettings />
          </TabsContent>

          <TabsContent value="features">
            <LibraryFeatureFlagsAdmin />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
