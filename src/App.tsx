import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ThemeApplicator } from "@/components/ThemeApplicator";
import Index from "./pages/Index";
import GameDetail from "./pages/GameDetail";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import GameForm from "./pages/GameForm";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeApplicator />
        <BrowserRouter>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/game/:slug" element={<GameDetail />} />
            <Route path="/admin" element={<Login />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin/add" element={<GameForm />} />
            <Route path="/admin/edit/:id" element={<GameForm />} />
            <Route path="/admin/messages" element={<Messages />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
