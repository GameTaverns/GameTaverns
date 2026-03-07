import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { ReferralPanel } from "@/components/referral/ReferralPanel";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Users, Gift, ChevronRight, ImageIcon } from "lucide-react";
import { BackLink } from "@/components/navigation/BackLink";
import { REFERRAL_TIERS, FOUNDING_MEMBER_BADGE } from "@/hooks/useReferral";

export default function Grow() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <Layout hideSidebar>
      <SEO title={t('grow.title')} description={t('grow.seoDesc')} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back to dashboard */}
        {isAuthenticated && (
          <BackLink fallback="/dashboard" />
        )}

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Gift className="h-3.5 w-3.5" />
             {t('grow.growthHub')}
           </div>
           <h1 className="font-display text-4xl sm:text-5xl font-bold mb-3">
             {t('grow.heading')}
           </h1>
           <p className="text-muted-foreground text-lg max-w-xl mx-auto">
             {t('grow.description')}
           </p>
         </div>

        {/* Tiers overview (public) */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {REFERRAL_TIERS.map((tier) => (
            <Card key={tier.key} className="text-center">
              <CardContent className="pt-6 pb-5">
                <div className="text-3xl mb-2">{tier.emoji}</div>
                <h3 className="font-display font-bold text-sm mb-1">{tier.label}</h3>
                <p className="text-xs text-muted-foreground">{tier.threshold} {tier.threshold !== 1 ? t('grow.referrals') : t('grow.referral')}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Founding member callout */}
        <Card className="mb-10 border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex items-center gap-4 py-5">
            <span className="text-3xl">{FOUNDING_MEMBER_BADGE.emoji}</span>
            <div className="flex-1">
              <h3 className="font-display font-bold">{FOUNDING_MEMBER_BADGE.label}</h3>
              <p className="text-sm text-muted-foreground">{FOUNDING_MEMBER_BADGE.description}</p>
            </div>
          </CardContent>
        </Card>

        {isAuthenticated ? (
          <div className="grid lg:grid-cols-[1fr_300px] gap-8">
            <ReferralPanel />

            {/* Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardContent className="py-5">
                  <h3 className="font-display font-bold text-sm mb-2 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                     {t('grow.shareYourStats')}
                   </h3>
                   <p className="text-xs text-muted-foreground mb-3">
                     {t('grow.shareStatsDesc')}
                   </p>
                   <Link to="/share-card">
                     <Button variant="outline" size="sm" className="w-full gap-1">
                       {t('grow.createStatsCard')} <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-5">
                  <h3 className="font-display font-bold text-sm mb-2 flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-primary" />
                    Embed Your Library
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Add an embeddable widget to your blog or Discord.
                  </p>
                  <Link to="/embed">
                    <Button variant="outline" size="sm" className="w-full gap-1">
                      Get Embed Code <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Sign up to get your referral link and start earning badges.</p>
            <Link to="/signup">
              <Button size="lg" className="gap-2">
                <Users className="h-4 w-4" />
                Create Your Account
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
