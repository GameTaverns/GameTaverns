import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Gamepad2, Plus, Settings, Eye, Shuffle, Flame, ListOrdered,
  Library, ArrowRight, BookOpen, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useActiveLibrary } from "@/hooks/useActiveLibrary";
import { useMaxLibrariesPerUser } from "@/hooks/useLibrary";
import { useLibraryViewStats } from "@/hooks/useLibraryViewStats";
import { SpokePageLayout } from "@/components/dashboard/SpokePageLayout";
import { LibrarySwitcher } from "@/components/dashboard/LibrarySwitcher";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { ImportProgressWidget } from "@/components/dashboard/ImportProgressWidget";
import { ShelfOfShameWidget } from "@/components/dashboard/ShelfOfShameWidget";
import { RandomGamePicker } from "@/components/games/RandomGamePicker";
import { CatalogDiscoveryCard } from "@/components/dashboard/CatalogDiscoveryCard";
import { HotnessLeaderboard } from "@/components/games/HotnessLeaderboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";

export default function CollectionPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();
  const { library, myLibraries, activeLibraryId, setActiveLibraryId } = useActiveLibrary();
  const { data: maxLibraries = 1 } = useMaxLibrariesPerUser();
  const navigate = useNavigate();

  const { data: viewStats } = useLibraryViewStats(library?.id ?? "");
  const { data: gameCount } = useQuery({
    queryKey: ["collection-game-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return 0;
      const { count } = await supabase
        .from("games")
        .select("id", { count: "exact", head: true })
        .eq("library_id", library.id);
      return count ?? 0;
    },
    enabled: !!library?.id,
    staleTime: 60000,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) return null;

  if (!library) {
    return (
      <SpokePageLayout title="My Collection" icon={Gamepad2} iconColor="hsl(var(--primary))">
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Library className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">{t('dashboard.noLibrary')}</p>
          <Link to="/create-library">
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> {t('dashboard.createLibrary')}
            </Button>
          </Link>
        </div>
      </SpokePageLayout>
    );
  }

  const gamesUrl = getLibraryUrl(library.slug, "/games");
  const manageUrl = getLibraryUrl(library.slug, "/manage");
  const libraryUrl = getLibraryUrl(library.slug, "/");
  const settingsUrl = getLibraryUrl(library.slug, "/settings");

  return (
    <SpokePageLayout
      title="My Collection"
      description={`Managing ${library.name}`}
      icon={Gamepad2}
      iconColor="hsl(var(--primary))"
    >
      {/* Library Switcher */}
      <LibrarySwitcher
        libraries={myLibraries}
        activeLibraryId={activeLibraryId}
        onSwitch={setActiveLibraryId}
      />

      {/* Dismissible catalog tip */}
      <CatalogDiscoveryCard />

      {/* Action Bar + Stats */}
      <div className="rounded-2xl border bg-card p-4 mb-4">
        {/* Stats row */}
        <div className="flex items-center gap-6 mb-4 flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{gameCount ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Games</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{viewStats?.views_7d ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Views this week</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{viewStats?.unique_viewers_7d ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Unique visitors</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{myLibraries.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{myLibraries.length === 1 ? "Library" : "Libraries"}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <TenantLink href={gamesUrl}>
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> {t('dashboard.addGames')}
            </Button>
          </TenantLink>
          <TenantLink href={manageUrl}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" /> {t('dashboard.manageCollection')}
            </Button>
          </TenantLink>
          <TenantLink href={libraryUrl}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Eye className="h-3.5 w-3.5" /> {t('dashboard.viewPublicPage')}
            </Button>
          </TenantLink>
          <TenantLink href={settingsUrl}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" /> Library Settings
            </Button>
          </TenantLink>
          <Link to="/catalog">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" /> Browse Catalog
            </Button>
          </Link>
        </div>
      </div>

      {/* Import Progress (conditional — only shows when relevant) */}
      <ImportProgressWidget libraryIds={myLibraries.map(l => l.id)} />

      {/* Main content: Shelf of Shame + Random Picker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <ShelfOfShameWidget libraryId={library.id} />

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shuffle className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">{t('dashboard.randomPicker')}</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t('dashboard.randomPickerDesc')}</p>
          <RandomGamePicker libraryId={library.id} librarySlug={library.slug} />
        </div>
      </div>

      {/* Quick Links Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Link to="/lists" className="block">
          <div className="rounded-xl border bg-card hover:bg-accent/50 transition-colors p-3 flex items-center gap-3 group">
            <ListOrdered className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t('dashboard.curatedLists')}</p>
              <p className="text-[11px] text-muted-foreground">{t('dashboard.curatedListsDesc')}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {myLibraries.length < maxLibraries && (
          <Link to="/create-library" className="block">
            <div className="rounded-xl border border-dashed bg-card hover:bg-accent/50 transition-colors p-3 flex items-center gap-3 group">
              <Plus className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t('dashboard.createAnotherLibrary')}</p>
                <p className="text-[11px] text-muted-foreground">{myLibraries.length}/{maxLibraries} {t('dashboard.used')}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}
      </div>

      {/* Trending — compact, collapsible section */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-orange-400" />
          <h3 className="font-semibold text-sm text-foreground">{t('dashboard.trendingThisMonth')}</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">{t('dashboard.trendingDesc')}</span>
        </div>
        <HotnessLeaderboard libraryId={library.id} tenantSlug={library.slug} limit={5} compact />
      </div>
    </SpokePageLayout>
  );
}
