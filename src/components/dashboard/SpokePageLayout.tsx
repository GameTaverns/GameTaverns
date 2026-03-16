import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <AnnouncementBanner />
      <AppHeader />
      <main className="container mx-auto px-2 sm:px-4 py-3 sm:py-6 max-w-6xl">
        <div className="mb-3 sm:mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 sm:mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('nav.dashboard')}
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {Icon && (
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: iconColor }} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">{title}</h1>
              {description && <p className="text-sm text-muted-foreground truncate">{description}</p>}
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
