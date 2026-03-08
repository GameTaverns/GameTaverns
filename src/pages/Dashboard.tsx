import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Gamepad2, BookOpen, Sparkles, Users, Mail, Settings,
  Plus, ArrowRight, Library, Dice5, ClipboardList, ChevronDown,
} from "lucide-react";
import { TenantLink } from "@/components/TenantLink";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileBottomTabs } from "@/components/mobile/MobileBottomTabs";
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
  const libraryWord = myLibraries.length === 1 ? t('hub.library') : t('hub.libraries');

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
          <p className="text-sm text-muted-foreground">{t('dashboard.commandCenter')}</p>
        </div>

        {/* Quick Actions — action-oriented shortcuts only */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          <Link to="/dashboard/collection" className="contents">
            <Button size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <Plus className="h-3.5 w-3.5" /> {t('dashboard.addGame')}
            </Button>
          </Link>
          {myLibraries.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
                  <Library className="h-3.5 w-3.5" /> {t('nav.myLibrary')} <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {myLibraries.map((lib) => (
                  <DropdownMenuItem
                    key={lib.id}
                    onSelect={() => navigate(getLibraryUrl(lib.slug, "/"))}
                    className="cursor-pointer"
                  >
                    <Library className="h-3.5 w-3.5 mr-2" />
                    {lib.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : library ? (
            <TenantLink href={getLibraryUrl(library.slug, "/")} className="contents">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
                <Library className="h-3.5 w-3.5" /> {t('nav.myLibrary')}
              </Button>
            </TenantLink>
          ) : null}
          <Link to="/dashboard/insights" className="contents">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <ClipboardList className="h-3.5 w-3.5" /> {t('hub.logPlay')}
            </Button>
          </Link>
          <Link to="/dashboard/collection" className="contents">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 whitespace-nowrap shrink-0">
              <Dice5 className="h-3.5 w-3.5" /> {t('hub.random')}
            </Button>
          </Link>
        </div>

        {/* Hub Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard
            to="/dashboard/collection"
            icon={Gamepad2}
            title={t('hub.myCollection')}
            description={library ? t('hub.gamesAndLibraries', { games: gameCount ?? 0, libraries: myLibraries.length, libraryWord }) : t('hub.noLibraryYet')}
            bullets={[
              t('hub.browseFilterManage'),
              t('hub.importFromBGG'),
              t('hub.shelfOfShameRandom'),
            ]}
            iconColor="hsl(var(--primary))"
            badges={!library ? [{ label: t('dashboard.createLibrary'), variant: "default" }] : undefined}
          />
          <HubCard
            to="/dashboard/lending"
            icon={BookOpen}
            title={t('hub.lendingAndLoans')}
            description={t('hub.pendingAndBorrowed', { pending: pendingLoanRequests, borrowed: activeBorrowedLoans.length })}
            bullets={[
              pendingLoanRequests > 0 ? t('hub.loanRequestsWaiting', { count: pendingLoanRequests }) : t('hub.noPendingRequests'),
              activeBorrowedLoans.length > 0 ? t('hub.gamesCurrentlyBorrowed', { count: activeBorrowedLoans.length }) : t('hub.nothingBorrowedNow'),
              t('hub.crossLibraryTrading'),
            ]}
            iconColor="hsl(24, 80%, 50%)"
            badges={pendingLoanRequests > 0 ? [{ label: `${pendingLoanRequests} ${t('dashboard.pending')}`, variant: "destructive" }] : undefined}
          />
          <HubCard
            to="/dashboard/insights"
            icon={Sparkles}
            title={t('hub.insightsAndAnalytics')}
            description={t('hub.insightsDesc')}
            bullets={[
              t('hub.collectorPersonality'),
              t('hub.playStatsTracking'),
              t('hub.shareableCards'),
            ]}
            iconColor="hsl(262, 80%, 55%)"
          />
          <HubCard
            to="/dashboard/community"
            icon={Users}
            title={t('hub.communityAndEvents')}
            description={t('hub.clubsForumsEvents', { clubs: myClubs.length })}
            bullets={[
              myClubs.length > 0 ? t('hub.clubsJoined', { count: myClubs.length, plural: myClubs.length > 1 ? 's' : '' }) : t('hub.joinOrCreateClub'),
              t('hub.forumsPollsChallenges'),
              t('hub.eventsRSVP'),
            ]}
            iconColor="hsl(200, 70%, 50%)"
          />
          <HubCard
            to="/dashboard/messages"
            icon={Mail}
            title={t('hub.messagesAndSocial')}
            description={unreadDMs > 0 ? t('hub.unreadMessages', { count: unreadDMs }) : t('hub.allCaughtUp')}
            bullets={[
              unreadDMs > 0 ? t('hub.unreadDirectMessages', { count: unreadDMs }) : t('hub.noUnreadMessages'),
              t('hub.gameInquiries'),
              t('hub.activityFeed'),
            ]}
            iconColor="hsl(340, 65%, 50%)"
            badges={unreadDMs > 0 ? [{ label: t('hub.unread', { count: unreadDMs }), variant: "destructive" }] : undefined}
          />
          <HubCard
            to="/dashboard/settings"
            icon={Settings}
            title={t('hub.settingsAndAccount')}
            description={t('hub.settingsDesc')}
            bullets={[
              t('hub.profileDisplayBio'),
              t('hub.password2FA'),
              t('hub.referralsGrowth'),
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
