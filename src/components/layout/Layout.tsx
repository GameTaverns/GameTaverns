import { useState, useEffect } from "react";
import { AppHeader } from "./AppHeader";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { OwnerAdminBar } from "./OwnerAdminBar";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

export function Layout({ children, hideSidebar = false }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isTenantMode } = useTenant();
  const [hasBodyBg, setHasBodyBg] = useState(false);

  // Show sidebar only on library pages
  const showSidebar = isTenantMode && !hideSidebar;

  // Sync with body class set by TenantThemeApplicator
  useEffect(() => {
    const check = () => setHasBodyBg(document.body.classList.contains("has-background-image"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("min-h-screen flex flex-col", hasBodyBg ? "bg-transparent" : "bg-background")}>
      <OwnerAdminBar />
      <AnnouncementBanner />
      <AppHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} showMenuToggle={showSidebar} />

      {showSidebar && <Sidebar isOpen={sidebarOpen} />}

      {/* Click overlay to close sidebar on mobile */}
      {showSidebar && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main
        className={cn(
          "container max-w-[2000px] py-4 sm:py-8 px-3 sm:px-4 lg:px-8 pb-16 flex-1",
          showSidebar && "lg:pl-80"
        )}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
