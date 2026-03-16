import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, CalendarDays, Plus, Library, Menu, X, ClipboardList, PlusCircle, Dice5, ScanBarcode } from "lucide-react";
import { TenantLink } from "@/components/TenantLink";
import { getPlatformUrl, getLibraryUrl } from "@/hooks/useTenantUrl";
import { getNativeEffectivePath } from "@/lib/nativeRouting";
import { useMyLibrary } from "@/hooks/useLibrary";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { MobileV2MenuDrawer } from "./MobileV2MenuDrawer";
import { StandaloneLogPlayDialog } from "@/components/games/StandaloneLogPlayDialog";
import { SmartPickerDialog } from "@/components/games/SmartPickerDialog";
import { QuickAddGameDialog } from "@/components/games/QuickAddGameDialog";

interface TabItem {
  href: string;
  icon: React.ElementType;
  label: string;
  match: (path: string) => boolean;
}

export function MobileV2BottomNav() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data: library } = useMyLibrary();
  const location = useLocation();
  const [fabOpen, setFabOpen] = useState(false);

  if (!isAuthenticated) return null;

  const libraryHref = library ? getLibraryUrl(library.slug, "/") : getPlatformUrl("/dashboard?tab=library");
  const currentPath = getNativeEffectivePath(location.pathname);

  const tabs: TabItem[] = [
    {
      href: getPlatformUrl("/dashboard"),
      icon: Home,
      label: t('mobileNav.home', 'Home'),
      match: (p) => p === "/dashboard" || (p.startsWith("/dashboard") && !p.startsWith("/dashboard/")),
    },
    {
      href: getPlatformUrl("/events"),
      icon: CalendarDays,
      label: t('mobileNav.events', 'Events'),
      match: (p) => p.startsWith("/events") || p.startsWith("/convention") || p.startsWith("/event/"),
    },
  ];

  const tabsRight: TabItem[] = [
    {
      href: libraryHref,
      icon: Library,
      label: t('mobileNav.library', 'Library'),
      match: (p) => p.startsWith("/library/") || p.startsWith("/l/") || p.startsWith("/dashboard/collection"),
    },
  ];

  const fabActions = [
    {
      id: "log-play",
      icon: ClipboardList,
      label: t('nav.logPlay', 'Log a Play'),
      type: "dialog" as const,
      dialog: "log-play",
    },
    {
      id: "add-game",
      icon: PlusCircle,
      label: t('nav.addGame', 'Add Game'),
      type: "dialog" as const,
      dialog: "add-game",
    },
    {
      id: "random-picker",
      icon: Dice5,
      label: t('nav.randomPicker', 'Random Picker'),
      type: "dialog" as const,
      dialog: "random-picker",
    },
    {
      id: "scan",
      icon: ScanBarcode,
      label: t('mobileNav.scan', 'Scan'),
      type: "link" as const,
      href: getPlatformUrl("/dashboard/collection?action=scan"),
    },
  ];

  return (
    <>
      {/* FAB overlay backdrop */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-[9997] bg-background/80 backdrop-blur-sm"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* FAB expanded actions */}
      {fabOpen && (
        <div className="fixed z-[9998] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
          style={{ bottom: "calc(var(--mobile-tab-height) + env(safe-area-inset-bottom) + 32px)" }}
        >
          {fabActions.map((action, i) => {
            const Icon = action.icon;
            const content = (
              <button
                key={action.id}
                className="flex items-center gap-3 bg-card border border-border/50 rounded-full pl-4 pr-5 py-2.5 shadow-lg text-sm font-medium text-foreground hover:bg-accent/10 transition-all"
                style={{
                  animationDelay: `${i * 50}ms`,
                  animation: "fab-item-in 200ms ease-out forwards",
                  opacity: 0,
                  transform: "translateY(8px)",
                }}
                onClick={() => setFabOpen(false)}
              >
                <Icon className="h-5 w-5 text-primary" />
                <span>{action.label}</span>
              </button>
            );

            if (action.dialog === "log-play") {
              return (
                <StandaloneLogPlayDialog key={action.id}>
                  {content}
                </StandaloneLogPlayDialog>
              );
            }
            if (action.dialog === "add-game") {
              return (
                <QuickAddGameDialog key={action.id}>
                  {content}
                </QuickAddGameDialog>
              );
            }
            if (action.dialog === "random-picker") {
              return (
                <SmartPickerDialog key={action.id}>
                  {content}
                </SmartPickerDialog>
              );
            }
            return content;
          })}
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav className="mobile-bottom-tabs native-mobile-tabs" aria-label="Main navigation">
        <ul className="contents">
          {/* Left tabs */}
          {tabs.map((tab) => {
            const isActive = tab.match(currentPath);
            const Icon = tab.icon;
            return (
              <li key={tab.href} className="contents">
                <TenantLink
                  href={tab.href}
                  className={cn("mobile-bottom-tab", isActive && "mobile-bottom-tab--active")}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] mt-0.5">{tab.label}</span>
                </TenantLink>
              </li>
            );
          })}

          {/* Center FAB */}
          <li className="contents">
            <button
              className="mobile-bottom-tab relative"
              onClick={() => setFabOpen(prev => !prev)}
              aria-label={fabOpen ? "Close actions" : "Quick actions"}
            >
              <div className={cn(
                "flex items-center justify-center h-12 w-12 -mt-4 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform",
                fabOpen && "rotate-45"
              )}>
                {fabOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </div>
            </button>
          </li>

          {/* Right tabs */}
          {tabsRight.map((tab) => {
            const isActive = tab.match(currentPath);
            const Icon = tab.icon;
            return (
              <li key={tab.href} className="contents">
                <TenantLink
                  href={tab.href}
                  className={cn("mobile-bottom-tab", isActive && "mobile-bottom-tab--active")}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] mt-0.5">{tab.label}</span>
                </TenantLink>
              </li>
            );
          })}

          {/* Menu tab */}
          <li className="contents">
            <MobileV2MenuDrawer
              trigger={
                <button className="mobile-bottom-tab" aria-label={t('mobileNav.more', 'More')}>
                  <Menu className="h-5 w-5" />
                  <span className="text-[10px] mt-0.5">{t('mobileNav.more', 'More')}</span>
                </button>
              }
            />
          </li>
        </ul>
      </nav>
    </>
  );
}
