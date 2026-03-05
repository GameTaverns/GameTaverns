import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Gamepad2, Plus, Settings, Eye, Shuffle, Flame, ListOrdered, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries, useMaxLibrariesPerUser } from "@/hooks/useLibrary";
import { SpokePageLayout } from "@/components/dashboard/SpokePageLayout";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { ImportProgressWidget } from "@/components/dashboard/ImportProgressWidget";
import { LibraryViewStatsCard } from "@/components/dashboard/LibraryViewStatsCard";
import { ShelfOfShameWidget } from "@/components/dashboard/ShelfOfShameWidget";
import { RandomGamePicker } from "@/components/games/RandomGamePicker";
import { CatalogDiscoveryCard } from "@/components/dashboard/CatalogDiscoveryCard";
import { HotnessLeaderboard } from "@/components/games/HotnessLeaderboard";

const cardClass = "bg-wood-medium/30 border-wood-medium/50 text-cream";
const btnPrimary = "bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs h-7 gap-1.5";
const btnOutline = "border-secondary/50 text-cream hover:bg-wood-medium/50 text-xs h-7 gap-1.5";

export default function CollectionPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();
  const { data: defaultLibrary } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const { data: maxLibraries = 1 } = useMaxLibrariesPerUser();
  const navigate = useNavigate();

  const [activeLibraryId, setActiveLibraryId] = useState<string | null>(null);
  const library = myLibraries.find((l) => l.id === activeLibraryId) ?? defaultLibrary ?? null;

  useEffect(() => {
    if (!activeLibraryId && defaultLibrary) setActiveLibraryId(defaultLibrary.id);
  }, [defaultLibrary, activeLibraryId]);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) return null;

  if (!library) {
    return (
      <SpokePageLayout title="My Collection" icon={Gamepad2} iconColor="hsl(var(--primary))">
        <Card className={cardClass}>
          <CardContent className="py-8 text-center">
            <Library className="h-10 w-10 mx-auto text-cream/30 mb-3" />
            <p className="text-sm text-cream/70 mb-4">{t('dashboard.noLibrary')}</p>
            <Link to="/create-library">
              <Button className={btnPrimary}><Plus className="h-3.5 w-3.5" /> {t('dashboard.createLibrary')}</Button>
            </Link>
          </CardContent>
        </Card>
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
      {myLibraries.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-xs text-cream/70 font-medium">{t('dashboard.activeLibrary')}</span>
          {myLibraries.map((lib) => (
            <Button
              key={lib.id}
              size="sm"
              variant={lib.id === library.id ? "default" : "outline"}
              className={`text-xs h-7 ${lib.id === library.id ? "bg-secondary text-secondary-foreground" : "border-secondary/50 text-cream hover:bg-wood-medium/50"}`}
              onClick={() => setActiveLibraryId(lib.id)}
            >
              {lib.name}
            </Button>
          ))}
        </div>
      )}

      <CatalogDiscoveryCard />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {/* Games Management */}
        <Card className={cardClass}>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gamepad2 className="h-4 w-4 text-secondary" />
              {t('dashboard.myGames')}
            </CardTitle>
            <CardDescription className="text-cream/60 text-xs">{t('dashboard.myGamesDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-col gap-1.5">
              <TenantLink href={gamesUrl}>
                <Button size="sm" className={`w-full ${btnPrimary}`}>
                  <Plus className="h-3 w-3" /> {t('dashboard.addGames')}
                </Button>
              </TenantLink>
              <TenantLink href={manageUrl}>
                <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                  <Settings className="h-3 w-3" /> {t('dashboard.manageCollection')}
                </Button>
              </TenantLink>
              <TenantLink href={libraryUrl}>
                <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                  <Eye className="h-3 w-3" /> {t('dashboard.viewPublicPage')}
                </Button>
              </TenantLink>
            </div>
          </CardContent>
        </Card>

        {/* Shelf of Shame */}
        <ShelfOfShameWidget libraryId={library.id} />

        {/* Library Views */}
        <LibraryViewStatsCard libraryId={library.id} className={cardClass} />

        {/* Random Picker */}
        <Card className={cardClass}>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shuffle className="h-4 w-4 text-secondary" />
              {t('dashboard.randomPicker')}
            </CardTitle>
            <CardDescription className="text-cream/60 text-xs">{t('dashboard.randomPickerDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <RandomGamePicker libraryId={library.id} librarySlug={library.slug} />
          </CardContent>
        </Card>

        {/* Curated Lists */}
        <Card className={cardClass}>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListOrdered className="h-4 w-4 text-secondary" />
              {t('dashboard.curatedLists')}
            </CardTitle>
            <CardDescription className="text-cream/60 text-xs">{t('dashboard.curatedListsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Link to="/lists">
              <Button size="sm" className={`w-full ${btnPrimary}`}>
                <ListOrdered className="h-3.5 w-3.5" /> {t('dashboard.browseCreateLists')}
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Library Settings */}
        <Card className={cardClass}>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings className="h-4 w-4 text-secondary" />
              {t('dashboard.librarySettings')}
            </CardTitle>
            <CardDescription className="text-cream/60 text-xs">{t('dashboard.librarySettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <TenantLink href={settingsUrl}>
              <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                <Settings className="h-3.5 w-3.5" /> {t('dashboard.manageSettings')}
              </Button>
            </TenantLink>
          </CardContent>
        </Card>

        {/* Create Additional Library */}
        {myLibraries.length < maxLibraries && (
          <Card className={`${cardClass} border-dashed`}>
            <CardContent className="py-4 px-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{t('dashboard.createAnotherLibrary')}</p>
                <p className="text-xs text-cream/60">{myLibraries.length}/{maxLibraries} {t('dashboard.used')}</p>
              </div>
              <Link to="/create-library">
                <Button size="sm" className={btnPrimary}><Plus className="h-3.5 w-3.5" /> Create</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Import Progress */}
        <ImportProgressWidget libraryIds={myLibraries.map(l => l.id)} />

        {/* Trending */}
        <Card className={`${cardClass} md:col-span-2 lg:col-span-3`}>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4 text-orange-400" />
              {t('dashboard.trendingThisMonth')}
            </CardTitle>
            <CardDescription className="text-cream/60 text-xs">{t('dashboard.trendingDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <HotnessLeaderboard libraryId={library.id} tenantSlug={library.slug} limit={10} />
          </CardContent>
        </Card>
      </div>
    </SpokePageLayout>
  );
}
