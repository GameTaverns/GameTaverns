import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Settings, ToggleRight, Image, Loader2, Star, Heart, MessageSquare, Users, RefreshCw, ChevronDown } from "lucide-react";
import { BackLink } from "@/components/navigation/BackLink";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { getLibraryUrl, getPlatformUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { Layout } from "@/components/layout/Layout";
import { LibrarySettingsGeneral } from "@/components/settings/LibrarySettingsGeneral";

import { RatingsAdmin } from "@/components/settings/RatingsAdmin";
import { WishlistAdmin } from "@/components/settings/WishlistAdmin";
import { LibraryBranding } from "@/components/settings/LibraryBranding";
import { LibraryDiscordSettings } from "@/components/settings/LibraryDiscordSettings";
import { LibraryFeatureFlagsAdmin } from "@/components/settings/LibraryFeatureFlagsAdmin";
import { LibraryMemberManagement } from "@/components/settings/LibraryMemberManagement";
import { BGGSyncSettings } from "@/components/settings/BGGSyncSettings";
import { cn } from "@/lib/utils";

const ESSENTIAL_TABS = [
  { value: "general", labelKey: "librarySettings.general", icon: Settings },
  { value: "branding", labelKey: "librarySettings.branding", icon: Image },
  { value: "features", labelKey: "librarySettings.features", icon: ToggleRight },
];

const ADVANCED_TABS = [
  { value: "members", labelKey: "librarySettings.members", icon: Users },
  { value: "ratings", labelKey: "librarySettings.ratings", icon: Star },
  { value: "want-to-play", labelKey: "librarySettings.wantToPlay", icon: Heart },
  { value: "discord", labelKey: "librarySettings.discord", icon: MessageSquare },
  { value: "bgg-sync", labelKey: "librarySettings.bggSync", icon: RefreshCw },
];

export default function LibrarySettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { library, settings, isLoading, isOwner, tenantSlug } = useTenant();
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "general");
  const isAdvancedTab = ADVANCED_TABS.some(tab => tab.value === activeTab);
  const [showAdvanced, setShowAdvanced] = useState(isAdvancedTab);

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
      if (ADVANCED_TABS.some(tab => tab.value === tabFromUrl)) setShowAdvanced(true);
    }
  }, [tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    if (value === "general") newParams.delete("tab");
    else newParams.set("tab", value);
    setSearchParams(newParams, { replace: true });
  };

  if (!authLoading && !isAuthenticated) { navigate("/login"); return null; }

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
          <h1 className="text-2xl font-display font-bold mb-4">{t('librarySettings.libraryNotFound')}</h1>
          <p className="text-muted-foreground mb-6">{t('librarySettings.libraryNotFoundDesc')}</p>
          <TenantLink href={getPlatformUrl("/dashboard")}>
            <Button>{t('librarySettings.goToDashboard')}</Button>
          </TenantLink>
        </div>
      </Layout>
    );
  }

  if (!isOwner) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-display font-bold mb-4">{t('librarySettings.accessDenied')}</h1>
          <p className="text-muted-foreground mb-6">{t('librarySettings.accessDeniedDesc')}</p>
          <Link to={tenantSlug ? getLibraryUrl(tenantSlug, "/") : "/"}>
            <Button>{t('librarySettings.backToLibrary')}</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <BackLink fallback="/dashboard" />
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="space-y-2">
            <TabsList className="w-full h-auto flex-wrap gap-1 p-1">
              {ESSENTIAL_TABS.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t(tab.labelKey)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showAdvanced && "rotate-180")} />
              {showAdvanced ? t('librarySettings.hideAdvanced') : t('librarySettings.showAdvanced')}
              {isAdvancedTab && !showAdvanced && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
            {showAdvanced && (
              <TabsList className="w-full h-auto flex-wrap gap-1 p-1">
                {ADVANCED_TABS.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                    <tab.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t(tab.labelKey)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            )}
          </div>

          <TabsContent value="general">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold">{t('librarySettings.generalSettings')}</h2>
              <InfoPopover title={t('librarySettings.generalSettings')} description={t('librarySettings.generalSettingsInfo')} tips={["Your slug determines your library URL", "Add a description to help visitors understand your collection"]} />
            </div>
            <LibrarySettingsGeneral />
          </TabsContent>

          <TabsContent value="members">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold">{t('librarySettings.memberManagement')}</h2>
              <InfoPopover title={t('librarySettings.members')} description={t('librarySettings.membersInfo')} tips={["Editors can add/edit games", "Admins have full control except deletion"]} />
            </div>
            <LibraryMemberManagement />
          </TabsContent>


          <TabsContent value="branding">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold">{t('librarySettings.brandingTitle')}</h2>
              <InfoPopover title={t('librarySettings.branding')} description={t('librarySettings.brandingInfo')} tips={["Square logos (256×256+) work best", "Background images appear behind your game grid"]} />
            </div>
            <LibraryBranding />
          </TabsContent>

          <TabsContent value="ratings">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold">{t('librarySettings.ratingsTitle')}</h2>
              <InfoPopover title={t('librarySettings.ratings')} description={t('librarySettings.ratingsInfo')} />
            </div>
            <RatingsAdmin />
          </TabsContent>

          <TabsContent value="want-to-play">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold">{t('librarySettings.wantToPlayTitle')}</h2>
              <InfoPopover title={t('librarySettings.wantToPlay')} description={t('librarySettings.wantToPlayInfo')} />
            </div>
            <WishlistAdmin />
          </TabsContent>

          <TabsContent value="discord">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold">{t('librarySettings.discordIntegration')}</h2>
              <InfoPopover title={t('librarySettings.discord')} description={t('librarySettings.discordInfo')} tips={["Create a webhook in your Discord server settings", "Choose which events trigger notifications"]} />
            </div>
            <LibraryDiscordSettings />
          </TabsContent>

          <TabsContent value="bgg-sync">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold">{t('librarySettings.bggSyncTitle')}</h2>
              <InfoPopover title={t('librarySettings.bggSync')} description={t('librarySettings.bggSyncInfo')} tips={["Syncs run on a schedule you choose", "New games on BGG are added automatically", "Removed games can be archived or deleted"]} />
            </div>
            <BGGSyncSettings />
          </TabsContent>

          <TabsContent value="features">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold">{t('librarySettings.featureFlags')}</h2>
              <InfoPopover title={t('librarySettings.features')} description={t('librarySettings.featureFlagsInfo')} tips={["Disable lending if you don't loan games", "Enable 'Coming Soon' to tease upcoming additions"]} />
            </div>
            <LibraryFeatureFlagsAdmin />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
