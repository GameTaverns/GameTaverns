import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useSearchParams, useLocation, useNavigate } from "react-router-dom";
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
import { PresenceTracker } from "@/components/social/PresenceTracker";
import { DMPopupManager } from "@/components/social/DMPopupManager";

// Lazy load route components to reduce initial bundle size
const Index = lazy(() => import("./pages/Index"));
const GameDetail = lazy(() => import("./pages/GameDetail"));
const Login = lazy(() => import("./pages/Login"));
const Settings = lazy(() => import("./pages/Settings"));
const GameForm = lazy(() => import("./pages/GameForm"));
const Messages = lazy(() => import("./pages/Messages"));
const Inbox = lazy(() => import("./pages/Inbox"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Docs = lazy(() => import("./pages/Docs"));
const LibrarySuspended = lazy(() => import("./pages/LibrarySuspended"));

// Legal & Info pages
const Legal = lazy(() => import("./pages/Legal"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Cookies = lazy(() => import("./pages/Cookies"));


// Platform pages (multi-tenant)
const Platform = lazy(() => import("./pages/Platform"));
const Features = lazy(() => import("./pages/Features"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateLibrary = lazy(() => import("./pages/CreateLibrary"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin"));
const Setup2FA = lazy(() => import("./pages/Setup2FA"));
const Directory = lazy(() => import("./pages/Directory"));
const Achievements = lazy(() => import("./pages/Achievements"));
const Community = lazy(() => import("./pages/Community"));
const ThreadDetail = lazy(() => import("./pages/ThreadDetail"));
const ClubPage = lazy(() => import("./pages/ClubPage"));
const ClubDashboard = lazy(() => import("./pages/ClubDashboard"));
const RequestClub = lazy(() => import("./pages/RequestClub"));
const JoinClub = lazy(() => import("./pages/JoinClub"));

// Library admin pages
const LibrarySettings = lazy(() => import("./pages/LibrarySettings"));
const LibraryGames = lazy(() => import("./pages/LibraryGames"));
const ManageGames = lazy(() => import("./pages/ManageGames"));
const PlayStatsPage = lazy(() => import("./pages/PlayStatsPage"));
const PollPage = lazy(() => import("./pages/PollPage"));
const SmartPicker = lazy(() => import("./pages/SmartPicker"));
const CatalogBrowse = lazy(() => import("./pages/CatalogBrowse"));
const CatalogGameDetail = lazy(() => import("./pages/CatalogGameDetail"));
const Install = lazy(() => import("./pages/Install"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const DashboardEditor = lazy(() => import("./components/dashboard/editor/DashboardEditorPage"));
const DirectMessages = lazy(() => import("./pages/DirectMessages"));
const CuratedLists = lazy(() => import("./pages/CuratedLists"));
const CuratedListDetail = lazy(() => import("./pages/CuratedListDetail"));

// SEO landing pages
const GamesForNPlayers = lazy(() => import("./pages/seo/GamesForNPlayers"));
const MechanicPage = lazy(() => import("./pages/seo/MechanicPage"));
const MechanicsIndex = lazy(() => import("./pages/seo/MechanicsIndex"));

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

// Wrapper component to check for tenant mode
function AppRoutes() {
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get("tenant");

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
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/inbox" element={<Inbox />} />
      <Route path="/dashboard/editor" element={<DashboardEditor />} />
      <Route path="/create-library" element={<CreateLibrary />} />
      <Route path="/setup-2fa" element={<Setup2FA />} />
      <Route path="/admin" element={<PlatformAdmin />} />
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
      <Route path="/games-for-:count-players" element={<GamesForNPlayers />} />
      <Route path="/catalog/mechanics" element={<MechanicsIndex />} />
      <Route path="/catalog/mechanic/:slug" element={<MechanicPage />} />
      
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
      <Route path="/messages" element={<Messages />} />
      <Route path="/stats" element={<PlayStatsPage />} />
      <Route path="/poll/:token" element={<PollPage />} />
      
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
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <TourProvider>
              <Toaster />
              <Sonner />
              <PresenceTracker />
              <AppRoutes />
              <GlobalFeedbackButton />
            </TourProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
