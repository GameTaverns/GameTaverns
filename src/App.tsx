import { Suspense, lazy, useEffect } from "react";
import { lazyRetry } from "@/lib/lazyRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { ThemeProvider } from "next-themes";
import { ThemeApplicator } from "@/components/ThemeApplicator";
import { TenantThemeApplicator } from "@/components/TenantThemeApplicator";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { TourProvider } from "@/contexts/TourContext";
import { MaintenanceGuard } from "@/components/system/MaintenanceGuard";
import { TestingEnvironmentBanner } from "@/components/layout/TestingEnvironmentBanner";
import { MobileAppShell } from "@/components/mobile/MobileAppShell";
import { isProductionDeployment } from "@/config/runtime";
import { GlobalFeedbackButton } from "@/components/feedback/FeedbackDialog";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { PresenceTracker } from "@/components/social/PresenceTracker";
import { GlobalDMListener } from "@/components/social/GlobalDMListener";
import { DMPopupManager } from "@/components/social/DMPopupManager";
import { useMobileLibrary } from "@/hooks/useCapacitor";

// Lazy load route components to reduce initial bundle size
const Index = lazy(lazyRetry(() => import("./pages/Index")));
const GameDetail = lazy(lazyRetry(() => import("./pages/GameDetail")));
const Login = lazy(lazyRetry(() => import("./pages/Login")));
const Settings = lazy(lazyRetry(() => import("./pages/Settings")));
const GameForm = lazy(lazyRetry(() => import("./pages/GameForm")));
const NotFound = lazy(lazyRetry(() => import("./pages/NotFound")));
const Docs = lazy(lazyRetry(() => import("./pages/Docs")));
const LibrarySuspended = lazy(lazyRetry(() => import("./pages/LibrarySuspended")));

// Legal & Info pages
const Legal = lazy(lazyRetry(() => import("./pages/Legal")));
const Privacy = lazy(lazyRetry(() => import("./pages/Privacy")));
const Terms = lazy(lazyRetry(() => import("./pages/Terms")));
const Cookies = lazy(lazyRetry(() => import("./pages/Cookies")));


// Platform pages (multi-tenant)
const Platform = lazy(lazyRetry(() => import("./pages/Platform")));
const Features = lazy(lazyRetry(() => import("./pages/Features")));
const Press = lazy(lazyRetry(() => import("./pages/Press")));
const Dashboard = lazy(lazyRetry(() => import("./pages/Dashboard")));
const CreateLibrary = lazy(lazyRetry(() => import("./pages/CreateLibrary")));
const Signup = lazy(lazyRetry(() => import("./pages/Signup")));
const ForgotPassword = lazy(lazyRetry(() => import("./pages/ForgotPassword")));
const ResetPassword = lazy(lazyRetry(() => import("./pages/ResetPassword")));
const VerifyEmail = lazy(lazyRetry(() => import("./pages/VerifyEmail")));

const Setup2FA = lazy(lazyRetry(() => import("./pages/Setup2FA")));
const Directory = lazy(lazyRetry(() => import("./pages/Directory")));
const Achievements = lazy(lazyRetry(() => import("./pages/Achievements")));
const Community = lazy(lazyRetry(() => import("./pages/Community")));
const ThreadDetail = lazy(lazyRetry(() => import("./pages/ThreadDetail")));
const ClubPage = lazy(lazyRetry(() => import("./pages/ClubPage")));
const ClubDashboard = lazy(lazyRetry(() => import("./pages/ClubDashboard")));
const RequestClub = lazy(lazyRetry(() => import("./pages/RequestClub")));
const JoinClub = lazy(lazyRetry(() => import("./pages/JoinClub")));

// Library admin pages
const LibrarySettings = lazy(lazyRetry(() => import("./pages/LibrarySettings")));
const LibraryGames = lazy(lazyRetry(() => import("./pages/LibraryGames")));
const ManageGames = lazy(lazyRetry(() => import("./pages/ManageGames")));
const PlayStatsPage = lazy(lazyRetry(() => import("./pages/PlayStatsPage")));
const PollPage = lazy(lazyRetry(() => import("./pages/PollPage")));
const CatalogPrint = lazy(lazyRetry(() => import("./pages/CatalogPrint")));
const SmartPicker = lazy(lazyRetry(() => import("./pages/SmartPicker")));
const CatalogBrowse = lazy(lazyRetry(() => import("./pages/CatalogBrowse")));
const CatalogGameDetail = lazy(lazyRetry(() => import("./pages/CatalogGameDetail")));
const Install = lazy(lazyRetry(() => import("./pages/Install")));
const UserProfile = lazy(lazyRetry(() => import("./pages/UserProfile")));
const DashboardEditor = lazy(lazyRetry(() => import("./components/dashboard/editor/DashboardEditorPage")));
const NotificationsPage = lazy(lazyRetry(() => import("./pages/NotificationsPage")));
const DirectMessages = lazy(lazyRetry(() => import("./pages/DirectMessages")));
const CuratedLists = lazy(lazyRetry(() => import("./pages/CuratedLists")));
const CuratedListDetail = lazy(lazyRetry(() => import("./pages/CuratedListDetail")));

