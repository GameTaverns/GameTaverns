import { Link, useNavigate } from "react-router-dom";
import {
  Library, Users, Dice6, ArrowLeftRight, Calendar, MessageSquare,
  Trophy, Star, Upload, Zap, Shield, BarChart3, Building2,
  ChevronRight, CheckCircle2, Flame, Vote, Shuffle, BookOpen, RefreshCw,
} from "lucide-react";
import { SEO, websiteJsonLd } from "@/components/seo/SEO";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { usePlatformStats, formatStatNumber } from "@/hooks/usePlatformStats";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { Footer } from "@/components/layout/Footer";
import logoImage from "@/assets/logo.png";

export default function Platform() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: myLibrary } = useMyLibrary();
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      if (myLibrary) {
        window.location.href = getLibraryUrl(myLibrary.slug, "/");
      } else {
        navigate("/create-library");
      }
    } else {
      navigate("/signup");
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SEO
        title="GameTaverns — Board Game Library Management"
        description="Create your free board game library. Track collections, log plays, manage lending, run game night polls, and build your gaming community."
        noSuffix
        jsonLd={websiteJsonLd()}
      />

      {/* ── Header ── */}
      <header className="border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0 flex-shrink-1">
            <img src={logoImage} alt="GameTaverns" className="h-8 w-auto flex-shrink-0" />
            <span className="font-display text-lg sm:text-2xl font-bold text-foreground truncate">
              GameTaverns
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <Link to="/features" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Features
              </Button>
            </Link>
            <Link to="/directory" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Explore Libraries
              </Button>
            </Link>
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Dashboard</Button>
                </Link>
                {myLibrary && (
                  <a href={getLibraryUrl(myLibrary.slug, "/")}>
                    <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">My Library</Button>
                  </a>
                )}
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Sign In</Button>
                </Link>
                <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={handleGetStarted}>
                  Get Started Free
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative container mx-auto px-4 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary border border-secondary/20 rounded-full px-4 py-1.5 text-sm font-medium mb-8">
          <Flame className="h-3.5 w-3.5" />
          Free to start — no credit card required
        </div>
        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
          Your Board Game Collection<br />
          <span className="text-secondary">Finally Has a Home</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
          GameTaverns is the all-in-one platform for collectors, community libraries, and game groups.
          Track your games, log plays, lend to friends, and build a community — all in one place.
        </p>
        <p className="text-base text-muted-foreground/70 max-w-xl mx-auto mb-10">
          Import from BoardGameGeek in seconds. Your library, your rules.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Button
            size="lg"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-10 py-6"
            onClick={handleGetStarted}
          >
            {authLoading ? "Loading..." : isAuthenticated ? (myLibrary ? "Go to My Library" : "Create Your Library") : "Create Your Free Library"}
          </Button>
          <Link to="/features">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6">
              See All Features
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        {/* Stats bar */}
        <div className="inline-flex flex-wrap justify-center gap-8 sm:gap-16 bg-muted/50 border border-border/30 rounded-2xl px-10 py-6">
          <Stat label="Libraries Created" value={statsLoading ? "..." : formatStatNumber(stats?.librariesCount || 0)} />
          <Stat label="Games Cataloged" value={statsLoading ? "..." : formatStatNumber(stats?.gamesCount || 0)} />
          <Stat label="Plays Logged" value={statsLoading ? "..." : formatStatNumber(stats?.playsCount || 0)} />
        </div>
      </section>

      {/* ── Who is it for ── */}
      <section className="bg-muted/30 border-y border-border/20">
        <div className="container mx-auto px-4 py-20">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
            Built for Every Kind of Board Gamer
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
            Whether you're a solo collector, a game group, or running a community library — GameTaverns scales to fit.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <AudienceCard
              icon={<BookOpen className="h-7 w-7" />}
              title="Collectors"
              subtitle="Your collection, beautifully organised"
              bullets={[
                "Import from BGG in one click",
                "Track location, condition & value",
                "Log every play session",
                "Earn achievements as you play",
              ]}
              cta="Start tracking"
              href="/signup"
            />
            <AudienceCard
              icon={<Users className="h-7 w-7" />}
              title="Game Groups"
              subtitle="Organise your friend group's library"
              bullets={[
                "Lend games with request tracking",
                "Game night polls with shareable links",
                "Random game picker for decision fatigue",
                "Trade games with other groups",
              ]}
              cta="Create a group library"
              href="/signup"
              highlight
            />
            <AudienceCard
              icon={<Building2 className="h-7 w-7" />}
              title="Community Libraries"
              subtitle="Run a public lending library"
              bullets={[
                "Full borrower management & ratings",
                "QR codes for physical shelves",
                "Events, forums & announcements",
                "Multi-library Clubs for networks",
              ]}
              cta="Set up your library"
              href="/signup"
            />
          </div>
        </div>
      </section>

      {/* ── Feature highlights ── */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
          Everything in One Platform
        </h2>
        <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
          No patchwork of apps. No spreadsheets. GameTaverns replaces the lot.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureHighlight icon={<Library className="h-5 w-5" />} title="Collection Management" description="Every game, every detail. BGG auto-fill, location tracking, condition grades, expansions." />
          <FeatureHighlight icon={<RefreshCw className="h-5 w-5" />} title="BGG Auto-Sync" description="Keep your library in sync with your BoardGameGeek account on a daily or weekly schedule." />
          <FeatureHighlight icon={<Dice6 className="h-5 w-5" />} title="Play Logging & Stats" description="Record sessions, players, scores and winners. Charts, H-index, win rates and monthly summaries." />
          <FeatureHighlight icon={<Library className="h-5 w-5" />} title="Lending Library" description="Borrow requests, due dates, condition check-in/out, waitlists, and borrower reputation ratings." />
          <FeatureHighlight icon={<Vote className="h-5 w-5" />} title="Game Night Polls" description="Share a link — anyone votes, no account needed. See live results as they come in." />
          <FeatureHighlight icon={<Shuffle className="h-5 w-5" />} title="Random Game Picker" description="Filtered by player count and play time. Spin the wheel, end the debate." />
          <FeatureHighlight icon={<ArrowLeftRight className="h-5 w-5" />} title="Trade Matching" description="Automatically match games you'd trade with games libraries near you are looking for." />
          <FeatureHighlight icon={<MessageSquare className="h-5 w-5" />} title="Community Forums" description="Threaded discussions scoped to your library, your clubs, or the whole platform." />
          <FeatureHighlight icon={<Calendar className="h-5 w-5" />} title="Events & Game Nights" description="Plan events with RSVPs and Discord integration. All in one place." />
          <FeatureHighlight icon={<Trophy className="h-5 w-5" />} title="Achievements" description="Milestone badges for play counts, variety, streaks, and community contributions." />
          <FeatureHighlight icon={<BarChart3 className="h-5 w-5" />} title="Deep Analytics" description="Track collection value, play trends, ELO ratings, and group challenge leaderboards." />
          <FeatureHighlight icon={<Star className="h-5 w-5" />} title="Ratings & Wishlist" description="Visitors can rate games and wishlist titles — no account required." />
          <FeatureHighlight icon={<Zap className="h-5 w-5" />} title="AI Recommendations" description="Games like this — powered by AI, only suggesting titles actually in your library." />
          <FeatureHighlight icon={<Building2 className="h-5 w-5" />} title="Clubs" description="Connect libraries into a shared network with combined catalogs, shared events, and cross-library forums." />
          <FeatureHighlight icon={<Shield className="h-5 w-5" />} title="Privacy First" description="Toggle every feature on or off. Public or private. You're always in control." />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-muted/30 border-y border-border/20">
        <div className="container mx-auto px-4 py-20">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
            Up and Running in Minutes
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-md mx-auto">
            From signup to a fully cataloged library — faster than you'd expect.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Step n={1} title="Create your library" description="Sign up, pick a name and slug — your public library URL is ready instantly." />
            <Step n={2} title="Import your collection" description="Enter your BGG username and import your entire collection with box art, descriptions and details in one go." />
            <Step n={3} title="Share & invite" description="Send your library link to friends, set up lending rules, and start building your community." />
          </div>
        </div>
      </section>

      {/* ── Explore libraries CTA ── */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Discover Public Libraries Near You
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Browse the Library Directory to find active game libraries, borrow games from your community, and connect with other enthusiasts.
            </p>
            <div className="space-y-3 mb-8">
              {["Search by name or location", "Browse combined club catalogs", "Request to borrow games directly", "Follow libraries to see their activity"].map(b => (
                <div key={b} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
                  {b}
                </div>
              ))}
            </div>
            <Link to="/directory">
              <Button variant="outline" className="gap-2">
                Browse the Directory <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: <Library className="h-6 w-6 text-secondary" />, label: "Public libraries", sub: "Open to anyone" },
              { icon: <Users className="h-6 w-6 text-secondary" />, label: "Active lenders", sub: "Real communities" },
              { icon: <Building2 className="h-6 w-6 text-secondary" />, label: "Clubs & networks", sub: "Multi-library groups" },
              { icon: <ArrowLeftRight className="h-6 w-6 text-secondary" />, label: "Trade opportunities", sub: "Matched automatically" },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="bg-muted/50 border border-border/30 rounded-xl p-5 flex flex-col gap-3">
                {icon}
                <div>
                  <div className="font-semibold text-foreground text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-muted/30 border-t border-border/20">
        <div className="container mx-auto px-4 py-24 text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-foreground mb-4">
            Ready to Build Your Library?
          </h2>
          <p className="text-muted-foreground mb-10 max-w-lg mx-auto text-lg">
            Free to start. No credit card. Import from BGG in under 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-10 py-6"
              onClick={handleGetStarted}
            >
              {isAuthenticated ? "Go to My Library" : "Create Your Free Library"}
            </Button>
            <Link to="/features">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Explore All Features
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ── Sub-components ──

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl sm:text-3xl font-bold text-secondary font-display">{value}</div>
      <div className="text-muted-foreground text-sm mt-1">{label}</div>
    </div>
  );
}

