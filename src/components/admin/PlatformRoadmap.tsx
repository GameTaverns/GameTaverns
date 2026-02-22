import { Crown, Users, Sparkles, TrendingUp, Store, CheckCircle2, Map, ShoppingBag, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface RoadmapFeature {
  name: string;
  description: string;
  effort: "low" | "medium" | "high";
  category: string;
  status?: "idea" | "planned" | "in-progress" | "done";
}

interface RoadmapPhase {
  title: string;
  icon: React.ReactNode;
  description: string;
  features: RoadmapFeature[];
}

const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    title: "Phase 1 — Stability & Security",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
    description: "Core platform hardening, auth flows, and data integrity",
    features: [
      { name: "RLS Policy Audit", description: "Review and tighten all row-level security policies across tables", effort: "high", category: "security", status: "done" },
      { name: "Error Boundary Coverage", description: "Wrap all lazy-loaded tabs and async views in error boundaries", effort: "low", category: "stability", status: "done" },
      { name: "BGG Sync Reliability", description: "Retry logic, conflict resolution, and progress tracking for imports", effort: "medium", category: "integration", status: "in-progress" },
      { name: "Audit Logging", description: "Track admin actions, user deletions, and sensitive operations", effort: "medium", category: "security", status: "done" },
    ],
  },
  {
    title: "Phase 2 — UX & Onboarding",
    icon: <Users className="h-5 w-5 text-blue-400" />,
    description: "Reduce friction for new users and library owners",
    features: [
      { name: "Guided Library Setup", description: "Step-by-step wizard for creating and configuring a new library", effort: "medium", category: "onboarding", status: "planned" },
      { name: "Demo Mode", description: "Let visitors explore a sample library without signing up", effort: "medium", category: "onboarding", status: "done" },
      { name: "Dashboard Customization", description: "Drag-and-drop widget layout for the owner dashboard", effort: "high", category: "ux", status: "idea" },
      { name: "Mobile-First Polish", description: "Touch-optimized controls, bottom sheets, swipe gestures", effort: "medium", category: "ux", status: "planned" },
    ],
  },
  {
    title: "Phase 3 — Community & Social",
    icon: <Users className="h-5 w-5 text-secondary" />,
    description: "Clubs, messaging, and cross-library engagement",
    features: [
      { name: "Club Creation Without Approval", description: "Premium users can create clubs instantly, skipping admin review", effort: "low", category: "clubs", status: "idea" },
      { name: "Private Libraries", description: "Invite-only visibility instead of the default discoverable model", effort: "medium", category: "privacy", status: "idea" },
      { name: "Advanced Polls", description: "Ranked choice voting, recurring game night scheduling", effort: "high", category: "engagement", status: "idea" },
      { name: "Discord Bot Integration", description: "Richer Discord features beyond basic webhooks (commands, role sync)", effort: "high", category: "integration", status: "idea" },
      { name: "Cross-Library Trade Matching", description: "Match trade offers across libraries (tables already exist)", effort: "medium", category: "social", status: "idea" },
    ],
  },
  {
    title: "Phase 4 — Premium Tier",
    icon: <Crown className="h-5 w-5 text-secondary" />,
    description: "Subscription features for library owners and power users",
    features: [
      { name: "Custom Domain", description: "Allow library owners to use their own domain (column already exists in schema)", effort: "medium", category: "branding", status: "idea" },
      { name: "Advanced Analytics", description: "Deeper play stats, collection value trends over time, player leaderboards", effort: "high", category: "analytics", status: "idea" },
      { name: "Priority BGG Sync", description: "More frequent auto-sync intervals (hourly vs daily)", effort: "low", category: "integration", status: "idea" },
      { name: "Bulk Export", description: "CSV/PDF reports of collection, play history, and lending records", effort: "medium", category: "data", status: "idea" },
      { name: "Multiple Libraries", description: "Own more than one library under a single account", effort: "medium", category: "core", status: "idea" },
      { name: "Remove Branding", description: "Hide 'Powered by GameTaverns' footer on library pages", effort: "low", category: "branding", status: "idea" },
      { name: "Premium Profile Badge", description: "Cosmetic flair/badge displayed on user profiles", effort: "low", category: "cosmetic", status: "idea" },
      { name: "Custom Achievements", description: "Library owners define their own badges and unlock criteria", effort: "high", category: "gamification", status: "idea" },
      { name: "AI Game Recommendations", description: "Personalized suggestions based on collection and play history", effort: "medium", category: "ai", status: "idea" },
    ],
  },
  {
    title: "Phase 5 — Retailer & FLGS Directory",
    icon: <ShoppingBag className="h-5 w-5 text-amber-400" />,
    description: "Connect local game stores with the community — requires stakeholder buy-in",
    features: [
      { name: "FLGS Directory", description: "Searchable directory of friendly local game stores with claimed profiles, hours, and events", effort: "high", category: "marketplace", status: "idea" },
      { name: "Retailer Storefront Pages", description: "Shops get branded pages with inventory, links to their own checkout, and event calendars", effort: "high", category: "marketplace", status: "idea" },
      { name: "In-App Purchase Flow", description: "Full buy/sell within the platform — payment processing, disputes, shipping labels", effort: "high", category: "marketplace", status: "idea" },
      { name: "Peer-to-Peer Marketplace", description: "Users list games for sale/trade with integrated messaging and offer system", effort: "high", category: "marketplace", status: "idea" },
      { name: "Marketplace Listing Boost", description: "For-sale games get highlighted placement in search and browse (premium)", effort: "low", category: "marketplace", status: "idea" },
      { name: "Collection Value Alerts", description: "Insurance estimates and price change notifications from market data", effort: "medium", category: "data", status: "idea" },
      { name: "Affiliate Link Integration", description: "Build on existing catalog_purchase_links for revenue sharing with retailers", effort: "medium", category: "monetization", status: "idea" },
      { name: "Sponsored Game Nights", description: "Retailers can promote their in-store events to nearby libraries and clubs", effort: "medium", category: "promotion", status: "idea" },
    ],
  },
  {
    title: "Phase 6 — Platform Monetization & API",
    icon: <TrendingUp className="h-5 w-5 text-secondary" />,
    description: "Revenue streams and developer ecosystem",
    features: [
      { name: "Early Access to Features", description: "Premium users get beta access to new platform features", effort: "low", category: "access", status: "idea" },
      { name: "API Access", description: "Read-only API for premium users to integrate with external tools", effort: "high", category: "developer", status: "idea" },
      { name: "Increased Storage", description: "Higher limits for game images and library logos", effort: "low", category: "storage", status: "idea" },
    ],
  },
];

