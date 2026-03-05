import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, Trophy, Star, Heart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { SpokePageLayout } from "@/components/dashboard/SpokePageLayout";
import { CollectionInsightsWidget } from "@/components/dashboard/CollectionInsightsWidget";
import { AnalyticsTab } from "@/components/analytics/AnalyticsTab";
import { AchievementsDisplay } from "@/components/achievements/AchievementsDisplay";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";

const cardClass = "bg-wood-medium/30 border-wood-medium/50 text-cream";
const btnOutline = "border-secondary/50 text-cream hover:bg-wood-medium/50 text-xs h-7 gap-1.5";

export default function InsightsPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const { data: library } = useMyLibrary();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) return null;

  return (
    <SpokePageLayout
      title="Insights & Analytics"
      description="Your collection DNA, play stats, and achievements"
      icon={Sparkles}
      iconColor="hsl(262, 80%, 55%)"
    >
      <div className="space-y-6">
        {/* Collection DNA */}
        {library && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-secondary" />
              Collection DNA & Insights
            </h2>
            <CollectionInsightsWidget libraryId={library.id} />
          </section>
        )}

        {/* Ratings & Wishlist */}
        {library && (
          <Card className={cardClass}>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-secondary" />
                {t('dashboard.ratingsWishlist')}
              </CardTitle>
              <CardDescription className="text-cream/60 text-xs">{t('dashboard.ratingsWishlistDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-col gap-1.5">
                <TenantLink href={getLibraryUrl(library.slug, "/settings?tab=ratings")}>
                  <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                    <Star className="h-3.5 w-3.5" /> {t('dashboard.viewRatings')}
                  </Button>
                </TenantLink>
                <TenantLink href={getLibraryUrl(library.slug, "/settings?tab=want-to-play")}>
                  <Button variant="outline" size="sm" className={`w-full ${btnOutline}`}>
                    <Heart className="h-3.5 w-3.5" /> {t('dashboard.wantToPlay')}
                  </Button>
                </TenantLink>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Achievements */}
        <Card className={cardClass}>
          <CardHeader className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-secondary" />
                {t('dashboard.achievements')}
              </CardTitle>
              <Link to="/achievements">
                <Button variant="ghost" size="sm" className="text-cream/70 hover:text-cream hover:bg-wood-medium/40 text-xs h-7 gap-1">
                  {t('common.viewAll')} <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4"><AchievementsDisplay compact /></CardContent>
        </Card>

        {/* Full Analytics */}
        {library && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-secondary" />
              Play Stats & Analytics
            </h2>
            <AnalyticsTab isAdmin={isAdmin} libraryId={library.id} libraryName={library.name} />
          </section>
        )}
      </div>
    </SpokePageLayout>
  );
}
