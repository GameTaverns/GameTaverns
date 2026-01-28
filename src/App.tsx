import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ThemeApplicator } from "@/components/ThemeApplicator";
import { DemoThemeApplicator } from "@/components/DemoThemeApplicator";
import { TenantThemeApplicator } from "@/components/TenantThemeApplicator";
import { DemoProvider } from "@/contexts/DemoContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { DemoGuard } from "@/components/system/DemoGuard";

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

// Platform pages (multi-tenant)
const Platform = lazy(() => import("./pages/Platform"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateLibrary = lazy(() => import("./pages/CreateLibrary"));
const Signup = lazy(() => import("./pages/Signup"));

// Library admin pages
const LibrarySettings = lazy(() => import("./pages/LibrarySettings"));
const LibraryGames = lazy(() => import("./pages/LibraryGames"));

const queryClient = new QueryClient();

// Simple loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
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
        
        <Suspense fallback={<PageLoader />}>
          <TenantRouteHandler isDemoMode={isDemoMode} tenantSlug={tenantSlug} />
        </Suspense>
      </DemoProvider>
    </TenantProvider>
  );
}

// Handle routing based on tenant state
function TenantRouteHandler({ isDemoMode, tenantSlug }: { isDemoMode: boolean; tenantSlug: string | null }) {
  const [searchParams] = useSearchParams();
  const pathParam = searchParams.get("path");
  
  // If tenant slug is in URL, show library routes
  if (tenantSlug) {
    // Handle path parameter for navigation within tenant
    if (pathParam) {
      // Navigate to the path within the tenant context
      window.history.replaceState(null, "", `${pathParam}?tenant=${tenantSlug}`);
    }
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
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/create-library" element={<CreateLibrary />} />
      <Route path="/docs" element={<Docs />} />
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
      
      {/* Admin routes (library owner only) */}
      <Route path="/admin" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/settings" element={<LibrarySettings />} />
      <Route path="/admin/settings" element={<LibrarySettings />} />
      <Route path="/admin/games" element={<LibraryGames />} />
      <Route path="/admin/add" element={<GameForm />} />
      <Route path="/admin/edit/:id" element={<GameForm />} />
      <Route path="/admin/messages" element={<Messages />} />
      
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
