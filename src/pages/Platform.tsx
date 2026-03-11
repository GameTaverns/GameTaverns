import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Library, Users, Dice6, ArrowLeftRight, Calendar, MessageSquare,
  Trophy, Star, Upload, Zap, Shield, BarChart3, Building2,
  ChevronRight, CheckCircle2, Flame, Vote, Shuffle, BookOpen, RefreshCw,
  MapPin,
} from "lucide-react";
import { SEO, websiteJsonLd } from "@/components/seo/SEO";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { usePlatformStats, formatStatNumber } from "@/hooks/usePlatformStats";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { Footer } from "@/components/layout/Footer";
import { FeaturedLibrary } from "@/components/landing/FeaturedLibrary";
import logoImage from "@/assets/logo.png";

// Showcase screenshots
import showcaseCollection from "@/assets/showcase/library-collection.jpg";
import showcaseThemed from "@/assets/showcase/library-themed.jpg";
import showcasePlayStats from "@/assets/showcase/play-stats.jpg";
import showcaseGameDetail from "@/assets/showcase/game-detail.jpg";
import showcasePoll from "@/assets/showcase/game-night-poll.jpg";
import showcasePollResults from "@/assets/showcase/poll-results.jpg";
import showcaseActivityFeed from "@/assets/showcase/activity-feed.jpg";
import showcaseProfile from "@/assets/showcase/profile.jpg";

