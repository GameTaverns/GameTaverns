import { useState } from "react";
import { AppHeader } from "./AppHeader";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { OwnerAdminBar } from "./OwnerAdminBar";
import { MobileBottomTabs } from "@/components/mobile/MobileBottomTabs";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

export function Layout({ children, hideSidebar = false }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isTenantMode } = useTenant();

  // Show sidebar only on library pages
  const showSidebar = isTenantMode && !hideSidebar;

  return (
    // parchment-texture handles both the normal bg and the semi-transparent
    // overlay when a body background image is active (via CSS in index.css)
    <div className={cn("min-h-screen parchment-texture flex flex-col")}>
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
        id="main-content"
        className={cn(
          "container max-w-[2000px] py-4 sm:py-8 px-3 sm:px-4 lg:px-8 pb-20 md:pb-16 flex-1",
          showSidebar && "lg:pl-80"
        )}
      >
        {children}
      </main>
      <Footer />
      <MobileBottomTabs />
    </div>
  );
}
