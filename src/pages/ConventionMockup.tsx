import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import {
  LayoutDashboard, BookOpen, ScanLine, Star, Clock,
  AlertTriangle, CheckCircle, Package, ArrowRight, ArrowLeft,
  Search, BarChart3, Gamepad2,
  Timer, Wifi, CalendarClock,
  Hourglass, ChevronRight, Users, RotateCcw, UserCheck,
  Zap, Eye, ShieldCheck,
} from "lucide-react";

// ─── Mock Data ───

const MOCK_ACTIVE_LOANS = [
  { id: 1, game: "Wingspan", borrower: "Sarah M.", badgeId: "B-1042", timeOut: "1h 23m", condition: "Great", copy: "#2", overdue: false },
  { id: 2, game: "Terraforming Mars", borrower: "Jake R.", badgeId: "B-0891", timeOut: "45m", condition: "Good", copy: "#1", overdue: false },
  { id: 3, game: "Catan", borrower: "Emily W.", badgeId: "B-1205", timeOut: "2h 10m", condition: "Great", copy: "#3", overdue: false },
  { id: 4, game: "Azul", borrower: "Marcus T.", badgeId: "B-0756", timeOut: "15m", condition: "Good", copy: "#1", overdue: false },
  { id: 5, game: "Ticket to Ride", borrower: "Lisa K.", badgeId: "B-1398", timeOut: "3h 05m", condition: "Fair", copy: "#1", overdue: true },
];

const MOCK_RESERVATIONS = [
  { id: 1, game: "Scythe", reservedBy: "Tom B.", badgeId: "B-0423", expiresIn: "18m", status: "active" },
  { id: 2, game: "Gloomhaven", reservedBy: "Anna P.", badgeId: "B-1107", expiresIn: "7m", status: "active" },
  { id: 3, game: "Root", reservedBy: "Chris D.", badgeId: "B-0650", expiresIn: "Expired", status: "expired" },
];

const MOCK_INVENTORY = [
  { game: "Wingspan", totalCopies: 3, available: 1, checkedOut: 2, reserved: 0, players: "1-5", time: "45m" },
  { game: "Catan", totalCopies: 4, available: 1, checkedOut: 3, reserved: 0, players: "3-4", time: "60m" },
  { game: "Terraforming Mars", totalCopies: 2, available: 1, checkedOut: 1, reserved: 0, players: "1-5", time: "120m" },
  { game: "Azul", totalCopies: 3, available: 2, checkedOut: 1, reserved: 0, players: "2-4", time: "30m" },
  { game: "Gloomhaven", totalCopies: 1, available: 0, checkedOut: 0, reserved: 1, players: "1-4", time: "120m" },
  { game: "Scythe", totalCopies: 2, available: 0, checkedOut: 1, reserved: 1, players: "1-5", time: "115m" },
  { game: "Ticket to Ride", totalCopies: 3, available: 2, checkedOut: 1, reserved: 0, players: "2-5", time: "45m" },
  { game: "Pandemic", totalCopies: 2, available: 2, checkedOut: 0, reserved: 0, players: "2-4", time: "45m" },
];

// ─── Shared Stat Bar ───

