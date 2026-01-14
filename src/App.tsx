import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ThemeApplicator } from "@/components/ThemeApplicator";
import { DemoProvider } from "@/contexts/DemoContext";

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

const queryClient = new QueryClient();

// Simple loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

// Wrapper component to check for demo mode
function AppRoutes() {
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get("demo") === "true" || 
    window.location.pathname.startsWith("/demo");

  return (
    <DemoProvider enabled={isDemoMode}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/game/:slug" element={<GameDetail />} />
          <Route path="/admin" element={<Login />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin/add" element={<GameForm />} />
          <Route path="/admin/edit/:id" element={<GameForm />} />
          <Route path="/admin/messages" element={<Messages />} />
          <Route path="/demo/settings" element={<DemoSettings />} />
          <Route path="/demo/add" element={<DemoGameForm />} />
          <Route path="/demo/edit/:id" element={<DemoGameForm />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </DemoProvider>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeApplicator />
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
