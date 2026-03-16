import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useUserProfile } from "@/hooks/useLibrary";
import { CalendarDays, Library, ClipboardList, ArrowLeftRight, ChevronRight, Plus } from "lucide-react";
import { TenantLink } from "@/components/TenantLink";
import { getPlatformUrl, getLibraryUrl } from "@/hooks/useTenantUrl";
import { cn } from "@/lib/utils";

/**
 * Mobile V2 Home Screen
 * 
 * Progressive disclosure:
 * - New user: "Add your first game" + "Find events" prompts
 * - Active user: Loans due, upcoming events, recent plays, library snapshot
 */
export function MobileV2Home() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data: library } = useMyLibrary();
  const { data: profile } = useUserProfile();

  if (!isAuthenticated) return null;

  const greeting = profile?.display_name || profile?.username || "Adventurer";
  const hasLibrary = !!library;
  // game_count isn't on the Library type; we'll use a placeholder for now
  const gameCount = 0; // TODO: fetch from games query

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-display font-bold text-foreground">
          {t('dashboard.welcomeBack', 'Welcome back')}, {greeting}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('mobileHome.subtitle', "What's on the table tonight?")}
        </p>
      </div>

      {/* Empty state for new users */}
      {!hasLibrary || gameCount === 0 ? (
        <div className="px-4 space-y-3">
          <EmptyPromptCard
            icon={Library}
            title={t('mobileHome.addFirstGame', 'Add your first game')}
            description={t('mobileHome.addFirstGameDesc', 'Start building your collection to unlock play tracking, insights, and more.')}
            href={getPlatformUrl("/catalog")}
            action={t('mobileHome.browseCatalog', 'Browse Catalog')}
          />
          <EmptyPromptCard
            icon={CalendarDays}
            title={t('mobileHome.findEvents', 'Find events near you')}
            description={t('mobileHome.findEventsDesc', 'Discover game nights, conventions, and meetups in your area.')}
            href={getPlatformUrl("/events")}
            action={t('mobileHome.browseEvents', 'Browse Events')}
          />
        </div>
      ) : (
        <div className="px-4 space-y-5">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label={t('mobileHome.games', 'Games')}
              value={String(gameCount)}
              href={library ? getLibraryUrl(library.slug, "/") : "#"}
            />
            <StatCard
              label={t('mobileHome.plays', 'Plays')}
              value="—"
              href={getPlatformUrl("/dashboard/insights")}
            />
            <StatCard
              label={t('mobileHome.loans', 'Loans')}
              value="—"
              href={getPlatformUrl("/dashboard/lending")}
            />
          </div>

          {/* Sections */}
          <HomeSection
            icon={ArrowLeftRight}
            title={t('mobileHome.activeLoans', 'Active Loans')}
            emptyText={t('mobileHome.noLoans', 'No active loans')}
            href={getPlatformUrl("/dashboard/lending")}
          />

          <HomeSection
            icon={CalendarDays}
            title={t('mobileHome.upcomingEvents', 'Upcoming Events')}
            emptyText={t('mobileHome.noEvents', 'No upcoming events')}
            href={getPlatformUrl("/events")}
          />

          <HomeSection
            icon={ClipboardList}
            title={t('mobileHome.recentPlays', 'Recent Plays')}
            emptyText={t('mobileHome.noPlays', 'No plays logged yet')}
            href={getPlatformUrl("/dashboard/insights")}
          />
        </div>
      )}
    </div>
  );
}

function EmptyPromptCard({ icon: Icon, title, description, href, action }: {
  icon: React.ElementType; title: string; description: string; href: string; action: string;
}) {
  return (
    <TenantLink href={href} className="block">
      <div className="border border-border/50 rounded-xl p-4 bg-card hover:bg-accent/5 transition-colors">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-2">
              {action}
              <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </TenantLink>
  );
}

function StatCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <TenantLink href={href} className="block">
      <div className="border border-border/50 rounded-lg p-3 bg-card text-center hover:bg-accent/5 transition-colors">
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </TenantLink>
  );
}

function HomeSection({ icon: Icon, title, emptyText, href }: {
  icon: React.ElementType; title: string; emptyText: string; href: string;
}) {
  return (
    <div>
      <TenantLink href={href} className="flex items-center justify-between mb-2 group">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </TenantLink>
      <div className="border border-border/30 rounded-lg p-4 bg-card/50">
        <p className="text-xs text-muted-foreground text-center">{emptyText}</p>
      </div>
    </div>
  );
}