// SEO landing pages
const GamesForNPlayers = lazy(lazyRetry(() => import("./pages/seo/GamesForNPlayers")));
const MechanicPage = lazy(lazyRetry(() => import("./pages/seo/MechanicPage")));
const MechanicsIndex = lazy(lazyRetry(() => import("./pages/seo/MechanicsIndex")));
const LibrariesInCity = lazy(lazyRetry(() => import("./pages/seo/LibrariesInCity")));
const EventsInCity = lazy(lazyRetry(() => import("./pages/seo/EventsInCity")));
const GameCalendar = lazy(lazyRetry(() => import("./pages/GameCalendar")));
const EventDetailPage = lazy(lazyRetry(() => import("./pages/EventDetailPage")));
const PublicEventDirectory = lazy(lazyRetry(() => import("./pages/PublicEventDirectory")));

// Growth pages
const ShareCard = lazy(lazyRetry(() => import("./pages/ShareCard")));
const Grow = lazy(lazyRetry(() => import("./pages/Grow")));
const EmbedWidget = lazy(lazyRetry(() => import("./pages/EmbedWidget")));

// Studio pages (studio.gametaverns.com)
const StudioLogin = lazy(() => import("./pages/StudioLogin"));
const StudioDashboard = lazy(() => import("./pages/StudioDashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes before data is considered stale
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      refetchOnWindowFocus: false, // Don't refetch on every tab switch
      retry: 1, // Only retry once on failure
    },
  },
});

// Simple loading fallback
const PageLoader = () => (
  <div className="min-h-screen parchment-texture flex items-center justify-center animate-fade-in">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

// Platform-level routes that should NEVER be treated as tenant/library routes,
// even when a library is active on native.
const PLATFORM_PATHS = [
  '/dashboard', '/catalog', '/dm', '/docs', '/directory', '/achievements',
  '/community', '/club', '/u/', '/lists', '/create-library', '/studio',
  '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email',
  '/admin', '/setup-2fa', '/install', '/features', '/picker', '/request-club',
  '/join-club', '/legal', '/privacy', '/terms', '/cookies', '/games-for-',
  '/libraries/', '/share-card', '/grow', '/embed',
];

function isPlatformPath(pathname: string): boolean {
  return PLATFORM_PATHS.some(p => pathname === p || pathname.startsWith(p));
}


/**
 * Get the real active path for platform detection on native.
 * window.location.hash looks like '#/dashboard' or '#/dashboard?tenant=x'
 * Strip the leading '#' and any query string to get the pathname.
 */
function getNativeEffectivePath(): string {
  if (typeof window === 'undefined') return '/';
  const hash = window.location.hash; // e.g. '#/dashboard?tenant=x'
  if (!hash || !hash.startsWith('#')) return '/';
  const withoutHash = hash.slice(1); // '/dashboard?tenant=x'
  const qIndex = withoutHash.indexOf('?');
  return qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
}

// Wrapper component to check for tenant mode
function AppRoutes() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Always call the hook (rules of hooks) — on web it's a no-op (returns null)
  const { activeLibrary } = useMobileLibrary();

  // On native (HashRouter), location.pathname correctly reflects the hash-based route
  // (e.g. '/dashboard', '/catalog') because useLocation() inside HashRouter extracts it.
  // However window.location.hash is the fallback for edge cases during initial render.
  const effectivePath = isRunningNative()
    ? (location.pathname !== '/' ? location.pathname : getNativeEffectivePath())
    : location.pathname;

  const isOnPlatformPath = isPlatformPath(effectivePath);
  const tenantSlug = searchParams.get("tenant") || (isRunningNative() && !isOnPlatformPath ? activeLibrary : null);

  // Inject ?tenant= ONLY for library routes on native, never for platform routes.
  useEffect(() => {
    if (!isRunningNative() || !activeLibrary) return;
    if (isOnPlatformPath) return;
    const currentTenant = new URLSearchParams(location.search).get("tenant");
    if (!currentTenant || currentTenant !== activeLibrary) {
      const newParams = new URLSearchParams(location.search);
      newParams.set("tenant", activeLibrary);
      navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
    }
  }, [activeLibrary, location.search, location.pathname, navigate, isOnPlatformPath]);

  return (
    <TenantProvider>
      {/* Theme applicators */}
      <ThemeApplicator />
      <TenantThemeApplicator />
      
      <MobileAppShell>
        <MaintenanceGuard>
          <Suspense fallback={<PageLoader />}>
            <TenantRouteHandler tenantSlugFromParam={tenantSlug} />
          </Suspense>
        </MaintenanceGuard>
        
        {/* Testing environment watermark - hidden in production deployments */}
        {!isProductionDeployment() && <TestingEnvironmentBanner />}
      </MobileAppShell>
      <DMPopupManager />
    </TenantProvider>
  );
}


