import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, BookOpen, Users, ScanLine, Star, Clock,
  AlertTriangle, CheckCircle, Package, MapPin, ArrowRight,
  Search, UserPlus, BarChart3, Gamepad2, Trophy, TrendingUp,
  Timer, Eye, Sparkles, ChevronRight, Wifi, WifiOff
} from "lucide-react";

// ─── Mock Data ───

const MOCK_ACTIVE_LOANS = [
  { id: 1, game: "Wingspan", borrower: "Sarah M.", table: "Table 12", timeOut: "1h 23m", condition: "Great", copy: "#2" },
  { id: 2, game: "Terraforming Mars", borrower: "Jake R.", table: "Table 5", timeOut: "45m", condition: "Good", copy: "#1" },
  { id: 3, game: "Catan", borrower: "Emily W.", table: "Table 8", timeOut: "2h 10m", condition: "Great", copy: "#3" },
  { id: 4, game: "Azul", borrower: "Marcus T.", table: "Table 3", timeOut: "15m", condition: "Good", copy: "#1" },
  { id: 5, game: "Ticket to Ride", borrower: "Lisa K.", table: "Table 20", timeOut: "3h 05m", condition: "Fair", copy: "#1" },
];

const MOCK_QUEUE = [
  { id: 1, game: "Gloomhaven", requestedBy: "Tom B.", waitTime: "12m" },
  { id: 2, game: "Scythe", requestedBy: "Anna P.", waitTime: "5m" },
];

const MOCK_POPULAR = [
  { game: "Wingspan", checkouts: 18, avgTime: "1h 45m", rating: 4.8 },
  { game: "Catan", checkouts: 15, avgTime: "2h 10m", rating: 4.2 },
  { game: "Azul", checkouts: 14, avgTime: "35m", rating: 4.6 },
  { game: "Terraforming Mars", checkouts: 11, avgTime: "2h 30m", rating: 4.7 },
  { game: "Ticket to Ride", checkouts: 10, avgTime: "1h 15m", rating: 4.1 },
];

const MOCK_INVENTORY = [
  { game: "Wingspan", totalCopies: 3, available: 1, checkedOut: 2, location: "Shelf A-3" },
  { game: "Catan", totalCopies: 4, available: 1, checkedOut: 3, location: "Shelf B-1" },
  { game: "Terraforming Mars", totalCopies: 2, available: 1, checkedOut: 1, location: "Shelf A-5" },
  { game: "Azul", totalCopies: 3, available: 2, checkedOut: 1, location: "Shelf C-2" },
  { game: "Gloomhaven", totalCopies: 1, available: 0, checkedOut: 1, location: "Shelf D-1" },
  { game: "Scythe", totalCopies: 2, available: 0, checkedOut: 2, location: "Shelf A-7" },
  { game: "Ticket to Ride", totalCopies: 3, available: 2, checkedOut: 1, location: "Shelf B-4" },
  { game: "Pandemic", totalCopies: 2, available: 2, checkedOut: 0, location: "Shelf C-1" },
];

// ─── Staff Command Center ───

