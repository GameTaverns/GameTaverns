import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen parchment-texture">
      <Sidebar isOpen={sidebarOpen} />
      
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:ml-72">
        <AnnouncementBanner />
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          isSidebarOpen={sidebarOpen}
        />
        <main className="container py-8 px-4 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