const effortColors: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  high: "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusColors: Record<string, string> = {
  idea: "bg-muted/50 text-muted-foreground border-muted-foreground/30",
  planned: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "in-progress": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  done: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export function PlatformRoadmap() {
  const totalFeatures = ROADMAP_PHASES.reduce((sum, p) => sum + p.features.length, 0);
  const doneCount = ROADMAP_PHASES.reduce((sum, p) => sum + p.features.filter(f => f.status === "done").length, 0);
  const inProgressCount = ROADMAP_PHASES.reduce((sum, p) => sum + p.features.filter(f => f.status === "in-progress").length, 0);
  const [openPhases, setOpenPhases] = useState<Record<number, boolean>>({ 0: true, 1: true });

  const togglePhase = (idx: number) => {
    setOpenPhases(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-cream flex items-center gap-2">
            <Map className="h-6 w-6 text-secondary" />
            Platform Roadmap
          </h2>
          <p className="text-cream/60 mt-1">
            {totalFeatures} features across {ROADMAP_PHASES.length} phases · {doneCount} done · {inProgressCount} in progress
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(statusColors).map(([status, cls]) => (
            <Badge key={status} variant="outline" className={`text-[10px] px-2 py-0.5 capitalize ${cls}`}>
              {status}
            </Badge>
          ))}
        </div>
      </div>

      {ROADMAP_PHASES.map((phase, idx) => {
        const isOpen = openPhases[idx] ?? false;
        const phaseProgress = phase.features.filter(f => f.status === "done").length;

        return (
          <Collapsible key={phase.title} open={isOpen} onOpenChange={() => togglePhase(idx)}>
            <Card className="bg-wood-dark/60 border-wood-medium/40">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-wood-medium/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-cream flex items-center gap-2 text-lg">
                      {phase.icon}
                      {phase.title}
                      {isOpen ? <ChevronDown className="h-4 w-4 text-cream/40" /> : <ChevronRight className="h-4 w-4 text-cream/40" />}
                    </CardTitle>
                    <Badge variant="outline" className="border-cream/20 text-cream/50 text-xs">
                      {phaseProgress}/{phase.features.length} done
                    </Badge>
                  </div>
                  <CardDescription className="text-cream/50">
                    {phase.description}
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-3">
                    {phase.features.map((feature) => (
                      <div
                        key={feature.name}
                        className="flex items-start gap-3 p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/30"
                      >
                        <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${feature.status === "done" ? "text-emerald-400" : "text-cream/30"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${feature.status === "done" ? "text-cream/50 line-through" : "text-cream"}`}>
                              {feature.name}
                            </span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[feature.status || "idea"]}`}>
                              {feature.status || "idea"}
                            </Badge>
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
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
