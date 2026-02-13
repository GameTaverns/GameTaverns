import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ThemeApplicator } from "@/components/ThemeApplicator";
import { DemoThemeApplicator } from "@/components/DemoThemeApplicator";
import { TenantThemeApplicator } from "@/components/TenantThemeApplicator";
import { DemoProvider } from "@/contexts/DemoContext";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoGuard } from "@/components/system/DemoGuard";
import { MaintenanceGuard } from "@/components/system/MaintenanceGuard";
import { TestingEnvironmentBanner } from "@/components/layout/TestingEnvironmentBanner";
import { MobileAppShell } from "@/components/mobile/MobileAppShell";
import { isProductionDeployment } from "@/config/runtime";

// Lazy load route components to reduce initial bundle size
const Index = lazy(() => import("./pages/Index"));
const GameDetail = lazy(() => import("./pages/GameDetail"));
const Login = lazy(() => import("./pages/Login"));
const Settings = lazy(() => import("./pages/Settings"));
const GameForm = lazy(() => import("./pages/GameForm"));
const Messages = lazy(() => import("./pages/Messages"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DemoSettings = lazy(() => import("./pages/DemoSettings"));
const DemoGameForm = lazy(() => import("./pages/DemoGameForm"));
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
const PlayStatsPage = lazy(() => import("./pages/PlayStatsPage"));
const PollPage = lazy(() => import("./pages/PollPage"));
const SmartPicker = lazy(() => import("./pages/SmartPicker"));

const queryClient = new QueryClient();

// Simple loading fallback
const PageLoader = () => (
  <div className="min-h-screen parchment-texture flex items-center justify-center animate-fade-in">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

// Wrapper component to check for demo mode and tenant mode
function AppRoutes() {
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get("demo") === "true" || 
    window.location.pathname.startsWith("/demo");
  const tenantSlug = searchParams.get("tenant");

  return (
    <TenantProvider>
      <DemoProvider enabled={isDemoMode}>
        {/* Theme applicators */}
        <ThemeApplicator />
        <DemoThemeApplicator />
        <TenantThemeApplicator />
        
        <MobileAppShell>
          <MaintenanceGuard>
            <Suspense fallback={<PageLoader />}>
              <TenantRouteHandler isDemoMode={isDemoMode} tenantSlugFromParam={tenantSlug} />
            </Suspense>
          </MaintenanceGuard>
          
          {/* Testing environment watermark - hidden in production deployments */}
          {!isProductionDeployment() && <TestingEnvironmentBanner />}
        </MobileAppShell>
      </DemoProvider>
    </TenantProvider>
  );
}

// Handle routing based on tenant state
function TenantRouteHandler({ isDemoMode, tenantSlugFromParam }: { isDemoMode: boolean; tenantSlugFromParam: string | null }) {
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
    return <LibraryRoutes isDemoMode={isDemoMode} />;
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
      <Route path="/create-library" element={<CreateLibrary />} />
      <Route path="/setup-2fa" element={<Setup2FA />} />
      <Route path="/admin" element={<PlatformAdmin />} />
      <Route path="/directory" element={<Directory />} />
      <Route path="/achievements" element={<Achievements />} />
      <Route path="/community" element={<Community />} />
      <Route path="/community/:categorySlug" element={<Community />} />
      <Route path="/community/thread/:threadId" element={<ThreadDetail />} />
      <Route path="/club/:slug" element={<ClubPage />} />
      <Route path="/club/:slug/manage" element={<ClubDashboard />} />
      <Route path="/request-club" element={<RequestClub />} />
      <Route path="/join-club" element={<JoinClub />} />
      <Route path="/picker" element={<SmartPicker />} />
      <Route path="/docs" element={<Docs />} />
      {/* Legal & Info pages */}
      <Route path="/legal" element={<Legal />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/cookies" element={<Cookies />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Routes for individual libraries (library.gametaverns.com or ?tenant=slug)
function LibraryRoutes({ isDemoMode }: { isDemoMode: boolean }) {
  return (
    <Routes>
      {/* Public library views */}
      <Route path="/" element={<Index />} />
      <Route path="/game/:slug" element={<GameDetail />} />
      
      {/* Demo mode routes */}
      <Route path="/demo/game/:slug" element={
        <DemoGuard><GameDetail /></DemoGuard>
      } />
      <Route path="/demo/settings" element={
        <DemoGuard><DemoSettings /></DemoGuard>
      } />
      <Route path="/demo/add" element={
        <DemoGuard><DemoGameForm /></DemoGuard>
      } />
      <Route path="/demo/edit/:id" element={
        <DemoGuard><DemoGameForm /></DemoGuard>
      } />
      
      {/* Library owner routes - accessed via /settings, /games, etc. */}
      <Route path="/login" element={<Login />} />
      <Route path="/settings" element={<LibrarySettings />} />
      <Route path="/games" element={<LibraryGames />} />
      <Route path="/add" element={<GameForm />} />
      <Route path="/edit/:id" element={<GameForm />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/stats" element={<PlayStatsPage />} />
      <Route path="/poll/:token" element={<PollPage />} />
      
      {/* Community/Forum routes for library */}
      <Route path="/community" element={<Community />} />
      <Route path="/community/:categorySlug" element={<Community />} />
      <Route path="/community/thread/:threadId" element={<ThreadDetail />} />
      
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
            <Toaster />
            <Sonner />
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