function AudienceCard({
  icon, title, subtitle, bullets, cta, href, highlight = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-7 border flex flex-col gap-5 ${highlight ? "bg-secondary/10 border-secondary/30 ring-1 ring-secondary/20" : "bg-muted/50 border-border/30"}`}>
      <div className={`${highlight ? "text-secondary" : "text-muted-foreground"}`}>{icon}</div>
      <div>
        <h3 className="font-display text-xl font-bold text-foreground mb-1">{title}</h3>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      <ul className="space-y-2 flex-1">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${highlight ? "text-secondary" : "text-muted-foreground/50"}`} />
            {b}
          </li>
        ))}
      </ul>
      <Link to={href}>
        <Button
          className={`w-full ${highlight ? "bg-secondary text-secondary-foreground hover:bg-secondary/90" : ""}`}
          variant={highlight ? "default" : "outline"}
        >
          {cta} <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </Link>
    </div>
  );
}

function FeatureHighlight({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-5 rounded-xl border border-border/20 bg-muted/30 hover:border-secondary/30 hover:bg-muted/50 transition-colors">
      <div className="text-secondary shrink-0 mt-0.5">{icon}</div>
      <div>
        <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function Step({ n, title, description }: { n: number; title: string; description: string }) {
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-secondary text-secondary-foreground font-bold text-lg flex items-center justify-center font-display">
        {n}
      </div>
      <h3 className="font-display font-bold text-foreground text-lg">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}
