import { useState } from "react";
import {
  Gamepad2, BarChart3, Users, Calendar, Settings, ArrowRight,
  Sparkles, BookOpen, Heart, Vote, Star, Plus, Eye, MessageSquare,
  Trophy, Target, Share2, TrendingUp, Flame, Bell, Search,
  Shuffle, ArrowLeftRight, Diamond, Brain, Dices, AlertTriangle,
  User, Shield, Mail, Megaphone, Library, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Shared sub-components ───

function QuickAction({ icon: Icon, label, accent }: { icon: any; label: string; accent?: boolean }) {
  return (
    <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
      accent
        ? "bg-primary text-primary-foreground hover:bg-primary/90"
        : "bg-muted hover:bg-muted/80 text-foreground"
    }`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function HubCard({ icon: Icon, title, description, bullets, color, badges }: {
  icon: any; title: string; description: string; bullets: string[]; color: string;
  badges?: { label: string; variant: "default" | "secondary" | "destructive" | "outline" }[];
}) {
  return (
    <div className="rounded-2xl border bg-card hover:shadow-md transition-shadow p-5 cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </div>
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      <div className="mt-3 space-y-0.5">
        {bullets.map(s => (
          <p key={s} className="text-[11px] text-muted-foreground">• {s}</p>
        ))}
      </div>
      {badges && badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {badges.map(b => <Badge key={b.label} variant={b.variant} className="text-[10px]">{b.label}</Badge>)}
        </div>
      )}
    </div>
  );
}

function ActivityLine({ emoji, text, time }: { emoji: string; text: string; time: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{emoji}</span>
      <span className="text-foreground text-xs flex-1">{text}</span>
      <span className="text-[10px] text-muted-foreground">{time}</span>
    </div>
  );
}

function GreetingHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back, Player</h1>
        <p className="text-sm text-muted-foreground">Your board game command center</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive text-[8px] text-primary-foreground flex items-center justify-center font-bold">3</span>
        </div>
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">P</span>
        </div>
      </div>
    </div>
  );
}

function QuickActionsStrip() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <QuickAction icon={Plus} label="Add Game" accent />
      <QuickAction icon={Dices} label="Log Play" />
      <QuickAction icon={Shuffle} label="Random Pick" />
      <QuickAction icon={Search} label="Browse Catalog" />
    </div>
  );
}

function RecentActivity() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-400" />
        Recent Activity
      </h3>
      <div className="space-y-2">
        <ActivityLine emoji="🎲" text="Logged a play of Brass: Birmingham" time="2h ago" />
        <ActivityLine emoji="📦" text="Added Ark Nova to collection" time="1d ago" />
        <ActivityLine emoji="🤝" text="Jake requested to borrow Pandemic" time="2d ago" />
      </div>
    </div>
  );
}

// ─── 6-Card Hub (Tight) ───
function Hub6Cards() {
  return (
    <div className="space-y-6">
      <GreetingHeader />
      <QuickActionsStrip />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard
          icon={Gamepad2}
          title="My Collection"
          description="142 games · 23 expansions"
          bullets={["Browse, filter & manage your library", "Import from BGG · Add manually", "3 new this month · 12 unplayed"]}
          color="hsl(var(--primary))"
          badges={[{ label: "2 for sale", variant: "secondary" }]}
        />
        <HubCard
          icon={Sparkles}
          title="Insights & Analytics"
          description="Collection DNA, rarity, play stats"
          bullets={["🏰 Grand Strategist personality", "💎 5 unique games · Rarity scores", "Shareable cards · Monthly summary"]}
          color="hsl(262, 80%, 55%)"
          badges={[{ label: "New: Rarity!", variant: "default" }]}
        />
        <HubCard
          icon={BookOpen}
          title="Lending & Loans"
          description="Borrow, lend, and trade games"
          bullets={["3 pending loan requests", "Cross-library trading", "Borrower ratings & history"]}
          color="hsl(24, 80%, 50%)"
          badges={[{ label: "3 pending", variant: "destructive" }]}
        />
        <HubCard
          icon={Users}
          title="Community & Social"
          description="Forums, clubs, messages, challenges"
          bullets={["The Dice Knights · 8 members", "2 unread messages", "Forums · Clubs · Group challenges"]}
          color="hsl(200, 70%, 50%)"
          badges={[{ label: "2 unread", variant: "destructive" }]}
        />
        <HubCard
          icon={Calendar}
          title="Events & Polls"
          description="Game nights, tournaments, voting"
          bullets={["Next: Game Night · Sat 7pm", "1 active poll · 2 upcoming events", "RSVP management"]}
          color="hsl(340, 65%, 50%)"
        />
        <HubCard
          icon={Settings}
          title="Settings & Account"
          description="Profile, library config, preferences"
          bullets={["Profile & display name", "Library settings & theme", "Growth tools · Danger zone"]}
          color="hsl(var(--muted-foreground))"
        />
      </div>

      <RecentActivity />
    </div>
  );
}

// ─── 7-Card Hub (Balanced) ───
function Hub7Cards() {
  return (
    <div className="space-y-6">
      <GreetingHeader />
      <QuickActionsStrip />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard
          icon={Gamepad2}
          title="My Collection"
          description="142 games · 23 expansions"
          bullets={["Browse, filter & manage games", "Import from BGG · Add manually", "Shelf of shame tracker"]}
          color="hsl(var(--primary))"
          badges={[{ label: "12 unplayed", variant: "secondary" }]}
        />
        <HubCard
          icon={BookOpen}
          title="Lending & Loans"
          description="Borrow, lend, and trade"
          bullets={["3 pending loan requests", "Cross-library trading hub", "Borrower ratings"]}
          color="hsl(24, 80%, 50%)"
          badges={[{ label: "3 pending", variant: "destructive" }]}
        />
        <HubCard
          icon={Sparkles}
          title="Insights & DNA"
          description="Personality, rarity, shareables"
          bullets={["🏰 Grand Strategist", "💎 5 unique games", "Shareable cards & exports"]}
          color="hsl(262, 80%, 55%)"
          badges={[{ label: "New!", variant: "default" }]}
        />
        <HubCard
          icon={BarChart3}
          title="Analytics"
          description="Play stats, value tracking"
          bullets={["47 plays logged · 38% win rate", "Collection value: $2,840", "Monthly summary reports"]}
          color="hsl(142, 60%, 45%)"
        />
        <HubCard
          icon={Users}
          title="Community & Forums"
          description="Clubs, forums, challenges"
          bullets={["The Dice Knights · 8 members", "3 active forum threads", "Group challenges"]}
          color="hsl(200, 70%, 50%)"
        />
        <HubCard
          icon={Mail}
          title="Messages & Social"
          description="DMs, inquiries, notifications"
          bullets={["2 unread messages", "1 game inquiry", "Activity feed"]}
          color="hsl(340, 65%, 50%)"
          badges={[{ label: "2 unread", variant: "destructive" }]}
        />
        <HubCard
          icon={Settings}
          title="Settings & Account"
          description="Profile, library, preferences"
          bullets={["Profile & display name", "Library config & theme", "Danger zone · Growth tools"]}
          color="hsl(var(--muted-foreground))"
        />
      </div>

      <RecentActivity />
    </div>
  );
}

// ─── 8+ Card Hub (Nothing Hidden) ───
function Hub8Cards() {
  return (
    <div className="space-y-6">
      <GreetingHeader />
      <QuickActionsStrip />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <HubCard
          icon={Gamepad2}
          title="My Collection"
          description="142 games · 23 expansions"
          bullets={["Browse & manage full library", "Import · Add · Filter"]}
          color="hsl(var(--primary))"
        />
        <HubCard
          icon={BookOpen}
          title="Lending"
          description="Loans & borrowing"
          bullets={["3 pending requests", "Borrower ratings"]}
          color="hsl(24, 80%, 50%)"
          badges={[{ label: "3 pending", variant: "destructive" }]}
        />
        <HubCard
          icon={Sparkles}
          title="Insights"
          description="DNA, rarity, shareables"
          bullets={["🏰 Grand Strategist", "💎 5 unique games"]}
          color="hsl(262, 80%, 55%)"
          badges={[{ label: "New!", variant: "default" }]}
        />
        <HubCard
          icon={BarChart3}
          title="Analytics"
          description="Plays, stats, value"
          bullets={["47 plays · 38% win rate", "Collection value tracking"]}
          color="hsl(142, 60%, 45%)"
        />
        <HubCard
          icon={MessageSquare}
          title="Forums"
          description="Community discussions"
          bullets={["3 active threads", "Create & reply"]}
          color="hsl(200, 70%, 50%)"
        />
        <HubCard
          icon={Users}
          title="Clubs & Members"
          description="Groups & communities"
          bullets={["The Dice Knights", "8 members · Invite codes"]}
          color="hsl(210, 60%, 45%)"
        />
        <HubCard
          icon={Mail}
          title="Messages"
          description="DMs & inquiries"
          bullets={["2 unread messages", "Game inquiries"]}
          color="hsl(340, 65%, 50%)"
          badges={[{ label: "2 unread", variant: "destructive" }]}
        />
        <HubCard
          icon={Calendar}
          title="Events"
          description="Game nights & polls"
          bullets={["Sat 7pm Game Night", "1 active poll"]}
          color="hsl(280, 60%, 50%)"
        />
        <HubCard
          icon={ArrowLeftRight}
          title="Trading"
          description="Cross-library trades"
          bullets={["Trade center", "Browse offers"]}
          color="hsl(160, 60%, 40%)"
        />
        <HubCard
          icon={Trophy}
          title="Achievements"
          description="Badges & milestones"
          bullets={["12 unlocked", "3 in progress"]}
          color="hsl(45, 80%, 50%)"
        />
        <HubCard
          icon={Share2}
          title="Growth Tools"
          description="Share & grow your library"
          bullets={["Embed widgets", "Referral links"]}
          color="hsl(170, 60%, 45%)"
        />
        <HubCard
          icon={Settings}
          title="Settings"
          description="Account & preferences"
          bullets={["Profile · Theme", "Danger zone"]}
          color="hsl(var(--muted-foreground))"
        />
      </div>

      <RecentActivity />
    </div>
  );
}

// ─── Main toggle wrapper ───
type MockupMode = "hub6" | "hub7" | "hub8";

const MODES: { key: MockupMode; label: string; description: string }[] = [
  { key: "hub6", label: "6 Cards (Tight)", description: "Features grouped into 6 clear categories. Least visual clutter, but some features are nested deeper (e.g. forums inside Community)." },
  { key: "hub7", label: "7 Cards (Balanced)", description: "Splits Analytics from Insights and Messages from Community. Good middle ground — everything is 1 click away." },
  { key: "hub8", label: "8+ Cards (Max Visibility)", description: "Every major feature gets its own card. Nothing is hidden, but denser grid. Uses 4-column layout on desktop." },
];

export function DashboardMockups() {
  const [mode, setMode] = useState<MockupMode>("hub6");

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      {/* Mode selector */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground mb-1">Hub & Spoke Mockups</h2>
        <p className="text-xs text-muted-foreground mb-4">Each card links to a dedicated page. Compare 3 density levels to find the right balance.</p>

        <div className="flex items-center gap-2 p-1 rounded-xl bg-muted w-fit flex-wrap">
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description of current mode */}
      <div className="text-xs text-muted-foreground mb-4 italic p-3 rounded-lg bg-muted/50 border">
        {MODES.find(m => m.key === mode)?.description}
      </div>

      {/* Feature coverage checklist */}
      <FeatureCoverage mode={mode} />

      {/* Mockup */}
      {mode === "hub6" && <Hub6Cards />}
      {mode === "hub7" && <Hub7Cards />}
      {mode === "hub8" && <Hub8Cards />}
    </div>
  );
}

// Shows which features live where in each layout
function FeatureCoverage({ mode }: { mode: MockupMode }) {
  const features = [
    "Full Library", "Lending/Loans", "Insights/DNA", "Analytics", "Forums",
    "Clubs", "Messages/DMs", "Events", "Polls", "Trading",
    "Achievements", "Growth Tools", "Profile/Account", "Danger Zone",
  ];

  const mapping: Record<MockupMode, Record<string, string>> = {
    hub6: {
      "Full Library": "My Collection", "Lending/Loans": "Lending & Loans",
      "Insights/DNA": "Insights & Analytics", "Analytics": "Insights & Analytics",
      "Forums": "Community & Social", "Clubs": "Community & Social",
      "Messages/DMs": "Community & Social", "Events": "Events & Polls",
      "Polls": "Events & Polls", "Trading": "Lending & Loans",
      "Achievements": "Insights & Analytics", "Growth Tools": "Settings & Account",
      "Profile/Account": "Settings & Account", "Danger Zone": "Settings & Account",
    },
    hub7: {
      "Full Library": "My Collection", "Lending/Loans": "Lending & Loans",
      "Insights/DNA": "Insights & DNA", "Analytics": "Analytics",
      "Forums": "Community & Forums", "Clubs": "Community & Forums",
      "Messages/DMs": "Messages & Social", "Events": "Community & Forums",
      "Polls": "Community & Forums", "Trading": "Lending & Loans",
      "Achievements": "Insights & DNA", "Growth Tools": "Settings & Account",
      "Profile/Account": "Settings & Account", "Danger Zone": "Settings & Account",
    },
    hub8: {
      "Full Library": "My Collection", "Lending/Loans": "Lending",
      "Insights/DNA": "Insights", "Analytics": "Analytics",
      "Forums": "Forums", "Clubs": "Clubs & Members",
      "Messages/DMs": "Messages", "Events": "Events",
      "Polls": "Events", "Trading": "Trading",
      "Achievements": "Achievements", "Growth Tools": "Growth Tools",
      "Profile/Account": "Settings", "Danger Zone": "Settings",
    },
  };

  const map = mapping[mode];

  return (
    <details className="mb-6 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
        📋 Feature coverage map — where does everything live?
      </summary>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 p-3 rounded-lg bg-muted/30 border">
        {features.map(f => (
          <div key={f} className="flex items-center gap-1.5">
            <span className="text-green-500">✓</span>
            <span className="text-foreground">{f}</span>
            <span className="text-muted-foreground">→ {map[f]}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
