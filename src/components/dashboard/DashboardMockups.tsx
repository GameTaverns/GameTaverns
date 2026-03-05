import { useState } from "react";
import { 
  Gamepad2, BarChart3, Users, Calendar, Settings, ArrowRight, 
  Sparkles, BookOpen, Heart, Vote, Star, Plus, Eye, MessageSquare,
  Trophy, Target, Share2, TrendingUp, Flame, Bell, Search,
  Shuffle, ArrowLeftRight, Diamond, Brain, Dices
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Hub & Spoke Layout ───
function HubAndSpokeMockup() {
  return (
    <div className="space-y-6">
      {/* Clean greeting header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back, Player</h1>
          <p className="text-sm text-muted-foreground">Your board game command center</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">P</span>
          </div>
        </div>
      </div>

      {/* Quick action strip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <QuickAction icon={Plus} label="Add Game" accent />
        <QuickAction icon={Dices} label="Log Play" />
        <QuickAction icon={Shuffle} label="Random Pick" />
        <QuickAction icon={Search} label="Browse Catalog" />
      </div>

      {/* Hub cards — 6 clear entry points */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard
          icon={Gamepad2}
          title="My Collection"
          description="142 games · 23 expansions"
          stats={["3 new this month", "12 unplayed"]}
          color="hsl(var(--primary))"
          badges={[{ label: "2 for sale", variant: "secondary" as const }]}
        />
        <HubCard
          icon={Sparkles}
          title="Insights & Shareables"
          description="Your Collection DNA & stats"
          stats={["🏰 Grand Strategist", "💎 5 unique games"]}
          color="hsl(262, 80%, 55%)"
          badges={[{ label: "New!", variant: "default" as const }]}
        />
        <HubCard
          icon={BarChart3}
          title="Play Analytics"
          description="47 sessions logged"
          stats={["12 this month", "Win rate: 38%"]}
          color="hsl(142, 60%, 45%)"
        />
        <HubCard
          icon={Users}
          title="Community"
          description="The Dice Knights · 8 members"
          stats={["3 pending loans", "2 unread messages"]}
          color="hsl(200, 70%, 50%)"
          badges={[{ label: "3 pending", variant: "destructive" as const }]}
        />
        <HubCard
          icon={Calendar}
          title="Events"
          description="Next: Game Night · Sat 7pm"
          stats={["2 upcoming", "1 poll active"]}
          color="hsl(340, 65%, 50%)"
        />
        <HubCard
          icon={Settings}
          title="Settings"
          description="Library, account & theme"
          stats={["Library: The Dice Knights"]}
          color="hsl(var(--muted-foreground))"
        />
      </div>

      {/* Optional: Recent activity stream (minimal) */}
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
    </div>
  );
}

// ─── Smart Home + Insights ───
function SmartHomeMockup() {
  const [insightsOpen, setInsightsOpen] = useState(false);

  if (insightsOpen) {
    return (
      <div className="space-y-6">
        {/* Insights page header */}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => setInsightsOpen(false)} className="text-xs text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1">
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Collection Insights
            </h1>
            <p className="text-sm text-muted-foreground">Deep dive into your collection intelligence</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Share2 className="h-3.5 w-3.5" /> Share All
          </Button>
        </div>

        {/* Full insights layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Collection DNA card preview */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-5 border">
            <p className="text-xs font-bold text-muted-foreground tracking-wider mb-2">GAMING PERSONALITY</p>
            <div className="text-center py-4">
              <span className="text-5xl">🏰</span>
              <h3 className="text-xl font-extrabold mt-2">The Grand Strategist</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[250px] mx-auto">Deep strategy and resource management define your play style</p>
            </div>
            <div className="flex justify-center gap-2 mt-2">
              <Button size="sm" variant="outline" className="text-xs gap-1"><Share2 className="h-3 w-3" /> Share Card</Button>
              <Button size="sm" variant="outline" className="text-xs gap-1"><Eye className="h-3 w-3" /> Preview</Button>
            </div>
          </div>

          {/* Rarity */}
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-bold text-muted-foreground tracking-wider mb-3">COLLECTION RARITY</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <span className="text-3xl">💎</span>
                <p className="text-2xl font-black mt-1">5</p>
                <p className="text-[10px] text-muted-foreground">Games only you own</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <span className="text-3xl">✨</span>
                <p className="text-2xl font-black mt-1">12</p>
                <p className="text-[10px] text-muted-foreground">Rare (≤3 owners)</p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <RareLine emoji="💎" title="Oath: Chronicles of Empire" tag="Only you!" />
              <RareLine emoji="💎" title="Pax Pamir 2E (KS Deluxe)" tag="Only you!" />
              <RareLine emoji="✨" title="Food Chain Magnate" tag="2 owners" />
            </div>
          </div>

          {/* Mechanic DNA */}
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-bold text-muted-foreground tracking-wider mb-3">MECHANIC DNA</p>
            <div className="space-y-2">
              <MechanicBar name="Worker Placement" pct={72} />
              <MechanicBar name="Engine Building" pct={58} />
              <MechanicBar name="Area Control" pct={45} />
              <MechanicBar name="Hand Management" pct={38} />
              <MechanicBar name="Deck Building" pct={31} />
            </div>
          </div>

          {/* Play stats */}
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-bold text-muted-foreground tracking-wider mb-3">PLAY INTELLIGENCE</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <StatBlock value="47" label="Total Plays" />
              <StatBlock value="38%" label="Win Rate" />
              <StatBlock value="1,247" label="ELO Rating" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <StatBlock value="2.8h" label="Avg Duration" />
              <StatBlock value="3.4" label="Avg Players" />
            </div>
          </div>

          {/* Shelf of Shame */}
          <div className="rounded-2xl border bg-card p-5 lg:col-span-2">
            <p className="text-xs font-bold text-muted-foreground tracking-wider mb-3">SHELF OF SHAME TRACKER</p>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-4xl font-black text-amber-500">18%</p>
                <p className="text-xs text-muted-foreground">26 of 142 unplayed</p>
              </div>
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-amber-500" style={{ width: "18%" }} />
              </div>
              <Button size="sm" variant="outline" className="text-xs gap-1 flex-shrink-0">
                <Share2 className="h-3 w-3" /> Share
              </Button>
            </div>
          </div>

          {/* Monthly / Top 9 shareables */}
          <div className="rounded-2xl border bg-card p-5 lg:col-span-2">
            <p className="text-xs font-bold text-muted-foreground tracking-wider mb-3">SHAREABLE CARDS</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ShareableThumb label="Collection DNA" emoji="🧬" />
              <ShareableThumb label="Monthly Summary" emoji="📊" />
              <ShareableThumb label="Top 9 Grid" emoji="🏆" />
              <ShareableThumb label="Year in Review" emoji="📅" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Smart greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back, Player</h1>
          <p className="text-sm text-muted-foreground">3 things need your attention</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive text-[8px] text-white flex items-center justify-center font-bold">3</span>
          </div>
        </div>
      </div>

      {/* Action items — smart, contextual */}
      <div className="space-y-2">
        <ActionItem icon={ArrowLeftRight} text="Jake wants to borrow Pandemic" action="Review" urgent />
        <ActionItem icon={Trophy} text="You unlocked 'Shelf Explorer' achievement!" action="View" />
        <ActionItem icon={Calendar} text="Game Night is Saturday at 7pm" action="RSVP" />
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <QuickAction icon={Plus} label="Add Game" accent />
        <QuickAction icon={Dices} label="Log Play" />
        <QuickAction icon={Shuffle} label="Random Pick" />
      </div>

      {/* Compact stats row */}
      <div className="grid grid-cols-4 gap-2">
        <MiniStat value="142" label="Games" icon={Gamepad2} />
        <MiniStat value="47" label="Plays" icon={BarChart3} />
        <MiniStat value="38%" label="Win Rate" icon={Trophy} />
        <MiniStat value="18%" label="Unplayed" icon={Target} />
      </div>

      {/* Insights CTA — the bridge to the dedicated page */}
      <button
        onClick={() => setInsightsOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors p-4 text-left group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Collection Insights</p>
              <p className="text-xs text-muted-foreground">DNA · Rarity · Shareables · Analytics</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-0.5 transition-transform" />
        </div>
        <div className="flex gap-3 mt-3">
          <Badge variant="secondary" className="text-[10px]">🏰 Grand Strategist</Badge>
          <Badge variant="secondary" className="text-[10px]">💎 5 unique games</Badge>
          <Badge variant="secondary" className="text-[10px]">🧬 72% Worker Placement</Badge>
        </div>
      </button>

      {/* Two-column: community + events */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" /> Community
          </h3>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground text-xs">The Dice Knights · 8 members</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs flex-1">Forum</Button>
              <Button size="sm" variant="outline" className="text-xs flex-1">Members</Button>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-primary" /> Upcoming
          </h3>
          <div className="space-y-1.5">
            <EventLine title="Game Night" date="Sat, Mar 8" />
            <EventLine title="Tournament" date="Mar 15" />
          </div>
        </div>
      </div>
    </div>
  );
}

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

function HubCard({ icon: Icon, title, description, stats, color, badges }: {
  icon: any; title: string; description: string; stats: string[]; color: string; badges?: { label: string; variant: "default" | "secondary" | "destructive" }[];
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
        {stats.map(s => (
          <p key={s} className="text-[11px] text-muted-foreground">• {s}</p>
        ))}
      </div>
      {badges && badges.length > 0 && (
        <div className="flex gap-1.5 mt-2">
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

function ActionItem({ icon: Icon, text, action, urgent }: { icon: any; text: string; action: string; urgent?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${urgent ? "border-destructive/30 bg-destructive/5" : "bg-card"}`}>
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${urgent ? "bg-destructive/10" : "bg-muted"}`}>
        <Icon className={`h-4 w-4 ${urgent ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <span className="text-xs text-foreground flex-1">{text}</span>
      <Button size="sm" variant={urgent ? "destructive" : "outline"} className="text-xs h-7 px-3">{action}</Button>
    </div>
  );
}

function MiniStat({ value, label, icon: Icon }: { value: string; label: string; icon: any }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
      <p className="text-lg font-bold text-foreground leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function EventLine({ title, date }: { title: string; date: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-foreground">{title}</span>
      <span className="text-muted-foreground">{date}</span>
    </div>
  );
}

function MechanicBar({ name, pct }: { name: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-[120px] truncate text-right text-muted-foreground">{name}</span>
      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-[32px] text-right tabular-nums">{pct}%</span>
    </div>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-xl font-black text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function RareLine({ emoji, title, tag }: { emoji: string; title: string; tag: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span>{emoji}</span>
      <span className="text-foreground truncate flex-1">{title}</span>
      <span className="text-primary font-semibold flex-shrink-0">{tag}</span>
    </div>
  );
}

function ShareableThumb({ label, emoji }: { label: string; emoji: string }) {
  return (
    <div className="rounded-xl border bg-muted/50 p-3 text-center hover:bg-muted transition-colors cursor-pointer">
      <span className="text-2xl">{emoji}</span>
      <p className="text-[10px] font-medium text-foreground mt-1">{label}</p>
      <p className="text-[9px] text-muted-foreground">Tap to generate</p>
    </div>
  );
}

// ─── Main toggle wrapper ───
export function DashboardMockups() {
  const [mode, setMode] = useState<"hub" | "smart">("hub");

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      {/* Toggle between mockups */}
      <div className="flex items-center gap-2 mb-6 p-1 rounded-xl bg-muted w-fit">
        <button
          onClick={() => setMode("hub")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "hub" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🏠 Hub & Spoke
        </button>
        <button
          onClick={() => setMode("smart")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "smart" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🧠 Smart Home + Insights
        </button>
      </div>

      <div className="text-xs text-muted-foreground mb-4 italic">
        {mode === "hub" 
          ? "Dashboard as a clean hub — each card leads to a dedicated page. No tabs, no clutter."
          : "Minimal action-oriented home. All intelligence lives on a dedicated Insights page (click the Insights card to preview it)."
        }
      </div>

      {mode === "hub" ? <HubAndSpokeMockup /> : <SmartHomeMockup />}
    </div>
  );
}
