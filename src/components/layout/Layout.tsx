import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { OwnerAdminBar } from "./OwnerAdminBar";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

export function Layout({ children, hideSidebar = false }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen parchment-texture flex flex-col">
      <OwnerAdminBar />
      <AnnouncementBanner />
      {!hideSidebar && <Sidebar isOpen={sidebarOpen} />}
      
      {/* Mobile overlay */}
      {!hideSidebar && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={cn("flex-1 flex flex-col", !hideSidebar && "lg:ml-72")}>
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          isSidebarOpen={sidebarOpen}
          hideSidebarToggle={hideSidebar}
        />
        <main className="container py-4 sm:py-8 px-3 sm:px-4 lg:px-8 pb-16 flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