// Handle routing based on tenant state
function TenantRouteHandler({ tenantSlugFromParam }: { tenantSlugFromParam: string | null }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const pathParam = searchParams.get("path");
  const tabParam = searchParams.get("tab");
  
  // CRITICAL: Use the tenant slug from TenantContext which handles BOTH:
  // 1. Query param (?tenant=slug) for Lovable preview
  // 2. Subdomain detection (slug.gametaverns.com) for production
  const { isLoading, isSuspended, suspendedLibraryName, suspensionReason, tenantSlug, isTenantMode } = useTenant();
  
  // Handle path parameter navigation within tenant context
  // Do this synchronously before rendering to avoid flash
  useEffect(() => {
    if (tenantSlugFromParam && pathParam && location.pathname === "/") {
      // Build the new URL params without the path parameter
      const newParams = new URLSearchParams();
      newParams.set("tenant", tenantSlugFromParam);
      if (tabParam) {
        newParams.set("tab", tabParam);
      }
      // Navigate to the actual path (client-side) to avoid white flicker
      navigate(`${pathParam}?${newParams.toString()}`, { replace: true });
    }
  }, [tenantSlugFromParam, pathParam, tabParam, location.pathname, navigate]);
  
  // Show loading while redirect is in progress
  // IMPORTANT: For platform mode (no tenant), don't wait for tenant loading
  if (tenantSlugFromParam && pathParam && location.pathname === "/") {
    return (
      <div className="min-h-screen parchment-texture flex items-center justify-center animate-fade-in">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  // Only show loading spinner for tenant mode while tenant data loads
  if (isTenantMode && isLoading) {
    return (
      <div className="min-h-screen parchment-texture flex items-center justify-center animate-fade-in">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  // If library is suspended, show the suspended page
  if (isTenantMode && isSuspended) {
    return <LibrarySuspended libraryName={suspendedLibraryName || undefined} suspensionReason={suspensionReason} />;
  }
  
  // If tenant detected (via subdomain OR query param), show library routes
  if (isTenantMode) {
    return <LibraryRoutes />;
  }

  // Platform mode - show marketing/dashboard routes
  return <PlatformRoutes />;
}

// Routes for the platform (gametaverns.com)
function PlatformRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Platform />} />
      <Route path="/features" element={<Features />} />
      <Route path="/press" element={<Press />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/editor" element={<DashboardEditor />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/create-library" element={<CreateLibrary />} />
      <Route path="/setup-2fa" element={<Setup2FA />} />
      <Route path="/admin" element={<Navigate to="/dashboard?tab=admin" replace />} />
      {/* Studio — internal portal for @gametaverns.com emails */}
      <Route path="/studio" element={<StudioDashboard />} />
      <Route path="/studio/login" element={<StudioLogin />} />
      <Route path="/directory" element={<Directory />} />
      <Route path="/achievements" element={<Achievements />} />
      <Route path="/community" element={<Community />} />
      <Route path="/community/:categorySlug" element={<Community />} />
      <Route path="/community/thread/:threadId" element={<ThreadDetail />} />
      <Route path="/club/:slug" element={<ClubPage />} />
      <Route path="/club/:slug/forum/:categorySlug" element={<ClubPage />} />
      <Route path="/club/:slug/manage" element={<ClubDashboard />} />
      <Route path="/request-club" element={<RequestClub />} />
      <Route path="/join-club" element={<JoinClub />} />
      <Route path="/picker" element={<SmartPicker />} />
      <Route path="/catalog" element={<CatalogBrowse />} />
      <Route path="/catalog/:slug" element={<CatalogGameDetail />} />
      <Route path="/install" element={<Install />} />
      <Route path="/docs" element={<Docs />} />
      {/* Legal & Info pages */}
      <Route path="/legal" element={<Legal />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/cookies" element={<Cookies />} />
      {/* User profiles */}
      <Route path="/u/:username" element={<UserProfile />} />
      {/* Direct Messages */}
      <Route path="/dm" element={<DirectMessages />} />
      <Route path="/dm/:userId" element={<DirectMessages />} />
      <Route path="/lists" element={<CuratedLists />} />
      <Route path="/lists/:listId" element={<CuratedListDetail />} />

      {/* SEO landing pages */}
      <Route path="/games-for-:slug" element={<GamesForNPlayers />} />
      <Route path="/catalog/mechanics" element={<MechanicsIndex />} />
      <Route path="/catalog/mechanic/:slug" element={<MechanicPage />} />
      <Route path="/libraries/:city" element={<LibrariesInCity />} />
      <Route path="/events/:city" element={<EventsInCity />} />
      <Route path="/events" element={<PublicEventDirectory />} />
      <Route path="/event/:eventId" element={<EventDetailPage />} />

      {/* Growth pages */}
      <Route path="/share-card" element={<ShareCard />} />
      <Route path="/grow" element={<Grow />} />
      <Route path="/referrals" element={<Navigate to="/grow" replace />} />
      <Route path="/embed" element={<EmbedWidget />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Routes for individual libraries (library.gametaverns.com or ?tenant=slug)
function LibraryRoutes() {
  return (
    <Routes>
      {/* Public library views */}
      <Route path="/" element={<Index />} />
      <Route path="/game/:slug" element={<GameDetail />} />
      
      {/* Library owner routes - accessed via /settings, /games, etc. */}
      <Route path="/login" element={<Login />} />
      <Route path="/settings" element={<LibrarySettings />} />
      <Route path="/games" element={<LibraryGames />} />
      <Route path="/manage" element={<ManageGames />} />
      <Route path="/add" element={<GameForm />} />
      <Route path="/edit/:id" element={<GameForm />} />
      <Route path="/stats" element={<PlayStatsPage />} />
      <Route path="/poll/:token" element={<PollPage />} />
      <Route path="/calendar" element={<GameCalendar />} />
      <Route path="/event/:eventId" element={<EventDetailPage />} />
      <Route path="/events" element={<PublicEventDirectory />} />
      <Route path="/catalog-print" element={<CatalogPrint />} />
      
      {/* Community/Forum routes for library */}
      <Route path="/community" element={<Community />} />
      <Route path="/community/:categorySlug" element={<Community />} />
      <Route path="/community/thread/:threadId" element={<ThreadDetail />} />

      {/* Curated Lists */}
      <Route path="/lists" element={<CuratedLists />} />
      <Route path="/lists/:listId" element={<CuratedListDetail />} />
      
      {/* Docs & Legal pages accessible from library too */}
      <Route path="/docs" element={<Docs />} />
      <Route path="/legal" element={<Legal />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/cookies" element={<Cookies />} />

      {/* Platform routes accessible from library context (native: always in tenant mode) */}
      <Route path="/directory" element={<Directory />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/catalog" element={<CatalogBrowse />} />
      <Route path="/catalog/:slug" element={<CatalogGameDetail />} />
      <Route path="/dm" element={<DirectMessages />} />
      <Route path="/dm/:userId" element={<DirectMessages />} />
      <Route path="/achievements" element={<Achievements />} />
      <Route path="/u/:username" element={<UserProfile />} />
      <Route path="/lists" element={<CuratedLists />} />
      <Route path="/lists/:listId" element={<CuratedListDetail />} />
      <Route path="/club/:slug" element={<ClubPage />} />
      <Route path="/club/:slug/manage" element={<ClubDashboard />} />
      <Route path="/picker" element={<SmartPicker />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Use HashRouter on native Capacitor (capacitor://localhost doesn't support History API)
// Use BrowserRouter on web (supports clean URLs)
//
// IMPORTANT: We cannot use Capacitor.isNativePlatform() here because it is evaluated
// at module-load time, before the Capacitor bridge fires its ready event on the device.
// Instead we use hostname detection which is reliable from frame 0:
//   - Android bundled APK → hostname is "localhost"
//   - iOS bundled IPA     → hostname is "localhost" (scheme: capacitor://)
//   - Any web/Lovable URL → hostname is never "localhost"
function isRunningNative(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  // Only treat localhost as native if NOT running on a standard dev port (Vite/webpack).
  // This prevents local web development from incorrectly routing through HashRouter.
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    const p = window.location.port;
    const isDevServer = ['5173', '5174', '3000', '3001', '4173', '8080'].includes(p);
    if ((h === 'localhost' || h === '127.0.0.1') && !isDevServer) return true;
  }
  return false;
}
const RouterComponent = isRunningNative() ? HashRouter : BrowserRouter;

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterComponent>
          <AuthProvider>
            <TourProvider>
              {/* Skip to content link for keyboard/screen reader users */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
              >
                Skip to main content
              </a>
              <Toaster />
              <Sonner />
              <PresenceTracker />
              <GlobalDMListener />
              <AppRoutes />
              <GlobalFeedbackButton />
              <CookieConsent />
            </TourProvider>
          </AuthProvider>
        </RouterComponent>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