export default function Platform() {
  const { t } = useTranslation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: myLibrary } = useMyLibrary();
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      if (myLibrary) {
        // Use navigate() so HashRouter (native Capacitor) handles this correctly.
        // getLibraryUrl() returns "/?tenant=slug" on non-production — navigate() makes that work in-app.
        const url = getLibraryUrl(myLibrary.slug, "/");
        if (url.startsWith("/") || url.startsWith("?")) {
          navigate(url, { replace: true });
        } else {
          window.location.href = url;
        }
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
        title="GameTaverns — Free Board Game Collection Manager & Community Platform"
        description="Organize your board game collection, log plays, track stats, lend games, run game night polls, and connect with collectors worldwide. Import from BoardGameGeek in seconds. Free forever."
        noSuffix
        canonical="https://gametaverns.com"
        jsonLd={websiteJsonLd()}
      />

      {/* ── Header ── */}
      <header className="border-b border-border/40 bg-background sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0 flex-shrink-1">
            <img src={logoImage} alt="GameTaverns" className="h-8 w-auto flex-shrink-0" />
            <span className="font-display text-lg sm:text-2xl font-bold text-foreground truncate">
              GameTaverns
            </span>
            <span className="hidden md:inline text-xs text-muted-foreground/60 ml-1 font-normal">{t('platform.tagline')}</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <Link to="/features" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                {t('platform.features')}
              </Button>
            </Link>
            <Link to="/directory" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                {t('platform.exploreLibraries')}
              </Button>
            </Link>
            <Link to="/near-me" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {t('platform.nearMe')}
              </Button>
            </Link>
            <Link to="/catalog" className="hidden md:block">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                {t('platform.gameCatalog')}
              </Button>
            </Link>
            <LanguageSwitcher />
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">{t('nav.dashboard')}</Button>
                </Link>
                {myLibrary && (
                  <TenantLink href={getLibraryUrl(myLibrary.slug, "/")}>
                    <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">{t('nav.myLibrary')}</Button>
                  </TenantLink>
                )}
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">{t('nav.signIn')}</Button>
                </Link>
                 <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={handleGetStarted}>
                   {t('platform.getStarted')}
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero: Live Library Preview ── */}
      <section className="relative">
        <div className="container mx-auto px-4 pt-12 pb-6 text-center">
          <div className="inline-flex items-center gap-2 text-secondary text-sm font-body italic mb-4">
            <Flame className="h-3.5 w-3.5" />
            {t('platform.seeRealLibrary')}
          </div>
           <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold text-foreground mb-3 leading-tight">
             {t('platform.heroTitle')}<br />
             <span className="text-secondary">{t('platform.heroHighlight')}</span>
           </h1>
           <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
             {t('platform.heroSubtitle')}
          </p>
        </div>
        <div className="container mx-auto px-4 pb-8">
          <div className="max-w-6xl mx-auto">
            <FeaturedLibrary />
          </div>
        </div>
        <div className="container mx-auto px-4 pb-12 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              size="lg"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-10 py-6"
              onClick={handleGetStarted}
            >
              {authLoading ? t('common.loading') : isAuthenticated ? (myLibrary ? t('platform.goToMyLibrary') : t('platform.createYourLibrary')) : t('platform.createYourLibrary')}
            </Button>
            <Link to="/features">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                {t('platform.seeAllFeatures')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          {/* Stats bar */}
          <div className="inline-flex flex-wrap justify-center gap-8 sm:gap-16 card-handcrafted px-10 py-6">
             <Stat label={t('platform.librariesCreated')} value={statsLoading ? "..." : formatStatNumber(stats?.librariesCount || 0)} />
             <Stat label={t('platform.gamesCataloged')} value={statsLoading ? "..." : formatStatNumber(stats?.gamesCount || 0)} />
             <Stat label={t('platform.playsLogged')} value={statsLoading ? "..." : formatStatNumber(stats?.playsCount || 0)} />
          </div>
        </div>
      </section>

      {/* ── Who is it for ── */}
      <hr className="section-divider" />
      <section className="paper-inset">
        <div className="container mx-auto px-4 py-20">
           <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
             {t('platform.builtForEveryGamer')}
           </h2>
           <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
             {t('platform.builtForEveryGamerDesc')}
           </p>
          <div className="grid md:grid-cols-3 gap-6">
            <AudienceCard
              icon={<BookOpen className="h-7 w-7" />}
              title="Collectors"
              subtitle="You know exactly how many games you own. (No judgement.)"
              bullets={[
                "Import your BGG collection in one click",
                "Know where every game is and what shape it's in",
                "Log plays — finally prove you don't only buy games",
                "Unlock achievements for actually playing your shelf",
              ]}
              cta="Start tracking"
              href="/signup"
            />
            <AudienceCard
              icon={<Users className="h-7 w-7" />}
              title="Game Groups"
              subtitle="Stop texting 'what should we play tonight'"
              bullets={[
                "Lend games without losing them into the void",
                "Polls that settle the 'what do we play' debate",
                "Random picker when nobody can decide",
                "See what other groups near you have on their shelves",
              ]}
              cta="Create a group library"
              href="/signup"
              highlight
            />
            <AudienceCard
              icon={<Building2 className="h-7 w-7" />}
              title="Community Libraries"
              subtitle="For cafés, churches, schools — anyone lending games"
              bullets={[
                "Track who borrowed what (and when it's overdue)",
                "QR codes for physical shelves",
                "Events, forums & announcements built in",
                "Link multiple libraries into a Club network",
              ]}
              cta="Set up your library"
              href="/signup"
            />
          </div>
        </div>
      </section>

      {/* ── Feature Showcase with Screenshots ── */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
          Okay, But What Does It Actually Do?
        </h2>
        <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
          Honestly — a lot. Here's the short version.
        </p>

        {/* Showcase rows — alternating image/text */}
        <div className="space-y-20 max-w-5xl mx-auto mb-20">
          <ShowcaseRow
            image={showcaseCollection}
            alt="GameTaverns library view showing a board game collection with box art, filters, and sorting"
            title="Your Whole Shelf, Digitised"
            description="Every game with its box art, player count, and play time — filterable, sortable, and actually nice to look at. Import from BGG and it fills in everything automatically."
            reverse={false}
          />
          <ShowcaseRow
            image={showcaseThemed}
            alt="A custom-themed board game library with unique branding and colors"
            title="Make It Look Like Yours"
            description="Pick your own colours, upload a logo, choose a slug. Your library gets its own public URL that looks nothing like a generic template."
            reverse
          />
          <ShowcaseRow
            image={showcasePlayStats}
            alt="Play statistics dashboard showing H-index, top mechanics, and most played games"
            title="Stats You'll Actually Care About"
            description="H-index, win rates, monthly play summaries, most-played mechanics — the kind of nerdy breakdowns that make you go 'huh, I really do play a lot of engine builders.'"
            reverse={false}
          />
          <ShowcaseRow
            image={showcaseGameDetail}
            alt="Detailed game page showing Flip 7 with description, mechanics, and play history"
            title="Every Game Gets a Page"
            description="Mechanic tags, play history, documents, community ratings, and a direct link to BGG. It's like a wiki page for every game on your shelf."
            reverse
          />
          <ShowcaseRow
            image={showcasePoll}
            alt="Game night poll letting users vote on what to play next"
            title="'What Should We Play?' — Solved"
            description="Make a poll from your collection, send the link. Your friends vote — no account needed. Results update live. Arguments settled."
            reverse={false}
          />
          <ShowcaseRow
            image={showcaseActivityFeed}
            alt="Social activity feed showing photo posts, game additions, and community interactions"
            title="See What Everyone's Playing"
            description="Photo posts, @mentions, new additions, play sessions — a feed that's actually about board games instead of, well, everything else."
            reverse
          />
          <ShowcaseRow
            image={showcaseProfile}
            alt="User profile page showing activity, photos, stats, achievements, and community badges"
            title="Your Collector Profile"
            description="Photos, play stats, achievements, follows — your board gaming life in one place. See what others are into and how their shelves have grown."
            reverse={false}
          />
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureHighlight icon={<Library className="h-5 w-5" />} title="Collection Management" description="BGG auto-fill, location tracking, condition grades, expansion linking. The whole deal." />
          <FeatureHighlight icon={<RefreshCw className="h-5 w-5" />} title="BGG Auto-Sync" description="Set it and forget it. Your BGG collection stays in sync daily or weekly." />
          <FeatureHighlight icon={<Dice6 className="h-5 w-5" />} title="Play Logging" description="Players, scores, winners, duration. Then charts that make you look like you have your life together." />
          <FeatureHighlight icon={<Library className="h-5 w-5" />} title="Lending Library" description="Borrow requests, due dates, condition tracking. Know who has your copy of Pandemic." />
          <FeatureHighlight icon={<Vote className="h-5 w-5" />} title="Game Night Polls" description="Send a link, friends vote, nobody needs an account. Done." />
          <FeatureHighlight icon={<Shuffle className="h-5 w-5" />} title="Random Picker" description="Filter by player count and time, spin the wheel. Blame the algorithm." />
          <FeatureHighlight icon={<ArrowLeftRight className="h-5 w-5" />} title="Trade Matching" description="Finds games you'd swap with what other libraries are offering. Less hunting." />
          <FeatureHighlight icon={<MessageSquare className="h-5 w-5" />} title="Forums" description="Threaded discussions — scoped to your library, your club, or everyone." />
          <FeatureHighlight icon={<Calendar className="h-5 w-5" />} title="Events" description="Plan game nights with RSVPs. Integrates with Discord if that's your thing." />
          <FeatureHighlight icon={<Trophy className="h-5 w-5" />} title="Achievements" description="Badges for milestones, streaks, and variety. Yes, it's gamified. We're not sorry." />
          <FeatureHighlight icon={<BarChart3 className="h-5 w-5" />} title="Analytics" description="Collection value, play trends, ELO ratings, leaderboards. Numbers. Lots of them." />
          <FeatureHighlight icon={<Star className="h-5 w-5" />} title="Ratings & Wishlist" description="Anyone can rate or wishlist games — no sign-up needed." />
          <FeatureHighlight icon={<Zap className="h-5 w-5" />} title="Smart Suggestions" description="'Games like this' — only recommending titles that are actually on your shelf." />
          <FeatureHighlight icon={<Building2 className="h-5 w-5" />} title="Clubs" description="Link libraries together into a network. Shared catalog, shared events, shared forums." />
          <FeatureHighlight icon={<Users className="h-5 w-5" />} title="Social Feed" description="Photo posts, @mentions, play sessions. A feed that's all board games, all the time." />
          <FeatureHighlight icon={<Shield className="h-5 w-5" />} title="Your Rules" description="Every feature toggles on or off. Public or private. You decide." />
        </div>
      </section>

      {/* Featured Library moved to hero — section removed */}

      {/* ── How it works ── */}
      <hr className="section-divider" />
      <section className="paper-inset">
        <div className="container mx-auto px-4 py-20">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
            Three Steps. That's It.
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-md mx-auto">
            Most people have their whole collection imported before their coffee gets cold.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Step n={1} title="Pick a name" description="Sign up, choose a slug — you've got a public URL before you finish your first sip." />
            <Step n={2} title="Import from BGG" description="Type your BGG username, hit import. Box art, descriptions, player counts — all of it, done." />
            <Step n={3} title="Send the link" description="Share your library with friends. Set up lending. Start a poll. You're live." />
          </div>
        </div>
      </section>

      {/* ── Explore libraries CTA ── */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
              There Are Other Shelves Out There
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Browse public libraries, find someone lending that game you've been eyeing, or just see what other collectors are into.
            </p>
            <div className="space-y-3 mb-8">
              {["Search by name or location", "Map view to find libraries nearby", "Browse combined club catalogs", "Request to borrow games directly", "Follow libraries you like"].map(b => (
                <div key={b} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
                  {b}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Link to="/directory">
                <Button variant="outline" className="gap-2">
                  Browse the Directory <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/near-me">
                <Button variant="outline" className="gap-2">
                  <MapPin className="h-4 w-4" />
                  Find Near Me
                </Button>
              </Link>
            </div>
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

      {/* ── Growth tools ── */}
      <hr className="section-divider" />
      <section className="paper-inset">
        <div className="container mx-auto px-4 py-20">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
            Show It Off a Little
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
            You put the collection together — might as well let people see it.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Link to="/share-card" className="group">
              <div className="rounded-2xl border border-border/30 bg-muted/50 p-7 text-center hover:border-secondary/30 transition-colors h-full flex flex-col items-center gap-4">
                <Upload className="h-8 w-8 text-secondary" />
                <div>
                <h3 className="font-display font-bold text-foreground mb-1">Stats Cards</h3>
                  <p className="text-sm text-muted-foreground">Turn your collection stats into a shareable image. Great for flexing on social media.</p>
                </div>
              </div>
            </Link>
            <Link to="/grow" className="group">
              <div className="rounded-2xl border border-secondary/30 bg-secondary/10 ring-1 ring-secondary/20 p-7 text-center hover:bg-secondary/15 transition-colors h-full flex flex-col items-center gap-4">
                <Star className="h-8 w-8 text-secondary" />
                <div>
                <h3 className="font-display font-bold text-foreground mb-1">Referral Program</h3>
                  <p className="text-sm text-muted-foreground">Invite friends. When they sign up, you both get a badge. Simple as that.</p>
                </div>
              </div>
            </Link>
            <Link to="/embed" className="group">
              <div className="rounded-2xl border border-border/30 bg-muted/50 p-7 text-center hover:border-secondary/30 transition-colors h-full flex flex-col items-center gap-4">
                <Zap className="h-8 w-8 text-secondary" />
                <div>
                <h3 className="font-display font-bold text-foreground mb-1">Embed Widget</h3>
                  <p className="text-sm text-muted-foreground">Drop your library into your blog, Discord server, or forum with a snippet of code.</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <hr className="section-divider" />
      <section className="paper-inset">
        <div className="container mx-auto px-4 py-24 text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-foreground mb-4">
            Your Shelf Deserves Better Than a Spreadsheet
          </h2>
          <p className="text-muted-foreground mb-10 max-w-lg mx-auto text-lg">
            Free. No credit card. Import your BGG collection and see for yourself.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-10 py-6"
              onClick={handleGetStarted}
            >
              {isAuthenticated ? t('platform.goToMyLibrary') : t('platform.createYourLibrary')}
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
    <div className={`card-handcrafted p-7 flex flex-col gap-5 ${highlight ? "bg-secondary/5 border-secondary/25" : ""}`}>
      <div className={`${highlight ? "text-secondary" : "text-muted-foreground"}`}>{icon}</div>
      <div>
        <h3 className="font-display text-xl font-bold text-foreground mb-1">{title}</h3>
        <p className="text-muted-foreground text-sm italic">{subtitle}</p>
      </div>
      <ul className="space-y-2.5 flex-1">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground ink-dot">
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
    <div className="flex gap-4 p-5 card-handcrafted hover:border-secondary/30 transition-colors">
      <div className="text-accent shrink-0 mt-0.5">{icon}</div>
      <div>
        <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function ShowcaseRow({ image, alt, title, description, reverse }: { image: string; alt: string; title: string; description: string; reverse: boolean }) {
  return (
    <div className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} gap-8 items-center`}>
      <div className="md:w-1/2">
        <img
          src={image}
          alt={alt}
          className={`rounded-2xl border border-border/30 shadow-lg w-full ${reverse ? "md:rotate-[0.5deg]" : "md:-rotate-[0.5deg]"}`}
          loading="lazy"
        />
      </div>
      <div className="md:w-1/2 space-y-3">
        <h3 className="font-display text-2xl font-bold text-foreground">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

const Step = forwardRef<HTMLDivElement, { n: number; title: string; description: string }>(
  ({ n, title, description }, ref) => {
    return (
      <div ref={ref} className="text-center flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-secondary text-secondary-foreground font-bold text-lg flex items-center justify-center font-display">
          {n}
        </div>
        <h3 className="font-display font-bold text-foreground text-lg">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    );
  }
);

Step.displayName = "Step";
