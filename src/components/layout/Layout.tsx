import { useState, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "./AppHeader";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { OwnerAdminBar } from "./OwnerAdminBar";

import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";
import { MobileBottomTabs } from "@/components/mobile/MobileBottomTabs";

interface LayoutContextType {
  sidebarVisible: boolean;
  sidebarCollapsed: boolean;
}

const LayoutContext = createContext<LayoutContextType>({ sidebarVisible: false, sidebarCollapsed: false });
export const useLayoutContext = () => useContext(LayoutContext);

interface LayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

export function Layout({ children, hideSidebar = false }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isTenantMode } = useTenant();
  const { t } = useTranslation();

  // Show sidebar only on library pages
  const showSidebar = isTenantMode && !hideSidebar;

  return (
    <LayoutContext.Provider value={{ sidebarVisible: showSidebar, sidebarCollapsed }}>
      <div className={cn("min-h-screen parchment-texture flex flex-col")}>
        {/* Skip-to-content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {t('a11y.skipToContent', 'Skip to main content')}
        </a>
        <OwnerAdminBar />
        <AnnouncementBanner />
        <AppHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} showMenuToggle={showSidebar} />

        {showSidebar && (
          <Sidebar
            isOpen={sidebarOpen}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(c => !c)}
          />
        )}

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
            showSidebar && !sidebarCollapsed && "lg:pl-80",
            showSidebar && sidebarCollapsed && "lg:pl-20"
          )}
        >
          {children}
        </main>
        <Footer />
        <MobileBottomTabs />
      </div>
    </LayoutContext.Provider>
  );
}
