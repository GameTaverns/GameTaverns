import { useEffect } from "react";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, Eye, ArrowRight, Share2, AlertTriangle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useLibrary";
import { SpokePageLayout } from "@/components/dashboard/SpokePageLayout";
import { AccountSettings } from "@/components/settings/AccountSettings";

import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { TwoFactorSettings } from "@/components/settings/TwoFactorSettings";
import { ReferralPanel } from "@/components/referral/ReferralPanel";
import { DangerZone } from "@/components/settings/DangerZone";

const cardClass = "bg-card border-border/60 text-card-foreground";
const btnOutline = "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted text-xs h-7 gap-1.5";
const btnPrimary = "bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs h-7 gap-1.5";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();
  const { data: profile } = useUserProfile();
  const navigate = useNavigate();
  const [settingsTab, setSettingsTab] = usePersistedTab("settings-tab", "profile");

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) return null;

  return (
    <SpokePageLayout
      title={t('hub.settingsAndAccount')}
      description={t('hub.settingsProfileDesc')}
      icon={SettingsIcon}
      iconColor="hsl(var(--muted-foreground))"
    >
      <div className="space-y-6">
        {/* Profile link */}
        {profile?.username && (
          <Card className={cardClass}>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-secondary" />
                {t('dashboard.myProfile')}
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">{t('dashboard.myProfileDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Link to={`/u/${profile.username}`}>
                <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                  <Eye className="h-3.5 w-3.5" /> {t('dashboard.viewProfile')}
                  <ArrowRight className="h-3 w-3 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Account Settings with Tabs */}
        <Card className={`${cardClass} overflow-hidden`}>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <SettingsIcon className="h-4 w-4 text-secondary" />
              {t('dashboard.accountSettings')}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">{t('dashboard.accountSettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Tabs value={settingsTab} onValueChange={setSettingsTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="profile">{t('settings.profile')}</TabsTrigger>
                <TabsTrigger value="security">{t('settings.security')}</TabsTrigger>
                <TabsTrigger value="appearance">{t('settings.appearance')}</TabsTrigger>
              </TabsList>
              <TabsContent value="profile">
                <AccountSettings />
              </TabsContent>
              <TabsContent value="security">
                <div className="space-y-6">
                  <ChangePasswordCard />
                  <TwoFactorSettings />
                </div>
              </TabsContent>
              <TabsContent value="appearance">
                <ProfileThemeCustomizer />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Growth & Referrals */}
        <Card className={cardClass}>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Share2 className="h-4 w-4 text-secondary" />
              {t('dashboard.shareGrow')}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">{t('dashboard.shareGrowDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-4">
              <Link to="/grow">
                <Button size="sm" className={`w-full ${btnPrimary}`}>
                  <Share2 className="h-3 w-3" /> {t('dashboard.openGrowthHub')}
                </Button>
              </Link>
              <ReferralPanel />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-destructive/10 border-destructive/30 text-card-foreground">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {t('dashboard.dangerZone')}
            </CardTitle>
            <CardDescription className="text-destructive/70 text-xs">{t('dashboard.dangerZoneDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4"><DangerZone /></CardContent>
        </Card>
      </div>
    </SpokePageLayout>
  );
}
