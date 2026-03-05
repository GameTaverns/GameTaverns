import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomTabs } from "@/components/mobile/MobileBottomTabs";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import type { LucideIcon } from "lucide-react";

interface SpokePageLayoutProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  children: React.ReactNode;
}

export function SpokePageLayout({ title, description, icon: Icon, iconColor, children }: SpokePageLayoutProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <AnnouncementBanner />
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <Icon className="h-5 w-5" style={{ color: iconColor }} />
              </div>
            )}
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">{title}</h1>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
        </div>
        {children}
      </main>
      <Footer />
      <MobileBottomTabs />
    </div>
  );
}
