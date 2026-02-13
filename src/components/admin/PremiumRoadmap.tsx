import { Crown, Users, Sparkles, TrendingUp, Store, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PremiumFeature {
  name: string;
  description: string;
  effort: "low" | "medium" | "high";
  category: string;
}

const PREMIUM_FEATURES: Record<string, { icon: React.ReactNode; features: PremiumFeature[] }> = {
  "Library Owner Perks": {
    icon: <Crown className="h-5 w-5 text-secondary" />,
    features: [
      { name: "Custom Domain", description: "Allow library owners to use their own domain (column already exists in schema)", effort: "medium", category: "branding" },
      { name: "Advanced Analytics", description: "Deeper play stats, collection value trends over time, player leaderboards", effort: "high", category: "analytics" },
      { name: "Priority BGG Sync", description: "More frequent auto-sync intervals (hourly vs daily)", effort: "low", category: "integration" },
      { name: "Bulk Export", description: "CSV/PDF reports of collection, play history, and lending records", effort: "medium", category: "data" },
      { name: "Multiple Libraries", description: "Own more than one library under a single account", effort: "medium", category: "core" },
      { name: "Increased Storage", description: "Higher limits for game images and library logos", effort: "low", category: "storage" },
      { name: "Remove Branding", description: "Hide 'Powered by GameTaverns' footer on library pages", effort: "low", category: "branding" },
    ],
  },
  "Community & Social": {
    icon: <Users className="h-5 w-5 text-secondary" />,
    features: [
      { name: "Club Creation Without Approval", description: "Premium users can create clubs instantly, skipping admin review", effort: "low", category: "clubs" },
      { name: "Private Libraries", description: "Invite-only visibility instead of the default discoverable model", effort: "medium", category: "privacy" },
      { name: "Advanced Polls", description: "Ranked choice voting, recurring game night scheduling", effort: "high", category: "engagement" },
      { name: "Discord Bot Integration", description: "Richer Discord features beyond basic webhooks (commands, role sync)", effort: "high", category: "integration" },
    ],
  },
  "Engagement & Gamification": {
    icon: <Sparkles className="h-5 w-5 text-secondary" />,
    features: [
      { name: "Custom Achievements", description: "Library owners define their own badges and unlock criteria", effort: "high", category: "gamification" },
      { name: "Premium Profile Badge", description: "Cosmetic flair/badge displayed on user profiles", effort: "low", category: "cosmetic" },
      { name: "AI Game Recommendations", description: "Personalized suggestions based on collection and play history", effort: "medium", category: "ai" },
      { name: "Cross-Library Trade Matching", description: "Match trade offers across libraries (tables already exist)", effort: "medium", category: "social" },
      { name: "Collection Value Alerts", description: "Insurance estimates and price change notifications", effort: "medium", category: "data" },
    ],
  },
  "Platform Monetization": {
    icon: <Store className="h-5 w-5 text-secondary" />,
    features: [
      { name: "Marketplace Listing Boost", description: "For-sale games get highlighted placement in search and browse", effort: "low", category: "marketplace" },
      { name: "Early Access to Features", description: "Premium users get beta access to new platform features", effort: "low", category: "access" },
      { name: "Sponsored Game Nights", description: "Premium libraries can promote their events site-wide", effort: "medium", category: "promotion" },
      { name: "API Access", description: "Read-only API for premium users to integrate with external tools", effort: "high", category: "developer" },
    ],
  },
};

const effortColors: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  high: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function PremiumRoadmap() {
  const totalFeatures = Object.values(PREMIUM_FEATURES).reduce((sum, g) => sum + g.features.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-cream flex items-center gap-2">
            <Crown className="h-6 w-6 text-secondary" />
            Premium Tier Roadmap
          </h2>
          <p className="text-cream/60 mt-1">
            {totalFeatures} potential features for a premium subscription tier. For internal review only.
          </p>
        </div>
        <Badge variant="outline" className="border-secondary/50 text-secondary text-sm px-3 py-1">
          <TrendingUp className="h-3 w-3 mr-1" />
          Planning Phase
        </Badge>
      </div>

      {Object.entries(PREMIUM_FEATURES).map(([category, { icon, features }]) => (
        <Card key={category} className="bg-wood-dark/60 border-wood-medium/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-cream flex items-center gap-2 text-lg">
              {icon}
              {category}
            </CardTitle>
            <CardDescription className="text-cream/50">
              {features.length} feature{features.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="flex items-start gap-3 p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/30"
                >
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-cream/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-cream font-medium text-sm">{feature.name}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${effortColors[feature.effort]}`}>
                        {feature.effort} effort
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cream/20 text-cream/40">
                        {feature.category}
                      </Badge>
                    </div>
                    <p className="text-cream/50 text-xs mt-1">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