function StatBar() {
  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {[
        { label: "Active Loans", value: "47", icon: BookOpen, color: "text-primary" },
        { label: "Reservations", value: "12", icon: CalendarClock, color: "text-secondary" },
        { label: "Available", value: "89/156", icon: Package, color: "text-accent" },
        { label: "Overdue", value: "3", icon: AlertTriangle, color: "text-destructive" },
      ].map(s => (
        <div key={s.label} className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border/60">
          <s.icon className={`h-4 w-4 ${s.color}`} />
          <div>
            <p className="text-lg font-display leading-tight">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Reservation Queue (shared) ───

function ReservationQueue({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className={`font-medium flex items-center gap-1.5 ${compact ? "text-sm" : "text-base"}`}>
          <CalendarClock className="h-4 w-4 text-secondary" />
          Reservations
          <Badge variant="secondary" className="text-[10px] ml-1">{MOCK_RESERVATIONS.length}</Badge>
        </h3>
      </div>
      {MOCK_RESERVATIONS.map((r) => (
        <div key={r.id} className={`flex items-center justify-between p-2.5 rounded-lg ${r.status === "expired" ? "bg-destructive/10 border border-destructive/20" : "bg-secondary/10 border border-secondary/20"}`}>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{r.game}</p>
            <p className="text-xs text-muted-foreground">{r.reservedBy} · {r.badgeId}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={r.status === "expired" ? "destructive" : "outline"} className="text-[10px]">
              <Hourglass className="h-2.5 w-2.5 mr-0.5" />{r.expiresIn}
            </Badge>
            {r.status === "expired" ? (
              <Button size="sm" variant="destructive" className="text-[10px] h-6 px-2">Release</Button>
            ) : (
              <Button size="sm" variant="default" className="text-[10px] h-6 px-2">
                Fulfill <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Active Loans List (shared) ───

function ActiveLoansList({ showReturn = true }: { showReturn?: boolean }) {
  return (
    <div className="space-y-1.5">
      {MOCK_ACTIVE_LOANS.map((loan) => (
        <div key={loan.id} className={`flex items-center justify-between p-2.5 rounded-lg hover:bg-muted transition-colors ${loan.overdue ? "bg-destructive/5 border border-destructive/20" : "bg-muted/50"}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Gamepad2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{loan.game} <span className="text-muted-foreground text-xs">{loan.copy}</span></p>
              <p className="text-xs text-muted-foreground truncate">{loan.borrower} · {loan.badgeId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={loan.overdue ? "destructive" : "secondary"} className="text-[10px]">
              <Timer className="h-2.5 w-2.5 mr-0.5" />{loan.timeOut}
            </Badge>
            {showReturn && (
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-2">Return</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Checkout Form (shared) ───

function CheckoutForm() {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search game name or scan barcode..." className="pl-9 h-10" />
      </div>
      <div className="p-3 rounded-lg border-2 border-dashed border-border flex flex-col items-center gap-1.5 text-muted-foreground">
        <ScanLine className="h-6 w-6" />
        <p className="text-xs">Select a game to begin</p>
      </div>
      <Input placeholder="Borrower name or badge ID..." className="h-10" />
      <Button className="w-full" disabled>
        <ArrowRight className="h-4 w-4 mr-1.5" /> Confirm Checkout
      </Button>
    </div>
  );
}

// ─── Return Form (shared) ───

function ReturnForm() {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search active loan by game or borrower..." className="pl-9 h-10" />
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {MOCK_ACTIVE_LOANS.slice(0, 3).map(loan => (
          <div key={loan.id} className="p-2.5 rounded-lg bg-muted/50 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{loan.game} <span className="text-xs text-muted-foreground">{loan.copy}</span></p>
              <p className="text-xs text-muted-foreground">{loan.borrower}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className="h-3 w-3 text-muted-foreground/30" />
                ))}
              </div>
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-2">
                <RotateCcw className="h-3 w-3 mr-0.5" /> Return
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LAYOUT A: Two-Tab (Lending Desk + Analytics)
// Lending desk has side-by-side panes: left = checkout/return, right = reservations + loans feed
// ═══════════════════════════════════════════════════════════

function LayoutA() {
  const [subView, setSubView] = useState<"checkout" | "return">("checkout");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs font-medium">Layout A</Badge>
        <span className="text-sm text-muted-foreground">Two-tab: Lending Desk (split-pane) + Analytics — reservations integrated into the desk</span>
      </div>

      <StatBar />

      <div className="grid lg:grid-cols-5 gap-4" style={{ minHeight: 520 }}>
        {/* Left: Checkout / Return toggle */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={subView === "checkout" ? "default" : "ghost"}
              size="sm"
              className="flex-1 text-xs gap-1"
              onClick={() => setSubView("checkout")}
            >
              <ArrowRight className="h-3.5 w-3.5" /> Check Out
            </Button>
            <Button
              variant={subView === "return" ? "default" : "ghost"}
              size="sm"
              className="flex-1 text-xs gap-1"
              onClick={() => setSubView("return")}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Return
            </Button>
          </div>

          <Card className="border-primary/20">
            <CardContent className="pt-4">
              {subView === "checkout" ? <CheckoutForm /> : <ReturnForm />}
            </CardContent>
          </Card>

          {/* Reservation queue below the action pane */}
          <Card>
            <CardContent className="pt-4">
              <ReservationQueue compact />
            </CardContent>
          </Card>
        </div>

        {/* Right: Live loans feed */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Active Loans
              </CardTitle>
              <Badge variant="outline" className="animate-pulse border-primary text-primary text-[10px]">
                <Wifi className="h-2.5 w-2.5 mr-0.5" /> Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ActiveLoansList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LAYOUT B: Single-Page Dashboard (no tabs)
// Everything on one scrollable page: stats → unified search → 3-col (checkout | loans | reservations)
// ═══════════════════════════════════════════════════════════

function LayoutB() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs font-medium">Layout B</Badge>
        <span className="text-sm text-muted-foreground">Single page — no tabs, everything visible. Unified search bar at top. 3-column layout below.</span>
      </div>

      <StatBar />

      {/* Unified Search */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Scan badge, search game name, or borrower..."
                className="pl-10 h-11 text-base"
              />
            </div>
            <Button className="h-11 px-5 gap-1.5">
              <ScanLine className="h-4 w-4" /> Scan
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="secondary" size="sm" className="text-xs gap-1">
              <ArrowRight className="h-3 w-3" /> Check Out
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1">
              <RotateCcw className="h-3 w-3" /> Return
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1">
              <UserCheck className="h-3 w-3" /> Badge Lookup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Three columns */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Col 1: Active Loans */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Active Loans
                <Badge variant="secondary" className="text-[10px]">{MOCK_ACTIVE_LOANS.length}</Badge>
              </CardTitle>
              <Badge variant="outline" className="animate-pulse border-primary text-primary text-[10px]">
                <Wifi className="h-2.5 w-2.5 mr-0.5" /> Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ActiveLoansList />
          </CardContent>
        </Card>

        {/* Col 2: Reservations */}
        <Card>
          <CardContent className="pt-4">
            <ReservationQueue />
          </CardContent>
        </Card>

        {/* Col 3: Quick Inventory */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Package className="h-4 w-4 text-accent" /> Inventory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {MOCK_INVENTORY.slice(0, 6).map(item => (
              <div key={item.game} className="flex items-center justify-between p-2 rounded bg-muted/40">
                <span className="text-sm truncate">{item.game}</span>
                <Badge variant={item.available === 0 ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                  {item.available === 0 ? "Out" : `${item.available}/${item.totalCopies}`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LAYOUT C: POS-Style (Point of Sale)
// Left rail: badge scan/lookup → shows user's reservations
// Center: main action area (checkout/return form)
// Right rail: live feed (compact loans ticker)
// Designed for speed in high-volume multi-terminal environments
// ═══════════════════════════════════════════════════════════

function LayoutC() {
  const [activeAction, setActiveAction] = useState<"checkout" | "return">("checkout");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs font-medium">Layout C</Badge>
        <span className="text-sm text-muted-foreground">POS-style: Badge scan left → Action center → Live feed right. Designed for speed.</span>
      </div>

      {/* Compact stat ribbon */}
      <div className="flex items-center gap-4 px-4 py-2 bg-card border border-border/60 rounded-lg text-xs">
        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3 text-primary" /> <strong>47</strong> loans</span>
        <Separator orientation="vertical" className="h-4" />
        <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3 text-secondary" /> <strong>12</strong> reserved</span>
        <Separator orientation="vertical" className="h-4" />
        <span className="flex items-center gap-1"><Package className="h-3 w-3 text-accent" /> <strong>89</strong> avail</span>
        <Separator orientation="vertical" className="h-4" />
        <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> <strong>3</strong> overdue</span>
        <div className="ml-auto flex items-center gap-1 text-primary">
          <Wifi className="h-3 w-3 animate-pulse" /> Live
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-3" style={{ minHeight: 500 }}>
        {/* Left Rail: Badge Lookup */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="border-secondary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-secondary" /> Attendee Lookup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Scan badge or type ID..." className="pl-8 h-9 text-sm" />
              </div>
              {/* Mock: found attendee */}
              <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                    <Users className="h-4 w-4 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Tom B.</p>
                    <p className="text-[10px] text-muted-foreground">Badge B-0423</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Reservations</p>
                  <div className="p-2 rounded bg-background border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Scythe</p>
                      <p className="text-[10px] text-muted-foreground">Expires in 18m</p>
                    </div>
                    <Button size="sm" className="text-[10px] h-6 px-2 gap-0.5">
                      <Zap className="h-2.5 w-2.5" /> Fulfill
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active Loans</p>
                  <p className="text-xs text-muted-foreground italic">None</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center: Action Area */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={activeAction === "checkout" ? "default" : "ghost"}
              className="flex-1 text-sm gap-1.5"
              onClick={() => setActiveAction("checkout")}
            >
              <ArrowRight className="h-4 w-4" /> Check Out
            </Button>
            <Button
              variant={activeAction === "return" ? "default" : "ghost"}
              className="flex-1 text-sm gap-1.5"
              onClick={() => setActiveAction("return")}
            >
              <RotateCcw className="h-4 w-4" /> Return
            </Button>
          </div>

          <Card className="border-primary/20">
            <CardContent className="pt-4">
              {activeAction === "checkout" ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search game name or scan barcode..." className="pl-9 h-11 text-base" />
                  </div>

                  {/* Mock: game selected */}
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3">
                    <div className="w-14 h-14 rounded bg-primary/10 flex items-center justify-center">
                      <Gamepad2 className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Scythe</p>
                      <p className="text-xs text-muted-foreground">1 of 2 available · Copy #2</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="secondary" className="text-[10px]">
                          <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Has reservation
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/5 border border-secondary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-secondary" />
                      <p className="text-sm font-medium">Tom B. <span className="text-muted-foreground text-xs">B-0423</span></p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ✓ Reservation matched · Will be auto-fulfilled on checkout
                    </p>
                  </div>

                  <Button className="w-full h-11 text-sm gap-1.5">
                    <Zap className="h-4 w-4" /> Confirm Checkout & Fulfill Reservation
                  </Button>
                </div>
              ) : (
                <ReturnForm />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Rail: Live Feed */}
        <div className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  Live Feed
                </CardTitle>
                <span className="text-[10px] text-muted-foreground">{MOCK_ACTIVE_LOANS.length} active</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Overdue alert */}
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-destructive">Overdue: Ticket to Ride</p>
                  <p className="text-[10px] text-muted-foreground">Lisa K. · 3h 05m (limit: 2h)</p>
                </div>
              </div>

              <Separator />

              <ActiveLoansList showReturn={false} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// Main Mockup Page
// ═══════════════════════════════════════════════════════════

export default function ConventionMockup() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <div className="max-w-[1400px] mx-auto px-4 py-6 w-full flex-1">
        <div className="flex items-center gap-3 mb-6">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-display text-primary">Convention Hub — Layout Mockups</h1>
            <p className="text-sm text-muted-foreground">Compare 3 layouts for the redesigned lending desk. Concierge lives separately as a public page.</p>
          </div>
        </div>

        <Tabs defaultValue="layout-a" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="layout-a" className="text-xs">A: Split-Pane</TabsTrigger>
            <TabsTrigger value="layout-b" className="text-xs">B: Single Page</TabsTrigger>
            <TabsTrigger value="layout-c" className="text-xs">C: POS-Style</TabsTrigger>
          </TabsList>

          <TabsContent value="layout-a"><LayoutA /></TabsContent>
          <TabsContent value="layout-b"><LayoutB /></TabsContent>
          <TabsContent value="layout-c"><LayoutC /></TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}
