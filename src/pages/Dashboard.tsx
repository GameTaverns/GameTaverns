import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Gamepad2, BookOpen, Sparkles, Users, Mail, Settings,
  Plus, Search, ArrowRight, Shield, Library, Globe,
  Calendar, User, HelpCircle, Dice5, ClipboardList, ChevronDown,
} from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries, useUserProfile } from "@/hooks/useLibrary";
import { useLending } from "@/hooks/useLending";
import { useMyClubs } from "@/hooks/useClubs";
import { supabase } from "@/integrations/backend/client";
import { useQuery } from "@tanstack/react-query";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { TwoFactorBanner } from "@/components/dashboard/TwoFactorBanner";
import { GuidedTour } from "@/components/dashboard/GuidedTour";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomTabs } from "@/components/mobile/MobileBottomTabs";

function HubCard({ to, icon: Icon, title, description, bullets, iconColor, badges }: {
  to: string; icon: any; title: string; description: string; bullets: string[];
  iconColor: string;
  badges?: { label: string; variant: "default" | "secondary" | "destructive" | "outline" }[];
}) {
  return (
    <Link to={to} className="block">
      <div className="rounded-2xl border bg-card hover:shadow-lg hover:border-primary/30 transition-all p-5 cursor-pointer group h-full">
        <div className="flex items-start justify-between mb-3">
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
            <Icon className="h-5 w-5" style={{ color: iconColor }} />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </div>
        <h3 className="font-semibold text-foreground text-base">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        <div className="mt-3 space-y-0.5">
          {bullets.map(s => (
            <p key={s} className="text-xs text-muted-foreground">• {s}</p>
          ))}
        </div>
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {badges.map(b => <Badge key={b.label} variant={b.variant} className="text-xs">{b.label}</Badge>)}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isAdmin, isStaff, loading } = useAuth();
  const { data: defaultLibrary } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const { data: profile } = useUserProfile();
  const { myLentLoans, myBorrowedLoans } = useLending();
  const { data: myClubs = [] } = useMyClubs();
  const navigate = useNavigate();

  const pendingLoanRequests = myLentLoans.filter(l => l.status === "requested").length;
  const activeBorrowedLoans = myBorrowedLoans.filter(l => ['requested', 'approved', 'active'].includes(l.status));
  const library = defaultLibrary;

  // Game count
  const { data: gameCount } = useQuery({
    queryKey: ["hub-game-count", library?.id],
    queryFn: async () => {
      if (!library?.id) return 0;
      const { count } = await supabase.from("games").select("id", { count: "exact", head: true }).eq("library_id", library.id);
      return count ?? 0;
    },
    enabled: !!library?.id,
    staleTime: 60000,
  });

  // Unread DMs
  const { data: unreadDMs = 0 } = useQuery({
    queryKey: ["hub-unread-dms", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user!.id)
        .is("read_at", null)
        .eq("deleted_by_recipient", false);
      return count ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const displayName = profile?.display_name || (user as any)?.user_metadata?.display_name || user?.email?.split("@")[0] || "Player";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background flex flex-col">
      <AnnouncementBanner />
      <div className="container mx-auto px-4 pt-3">
        <TwoFactorBanner />
      </div>
      <AppHeader />

      <main className="container mx-auto px-4 py-6 max-w-5xl flex-1">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
            {t('dashboard.welcomeBack', { name: displayName })}
          </h1>
          <p className="text-sm text-muted-foreground">Your board game command center</p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          <Link to="/dashboard/collection" className="contents">
            <Button size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <Plus className="h-3.5 w-3.5" /> Add Game
            </Button>
          </Link>
          {myLibraries.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
                  <Library className="h-3.5 w-3.5" /> Library <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {myLibraries.map((lib) => (
                  <DropdownMenuItem key={lib.id} asChild>
                    <Link to={`/lib/${lib.slug}`} className="cursor-pointer">
                      <Library className="h-3.5 w-3.5 mr-2" />
                      {lib.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : library ? (
            <Link to={`/lib/${library.slug}`} className="contents">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
                <Library className="h-3.5 w-3.5" /> Library
              </Button>
            </Link>
          ) : null}
          <Link to="/catalog" className="contents">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <Search className="h-3.5 w-3.5" /> Catalog
            </Button>
          </Link>
          <Link to="/directory" className="contents">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <Globe className="h-3.5 w-3.5" /> Directory
            </Button>
          </Link>
          <Link to="/events" className="contents">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <Calendar className="h-3.5 w-3.5" /> Events
            </Button>
          </Link>
          <Link to="/dashboard/lending" className="contents">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <BookOpen className="h-3.5 w-3.5" /> Lending
            </Button>
          </Link>
          <Link to="/dashboard/insights" className="contents">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <ClipboardList className="h-3.5 w-3.5" /> Log Play
            </Button>
          </Link>
          <Link to="/dashboard/collection" className="contents">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <Dice5 className="h-3.5 w-3.5" /> Random
            </Button>
          </Link>
          {profile?.username && (
            <Link to={`/u/${profile.username}`} className="contents">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
                <User className="h-3.5 w-3.5" /> Profile
              </Button>
            </Link>
          )}
          <Link to="/docs" className="contents">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <HelpCircle className="h-3.5 w-3.5" /> Help
            </Button>
          </Link>
        </div>

        {/* Hub Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard
            to="/dashboard/collection"
            icon={Gamepad2}
            title="My Collection"
            description={library ? `${gameCount ?? 0} games · ${myLibraries.length} ${myLibraries.length === 1 ? 'library' : 'libraries'}` : "No library yet"}
            bullets={[
              "Browse, filter & manage your library",
              "Import from BGG · Add manually",
              "Shelf of shame · Random picker",
            ]}
            iconColor="hsl(var(--primary))"
            badges={!library ? [{ label: "Create Library", variant: "default" }] : undefined}
          />
          <HubCard
            to="/dashboard/lending"
            icon={BookOpen}
            title="Lending & Loans"
            description={`${pendingLoanRequests} pending · ${activeBorrowedLoans.length} borrowed`}
            bullets={[
              pendingLoanRequests > 0 ? `${pendingLoanRequests} loan requests waiting` : "No pending requests",
              activeBorrowedLoans.length > 0 ? `${activeBorrowedLoans.length} games currently borrowed` : "Nothing borrowed right now",
              "Cross-library trading hub",
            ]}
            iconColor="hsl(24, 80%, 50%)"
            badges={pendingLoanRequests > 0 ? [{ label: `${pendingLoanRequests} pending`, variant: "destructive" }] : undefined}
          />
          <HubCard
            to="/dashboard/insights"
            icon={Sparkles}
            title="Insights & Analytics"
            description="Collection DNA, stats & achievements"
            bullets={[
              "Your collector personality & rarity scores",
              "Play stats, value tracking & trends",
              "Shareable cards & achievements",
            ]}
            iconColor="hsl(262, 80%, 55%)"
          />
          <HubCard
            to="/dashboard/community"
            icon={Users}
            title="Community & Events"
            description={`${myClubs.length} clubs · Forums · Events`}
            bullets={[
              myClubs.length > 0 ? `${myClubs.length} club${myClubs.length > 1 ? 's' : ''} joined` : "Join or create a club",
              "Forums, polls & group challenges",
              "Events & RSVP management",
            ]}
            iconColor="hsl(200, 70%, 50%)"
          />
          <HubCard
            to="/dashboard/messages"
            icon={Mail}
            title="Messages & Social"
            description={unreadDMs > 0 ? `${unreadDMs} unread messages` : "All caught up"}
            bullets={[
              unreadDMs > 0 ? `${unreadDMs} unread direct messages` : "No unread messages",
              "Game inquiries from visitors",
              "Activity feed & social updates",
            ]}
            iconColor="hsl(340, 65%, 50%)"
            badges={unreadDMs > 0 ? [{ label: `${unreadDMs} unread`, variant: "destructive" }] : undefined}
          />
          <HubCard
            to="/dashboard/settings"
            icon={Settings}
            title="Settings & Account"
            description="Profile, security & preferences"
            bullets={[
              "Profile, display name & bio",
              "Password, 2FA & appearance",
              "Referrals · Growth tools · Danger zone",
            ]}
            iconColor="hsl(var(--muted-foreground))"
          />
        </div>
      </main>

      <Footer />
      <MobileBottomTabs />
      <GuidedTour librarySlug={library?.slug} />
    </div>
  );
}