function StaffDashboard() {
  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Active Loans" value="47" trend="+8 this hour" color="text-primary" />
        <StatCard icon={Users} label="Registered Today" value="132" trend="+23 walk-ups" color="text-secondary" />
        <StatCard icon={Package} label="Games Available" value="89 / 156" trend="57% checked out" color="text-accent" />
        <StatCard icon={AlertTriangle} label="Overdue" value="3" trend="2 flagged" color="text-destructive" />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Active Loans Feed */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Active Loans — Live
              </CardTitle>
              <Badge variant="outline" className="animate-pulse border-primary text-primary">
                <Wifi className="h-3 w-3 mr-1" /> Real-time
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {MOCK_ACTIVE_LOANS.map((loan) => (
              <div key={loan.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{loan.game} <span className="text-muted-foreground text-xs">{loan.copy}</span></p>
                    <p className="text-xs text-muted-foreground">{loan.borrower} · {loan.table}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={loan.timeOut.includes("3h") ? "destructive" : "secondary"} className="text-xs">
                    <Timer className="h-3 w-3 mr-1" />{loan.timeOut}
                  </Badge>
                  <Button size="sm" variant="outline" className="text-xs h-7">Return</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Queue */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-secondary" />
                Waitlist Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {MOCK_QUEUE.map((q) => (
                <div key={q.id} className="flex items-center justify-between p-2 rounded bg-secondary/10">
                  <div>
                    <p className="text-sm font-medium">{q.game}</p>
                    <p className="text-xs text-muted-foreground">{q.requestedBy} · {q.waitTime} ago</p>
                  </div>
                  <Button size="sm" variant="secondary" className="text-xs h-6">Notify</Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-16 flex-col gap-1 text-xs">
                <ScanLine className="h-5 w-5" />
                Scan Badge
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1 text-xs">
                <UserPlus className="h-5 w-5" />
                Walk-up
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1 text-xs">
                <Search className="h-5 w-5" />
                Find Game
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1 text-xs">
                <AlertTriangle className="h-5 w-5" />
                Flag Issue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Lending Desk ───

function LendingDesk() {
  return (
    <div className="space-y-6">
      {/* Scan / Search Bar */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Scan badge, search game, or type borrower name..."
                className="pl-10 h-12 text-lg"
              />
            </div>
            <Button size="lg" className="h-12 px-6">
              <ScanLine className="h-5 w-5 mr-2" />
              Scan
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Scan an attendee badge or game barcode to start a checkout/return flow
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Checkout Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <ArrowRight className="h-5 w-5" />
              Check Out
            </CardTitle>
            <CardDescription>Assign a game to an attendee</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg border-2 border-dashed border-border flex flex-col items-center gap-2 text-muted-foreground">
              <ScanLine className="h-8 w-8" />
              <p className="text-sm">Scan or select a game to begin checkout</p>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Borrower</span>
                <span className="font-medium">—</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Game</span>
                <span className="font-medium">—</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Copy / Condition</span>
                <span className="font-medium">—</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Table Assignment</span>
                <span className="font-medium">—</span>
              </div>
              <Separator />
              <Button className="w-full" disabled>Confirm Checkout</Button>
            </div>
          </CardContent>
        </Card>

        {/* Return Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-accent">
              <CheckCircle className="h-5 w-5" />
              Return
            </CardTitle>
            <CardDescription>Process a game return with condition check + quick review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg border-2 border-dashed border-border flex flex-col items-center gap-2 text-muted-foreground">
              <ScanLine className="h-8 w-8" />
              <p className="text-sm">Scan game barcode or badge to find active loan</p>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Condition Out</span>
                <span className="font-medium">—</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Condition In</span>
                <span className="font-medium">—</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quick Rating</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className="h-4 w-4 text-muted-foreground/30" />
                  ))}
                </div>
              </div>
              <Separator />
              <Button className="w-full" variant="secondary" disabled>Confirm Return</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory at a Glance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Inventory — Live Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {MOCK_INVENTORY.map((item) => (
              <div key={item.game} className="p-3 rounded-lg border bg-card">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-sm">{item.game}</p>
                  <Badge variant={item.available === 0 ? "destructive" : "secondary"} className="text-xs">
                    {item.available === 0 ? "All Out" : `${item.available} avail`}
                  </Badge>
                </div>
                <Progress value={(item.checkedOut / item.totalCopies) * 100} className="h-1.5 mb-1" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{item.checkedOut}/{item.totalCopies} out</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.location}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Kiosk Mode (Attendee-Facing) ───

function KioskMode() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 py-4">
        <h2 className="text-3xl font-display text-primary">🎲 Game Library</h2>
        <p className="text-muted-foreground">Browse available games · Tap to request</p>
      </div>

      {/* Search */}
      <div className="max-w-xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input placeholder="Search games by name, player count, or type..." className="pl-12 h-14 text-lg rounded-full" />
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap justify-center gap-2">
        {["🔥 Trending", "⏱ Quick (< 30min)", "👥 Party Games", "🧩 Strategy", "👨‍👩‍👧‍👦 Family", "🆕 New Arrivals"].map(f => (
          <Button key={f} variant="outline" className="rounded-full">{f}</Button>
        ))}
      </div>

      {/* Available Games Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {MOCK_INVENTORY.filter(g => g.available > 0).map((game) => (
          <Card key={game.game} className="card-hover cursor-pointer overflow-hidden">
            <div className="aspect-square bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Gamepad2 className="h-16 w-16 text-primary/40" />
            </div>
            <CardContent className="p-3">
              <p className="font-display font-medium">{game.game}</p>
              <div className="flex items-center justify-between mt-1">
                <Badge variant="secondary" className="text-xs">{game.available} available</Badge>
                <span className="text-xs text-muted-foreground">{game.location}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Checked out games - "Notify Me" */}
      <div>
        <h3 className="font-display text-lg mb-3 text-muted-foreground">Currently Checked Out — Join Waitlist</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 opacity-70">
          {MOCK_INVENTORY.filter(g => g.available === 0).map((game) => (
            <Card key={game.game} className="cursor-pointer overflow-hidden border-dashed">
              <div className="aspect-square bg-muted/50 flex items-center justify-center relative">
                <Gamepad2 className="h-16 w-16 text-muted-foreground/20" />
                <Badge className="absolute top-2 right-2 bg-destructive/80 text-destructive-foreground text-xs">All out</Badge>
              </div>
              <CardContent className="p-3">
                <p className="font-display font-medium">{game.game}</p>
                <Button variant="outline" size="sm" className="w-full mt-2 text-xs">
                  🔔 Notify Me
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Attendee Onboarding Flow ───

function AttendeeOnboarding() {
  const [step, setStep] = useState(1);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2 py-4">
        <h2 className="text-2xl font-display text-primary">Welcome to the Game Library</h2>
        <p className="text-muted-foreground">Get set up in under 30 seconds</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[1,2,3].map(s => (
          <div key={s} className="flex-1 flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {s < step ? <CheckCircle className="h-4 w-4" /> : s}
            </div>
            {s < 3 && <div className={`flex-1 h-0.5 ${s < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <ScanLine className="h-12 w-12 text-primary mx-auto" />
                <h3 className="font-display text-lg">Scan Your Badge</h3>
                <p className="text-sm text-muted-foreground">Hold your convention badge up to the scanner</p>
              </div>
              <div className="p-8 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 text-center">
                <p className="text-muted-foreground text-sm">📷 Camera / Scanner Area</p>
              </div>
              <Separator />
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">No badge? No problem.</p>
                <Button variant="outline" onClick={() => setStep(2)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Quick Sign Up Instead
                </Button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg text-center">Quick Sign Up</h3>
              <p className="text-sm text-muted-foreground text-center">Just a name — everything else is optional</p>
              <Input placeholder="Your name" className="h-12" />
              <Input placeholder="Email (optional — claim plays later)" className="h-12" />
              <Input placeholder="Phone (optional — for waitlist texts)" className="h-12" />
              <Button className="w-full h-12" onClick={() => setStep(3)}>
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display text-lg">You're All Set!</h3>
              <p className="text-sm text-muted-foreground">
                Head to any lending desk to check out a game. Show your badge or tell them your name.
              </p>
              <Card className="bg-muted/50">
                <CardContent className="pt-4 text-left space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Session</p>
                  <p className="text-sm"><strong>Guest #247</strong> — Sarah M.</p>
                  <p className="text-xs text-muted-foreground">After the convention, sign up with your email to keep your play history, reviews, and stats permanently.</p>
                </CardContent>
              </Card>
              <Button className="w-full" onClick={() => setStep(1)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Browse Games
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Event Analytics Preview ───

function AnalyticsPreview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Attendees" value="847" trend="Convention total" color="text-primary" />
        <StatCard icon={BookOpen} label="Total Checkouts" value="1,243" trend="Avg 1.5 per person" color="text-secondary" />
        <StatCard icon={Star} label="Reviews Collected" value="312" trend="Living reviews" color="text-accent" />
        <StatCard icon={Trophy} label="Unique Games Played" value="89" trend="of 156 available" color="text-primary" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Most Popular */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Most Popular Games
            </CardTitle>
            <CardDescription>By total checkouts this event</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_POPULAR.map((game, i) => (
              <div key={game.game} className="flex items-center gap-3">
                <span className="text-lg font-display text-muted-foreground w-6 text-right">#{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{game.game}</p>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-secondary fill-secondary" />
                      <span className="text-xs font-medium">{game.rating}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{game.checkouts} checkouts</span>
                    <span>Avg play: {game.avgTime}</span>
                  </div>
                  <Progress value={(game.checkouts / 20) * 100} className="h-1 mt-1" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Publisher Insights Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Publisher Report Card
            </CardTitle>
            <CardDescription>Sample: Stonemaier Games</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-primary/5 text-center">
                <p className="text-2xl font-display text-primary">4.7</p>
                <p className="text-xs text-muted-foreground">Living Review Score</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/10 text-center">
                <p className="text-2xl font-display text-secondary">43</p>
                <p className="text-xs text-muted-foreground">Total Checkouts</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/10 text-center">
                <p className="text-2xl font-display text-accent">2.1h</p>
                <p className="text-xs text-muted-foreground">Avg Session</p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-2xl font-display">78%</p>
                <p className="text-xs text-muted-foreground">Replay Rate</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Key Insight</p>
              <p className="text-sm">
                <Sparkles className="h-3.5 w-3.5 inline mr-1 text-secondary" />
                Wingspan's <strong>Living Review</strong> score increased from 4.5 → 4.8 during this event, driven by 18 verified plays from first-time players. 
                <strong> This data is impossible to get from BGG.</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Engagement Timeline — Saturday
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {[2,5,12,18,32,45,52,48,55,61,58,42,38,28,15,8].map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-primary to-primary/60"
                  style={{ height: `${(v / 61) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
            <span>8am</span>
            <span>12pm</span>
            <span>4pm</span>
            <span>11pm</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stat Card Component ───

function StatCard({ icon: Icon, label, value, trend, color }: {
  icon: any; label: string; value: string; trend: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <Icon className={`h-5 w-5 ${color}`} />
          <span className="text-xs text-muted-foreground">{trend}</span>
        </div>
        <p className="text-2xl font-display">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───

export default function ConventionMockup() {
  return (
    <div className="min-h-screen parchment-texture">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display text-primary flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6" />
              Convention Operations Hub
            </h1>
            <p className="text-sm text-muted-foreground">
              LTN Board Game Nights — GenCon 2026 <Badge variant="outline" className="ml-2 text-xs">MOCKUP</Badge>
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
            <Wifi className="h-3 w-3 mr-1" /> All Stations Connected
          </Badge>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="dashboard" className="text-xs">
              <LayoutDashboard className="h-3.5 w-3.5 mr-1" />Command
            </TabsTrigger>
            <TabsTrigger value="lending" className="text-xs">
              <BookOpen className="h-3.5 w-3.5 mr-1" />Lending Desk
            </TabsTrigger>
            <TabsTrigger value="kiosk" className="text-xs">
              <Gamepad2 className="h-3.5 w-3.5 mr-1" />Kiosk
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="text-xs">
              <UserPlus className="h-3.5 w-3.5 mr-1" />Onboarding
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">
              <BarChart3 className="h-3.5 w-3.5 mr-1" />Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><StaffDashboard /></TabsContent>
          <TabsContent value="lending"><LendingDesk /></TabsContent>
          <TabsContent value="kiosk"><KioskMode /></TabsContent>
          <TabsContent value="onboarding"><AttendeeOnboarding /></TabsContent>
          <TabsContent value="analytics"><AnalyticsPreview /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
