import { useEffect, useState, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isAdminSubdomain } from "@/lib/subdomainDetection";
import { Shield, Users, Database, Settings, Activity, MessageCircle, Trophy, HeartPulse, Map, BadgeCheck, LogOut, Clock, Globe, AlertTriangle, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { UserManagement } from "@/components/admin/UserManagement";
import { LibraryManagement } from "@/components/admin/LibraryManagement";
import { PlatformSettings } from "@/components/admin/PlatformSettings";
import { PlatformAnalytics } from "@/components/admin/PlatformAnalytics";
import { FeedbackManagement } from "@/components/admin/FeedbackManagement";
import { ClubsManagement } from "@/components/admin/ClubsManagement";
import { SystemHealth } from "@/components/admin/SystemHealth";
import { PlatformRoadmap } from "@/components/admin/PlatformRoadmap";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { useUnreadFeedbackCount } from "@/hooks/usePlatformFeedback";
import { usePendingClubs } from "@/hooks/useClubs";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const SpecialBadgesManagement = lazy(() =>
  import("@/components/admin/SpecialBadgesManagement").then(m => ({ default: m.SpecialBadgesManagement }))
);
const ServerManagement = lazy(() =>
  import("@/components/admin/ServerManagement").then(m => ({ default: m.ServerManagement }))
);
const CronJobsMonitor = lazy(() =>
  import("@/components/admin/CronJobsMonitor").then(m => ({ default: m.CronJobsMonitor }))
);
const AuditLogViewer = lazy(() =>
  import("@/components/admin/AuditLogViewer").then(m => ({ default: m.AuditLogViewer }))
);
const SeoDirectory = lazy(() =>
  import("@/components/admin/SeoDirectory").then(m => ({ default: m.SeoDirectory }))
);
const ImportErrorsPanel = lazy(() =>
  import("@/components/admin/ImportErrorsPanel").then(m => ({ default: m.ImportErrorsPanel }))
);
const EmailEngagementAnalytics = lazy(() =>
  import("@/components/admin/EmailEngagementAnalytics").then(m => ({ default: m.EmailEngagementAnalytics }))
);

class TabErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[TabErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <strong>Something went wrong loading this tab:</strong> {this.state.error}
          <button
            className="ml-3 underline"
            onClick={() => this.setState({ hasError: false, error: "" })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Define which tabs each role can access
const STAFF_TABS = ["analytics", "users", "libraries", "feedback", "clubs", "health", "import-errors"] as const;
const ADMIN_ONLY_TABS = ["settings", "roadmap", "badges", "crons", "server", "security", "seo", "email-analytics"] as const;
const ADMIN_REAUTH_KEY = "gt_admin_reauth_ok";

export default function PlatformAdmin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, loading: authLoading, isAdmin, isStaff, roleLoading, signOut } = useAuth();
  
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "analytics");
  
  const { data: unreadFeedbackCount } = useUnreadFeedbackCount();
  const { data: pendingClubs } = usePendingClubs();
  
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (!isAdminSubdomain()) return;
    if (authLoading || roleLoading) return;

    const hasPassedGate = typeof window !== "undefined" && sessionStorage.getItem(ADMIN_REAUTH_KEY) === "1";
    if (!hasPassedGate) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, roleLoading, navigate]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    if (value === "analytics") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", value);
    }
    setSearchParams(newParams, { replace: true });
  };
  
  useEffect(() => {
    console.log('[PlatformAdmin] Auth state:', { 
      authLoading, roleLoading, isAuthenticated, isAdmin, isStaff, userId: user?.id 
    });
  }, [authLoading, roleLoading, isAuthenticated, isAdmin, isStaff, user?.id]);
  
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // On admin subdomain, redirect to its own /login; otherwise main site login
      navigate(isAdminSubdomain() ? "/login" : "/login");
    }
  }, [isAuthenticated, authLoading, navigate]);
  
  useEffect(() => {
    // On admin subdomain, also check email domain
    if (!authLoading && !roleLoading && isAuthenticated && isAdminSubdomain()) {
      const emailDomain = user?.email?.split("@")[1]?.toLowerCase();
      if (emailDomain !== "gametaverns.com") {
        console.log('[PlatformAdmin] Email not @gametaverns.com, redirecting to login');
        navigate("/login");
        return;
      }
    }
    // Staff OR admin can access this page
    if (!authLoading && !roleLoading && !isStaff && !isAdmin && isAuthenticated) {
      console.log('[PlatformAdmin] Not staff/admin, redirecting to dashboard');
      navigate(isAdminSubdomain() ? "/login" : "/dashboard");
    }
  }, [isAdmin, isStaff, roleLoading, authLoading, isAuthenticated, navigate, user]);
  
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }
  
  if (!isStaff && !isAdmin) {
    return null;
  }

  const canAccessTab = (tab: string) => {
    if (isAdmin) return true;
    return (STAFF_TABS as readonly string[]).includes(tab);
  };
  
  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBanner />
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-secondary" />
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl font-bold text-cream">
                {t('admin.title')}
              </span>
              {!isAdmin && (
                <Badge variant="secondary" className="text-xs">Staff</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="text-cream hover:text-white hover:bg-wood-medium/50"
              onClick={async () => {
                if (typeof window !== "undefined") {
                  sessionStorage.removeItem(ADMIN_REAUTH_KEY);
                }
                await signOut();
                if (isAdminSubdomain()) {
                  navigate("/login");
                }
              }}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-cream mb-2">
            {t('admin.siteAdmin')}
          </h1>
          <p className="text-cream/70">
            {isAdmin ? t('admin.subtitle') : "Manage users, feedback, and platform operations."}
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-wood-medium/30 border border-wood-medium/50 h-auto flex-wrap gap-1 p-1 w-full overflow-x-auto">
            <TabsTrigger 
              value="analytics" 
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <Activity className="h-4 w-4 mr-1 sm:mr-2" />
              {t('admin.analytics')}
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <Users className="h-4 w-4 mr-1 sm:mr-2" />
              {t('admin.users')}
            </TabsTrigger>
            <TabsTrigger 
              value="libraries"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <Database className="h-4 w-4 mr-1 sm:mr-2" />
              {t('admin.libraries')}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger 
                value="settings"
                className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
              >
                <Settings className="h-4 w-4 mr-1 sm:mr-2" />
                {t('admin.settings')}
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="feedback"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground relative text-xs sm:text-sm"
            >
              <MessageCircle className="h-4 w-4 mr-1 sm:mr-2" />
              {t('admin.feedback')}
              {unreadFeedbackCount && unreadFeedbackCount > 0 && (
                <Badge className="ml-1 h-5 min-w-[20px] px-1 bg-destructive text-destructive-foreground">
                  {unreadFeedbackCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="clubs"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground relative text-xs sm:text-sm"
            >
              <Trophy className="h-4 w-4 mr-1 sm:mr-2" />
              {t('admin.clubs')}
              {pendingClubs && pendingClubs.length > 0 && (
                <Badge className="ml-1 h-5 min-w-[20px] px-1 bg-destructive text-destructive-foreground">
                  {pendingClubs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="health"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <HeartPulse className="h-4 w-4 mr-1 sm:mr-2" />
              {t('admin.health')}
            </TabsTrigger>
            <TabsTrigger 
              value="import-errors"
              className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
            >
              <AlertTriangle className="h-4 w-4 mr-1 sm:mr-2" />
              Import Errors
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger 
                  value="roadmap"
                  className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
                >
                  <Map className="h-4 w-4 mr-1 sm:mr-2" />
                  {t('admin.roadmap')}
                </TabsTrigger>
                <TabsTrigger 
                  value="badges"
                  className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
                >
                  <BadgeCheck className="h-4 w-4 mr-1 sm:mr-2" />
                  {t('admin.badges')}
                </TabsTrigger>
                <TabsTrigger 
                  value="crons"
                  className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
                >
                  <Clock className="h-4 w-4 mr-1 sm:mr-2" />
                  Crons
                </TabsTrigger>
                <TabsTrigger 
                  value="server"
                  className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
                >
                  <Shield className="h-4 w-4 mr-1 sm:mr-2" />
                  {t('admin.server')}
                </TabsTrigger>
                <TabsTrigger 
                  value="security"
                  className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
                >
                  <Shield className="h-4 w-4 mr-1 sm:mr-2" />
                  Security
                </TabsTrigger>
                <TabsTrigger 
                  value="seo"
                  className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
                >
                  <Globe className="h-4 w-4 mr-1 sm:mr-2" />
                  SEO Pages
                </TabsTrigger>
                <TabsTrigger 
                  value="email-analytics"
                  className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm"
                >
                  <Mail className="h-4 w-4 mr-1 sm:mr-2" />
                  Email Analytics
                </TabsTrigger>
              </>
            )}
          </TabsList>
          
          <TabsContent value="analytics" className="mt-6">
            <PlatformAnalytics />
          </TabsContent>
          
          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>
          
          <TabsContent value="libraries" className="mt-6">
            <LibraryManagement />
          </TabsContent>
          
          {isAdmin && (
            <TabsContent value="settings" className="mt-6">
              <PlatformSettings />
            </TabsContent>
          )}
          
          <TabsContent value="feedback" className="mt-6">
            <FeedbackManagement />
          </TabsContent>
          
          <TabsContent value="clubs" className="mt-6">
            <ClubsManagement />
          </TabsContent>
          
          <TabsContent value="health" className="mt-6">
            <SystemHealth />
          </TabsContent>

          <TabsContent value="import-errors" className="mt-6">
            <TabErrorBoundary>
              <Suspense fallback={<div className="text-cream/70 text-sm p-4">Loading import errors…</div>}>
                <ImportErrorsPanel />
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>
          
          {isAdmin && (
            <>
              <TabsContent value="roadmap" className="mt-6">
                <PlatformRoadmap />
              </TabsContent>

              <TabsContent value="badges" className="mt-6">
                <TabErrorBoundary>
                  <Suspense fallback={<div className="text-cream/70 text-sm p-4">{t('admin.loadingBadges')}</div>}>
                    <SpecialBadgesManagement />
                  </Suspense>
                </TabErrorBoundary>
              </TabsContent>

              <TabsContent value="crons" className="mt-6">
                <TabErrorBoundary>
                  <Suspense fallback={<div className="text-cream/70 text-sm p-4">Loading cron monitor…</div>}>
                    <CronJobsMonitor />
                  </Suspense>
                </TabErrorBoundary>
              </TabsContent>

              <TabsContent value="server" className="mt-6">
                <TabErrorBoundary>
                  <Suspense fallback={<div className="text-cream/70 text-sm p-4">{t('admin.loadingServer')}</div>}>
                    <ServerManagement />
                  </Suspense>
                </TabErrorBoundary>
              </TabsContent>

              <TabsContent value="security" className="mt-6">
                <TabErrorBoundary>
                  <Suspense fallback={<div className="text-cream/70 text-sm p-4">Loading security logs…</div>}>
                    <AuditLogViewer />
                  </Suspense>
                </TabErrorBoundary>
              </TabsContent>

              <TabsContent value="seo" className="mt-6">
                <TabErrorBoundary>
                  <Suspense fallback={<div className="text-cream/70 text-sm p-4">Loading SEO directory…</div>}>
                    <SeoDirectory />
                  </Suspense>
                </TabErrorBoundary>
              </TabsContent>

              <TabsContent value="email-analytics" className="mt-6">
                <TabErrorBoundary>
                  <Suspense fallback={<div className="text-cream/70 text-sm p-4">Loading email analytics…</div>}>
                    <EmailEngagementAnalytics />
                  </Suspense>
                </TabErrorBoundary>
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
}
