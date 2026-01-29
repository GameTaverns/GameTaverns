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
import { DemoGuard } from "@/components/system/DemoGuard";
import { MaintenanceGuard } from "@/components/system/MaintenanceGuard";
import { TestingEnvironmentBanner } from "@/components/layout/TestingEnvironmentBanner";
import { MobileAppShell } from "@/components/mobile/MobileAppShell";

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
const About = lazy(() => import("./pages/About"));

// Platform pages (multi-tenant)
const Platform = lazy(() => import("./pages/Platform"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateLibrary = lazy(() => import("./pages/CreateLibrary"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin"));

// Library admin pages
const LibrarySettings = lazy(() => import("./pages/LibrarySettings"));
const LibraryGames = lazy(() => import("./pages/LibraryGames"));
const PollPage = lazy(() => import("./pages/PollPage"));

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
              <TenantRouteHandler isDemoMode={isDemoMode} tenantSlug={tenantSlug} />
            </Suspense>
          </MaintenanceGuard>
          
          {/* Testing environment watermark */}
          <TestingEnvironmentBanner />
        </MobileAppShell>
      </DemoProvider>
    </TenantProvider>
  );
}

// Handle routing based on tenant state
function TenantRouteHandler({ isDemoMode, tenantSlug }: { isDemoMode: boolean; tenantSlug: string | null }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const pathParam = searchParams.get("path");
  const tabParam = searchParams.get("tab");
  const { isLoading, isSuspended, suspendedLibraryName, suspensionReason } = useTenant();
  
  // Handle path parameter navigation within tenant context
  // Do this synchronously before rendering to avoid flash
  useEffect(() => {
    if (tenantSlug && pathParam && location.pathname === "/") {
      // Build the new URL params without the path parameter
      const newParams = new URLSearchParams();
      newParams.set("tenant", tenantSlug);
      if (tabParam) {
        newParams.set("tab", tabParam);
      }
      // Navigate to the actual path (client-side) to avoid white flicker
      navigate(`${pathParam}?${newParams.toString()}`, { replace: true });
    }
  }, [tenantSlug, pathParam, tabParam, location.pathname, navigate]);
  
  // Show loading while redirect is in progress or tenant is loading
  if ((tenantSlug && pathParam && location.pathname === "/") || (tenantSlug && isLoading)) {
    return (
      <div className="min-h-screen parchment-texture flex items-center justify-center animate-fade-in">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  // If library is suspended, show the suspended page
  if (tenantSlug && isSuspended) {
    return <LibrarySuspended libraryName={suspendedLibraryName || undefined} suspensionReason={suspensionReason} />;
  }
  
  // If tenant slug is in URL, show library routes
  if (tenantSlug) {
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
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/create-library" element={<CreateLibrary />} />
      <Route path="/admin" element={<PlatformAdmin />} />
      <Route path="/docs" element={<Docs />} />
      {/* Legal & Info pages */}
      <Route path="/legal" element={<Legal />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/about" element={<About />} />
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
      <Route path="/poll/:token" element={<PollPage />} />
      
      {/* Docs accessible from library too */}
      <Route path="/docs" element={<Docs />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
