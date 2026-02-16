import { AppHeader } from "./AppHeader";
import { Footer } from "./Footer";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { OwnerAdminBar } from "./OwnerAdminBar";

interface LayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

export function Layout({ children, hideSidebar = false }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark flex flex-col">
      <OwnerAdminBar />
      <AnnouncementBanner />
      <AppHeader />

      <main className="container py-4 sm:py-8 px-3 sm:px-4 lg:px-8 pb-16 flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
