import { Link } from "react-router-dom";
import {
  Library, Users, Dice6, ArrowLeftRight, Calendar, MessageSquare,
  Trophy, Star, Upload, Zap, Shield, BarChart3, Building2,
  ChevronRight, Download, Mail, ExternalLink, Vote, Shuffle, BookOpen, RefreshCw,
  Palette, Swords,
} from "lucide-react";
import { SEO } from "@/components/seo/SEO";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import logoImage from "@/assets/logo.png";

// Press kit screenshots (served from public/presskit/)
const PK = "/presskit";

export default function Press() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SEO
        title="Press Kit — GameTaverns"
        description="Press kit for GameTaverns — the all-in-one board game library management platform. Brand assets, screenshots, and feature overview for content creators, publishers, and media."
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
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Home</Button>
            </Link>
            <Link to="/features">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Features</Button>
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="container mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary border border-secondary/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <Mail className="h-3.5 w-3.5" />
          Press & Media Kit
        </div>
        <h1 className="font-display text-4xl sm:text-6xl font-bold text-foreground mb-6 leading-tight">
          GameTaverns Press Kit
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
          Everything you need to cover GameTaverns — brand assets, screenshots, feature highlights,
          and key facts for content creators, game designers, publishers, and media.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="mailto:press@gametaverns.com">
            <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8 py-6">
              <Mail className="h-5 w-5 mr-2" />
              Contact Us
            </Button>
          </a>
          <a href="#brand-assets">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6">
              <Download className="h-5 w-5 mr-2" />
              Brand Assets
            </Button>
          </a>
        </div>
      </section>

      {/* ── Quick Facts ── */}
      <section className="bg-muted/30 border-y border-border/20">
        <div className="container mx-auto px-4 py-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
            What is GameTaverns?
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-3xl mx-auto text-lg leading-relaxed">
            GameTaverns is the all-in-one platform for board game collectors, game groups, and community lending libraries.
            It replaces spreadsheets, scattered apps, and manual tracking with a unified experience — from cataloging and play logging
            to lending management, game night voting, and community building.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <FactCard label="Launch" value="2025" />
            <FactCard label="Price" value="Free" />
            <FactCard label="Import" value="BGG / CSV / Catalog" />
            <FactCard label="Platform" value="Web + Mobile" />
          </div>
        </div>
      </section>

      {/* ── Screenshots ── */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
          Platform Screenshots
        </h2>
        <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
          High-resolution screenshots showcasing the GameTaverns experience. Click to view full size.
        </p>
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Library Views — wide format */}
          <ScreenshotGroup label="Library & Collection">
            <div className="grid md:grid-cols-2 gap-8">
              <ScreenshotCard
                src={`${PK}/library1-2.jpg`}
                title="Library Collection — Dark Theme"
                description="Beautiful grid layout with filters, search, and detailed game cards. Supports multiple views and custom sorting."
              />
              <ScreenshotCard
                src={`${PK}/library2-2.jpg`}
                title="Library Collection — Teal Theme"
                description="Every library is fully customizable with unique colors, fonts, and backgrounds to match each owner's style."
              />
            </div>
            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <ScreenshotCard
                src={`${PK}/gamecard-2.jpg`}
                title="Game Detail Card"
                description="Rich game pages with box art, descriptions, mechanics, designer credits, play history, and documents."
              />
              <ScreenshotCard
                src={`${PK}/addgames.jpg`}
                title="Multiple Import Options"
                description="Import games via CSV upload, BGG collection sync, or search the built-in catalog. Refresh images and ratings in bulk."
              />
            </div>
          </ScreenshotGroup>

          {/* Profiles */}
          <ScreenshotGroup label="Profiles & Customization">
            <div className="grid md:grid-cols-2 gap-8">
              <ScreenshotCard
                src={`${PK}/badges2-2.jpg`}
                title="Profile — Dark Theme"
                description="Fully customizable profiles with role badges, follower counts, cover images, and community reputation. Each user can personalize their colors and layout."
              />
              <ScreenshotCard
                src={`${PK}/userprofile.jpg`}
                title="Profile — Custom Theme"
                description="Unique colors, fonts, and backgrounds make every profile stand out. Activity feeds show achievements earned, games added, and community interactions."
              />
            </div>
          </ScreenshotGroup>

          {/* Play Stats */}
          <ScreenshotGroup label="Play Tracking & Stats">
            <div className="max-w-3xl mx-auto">
              <ScreenshotCard
                src={`${PK}/playstats.jpg`}
                title="Play Stats & Analytics"
                description="Monthly and annual play tracking with H-index, top mechanics, most played games, and session history."
                uniformHeight
              />
            </div>
          </ScreenshotGroup>

          {/* Game Night */}
          <ScreenshotGroup label="Game Night">
            <div className="grid md:grid-cols-2 gap-8">
              <ScreenshotCard
                src={`${PK}/poll.jpg`}
                title="Game Night Polls"
                description="Shareable voting polls for game nights — no account required. Live results and RSVP tracking."
                uniformHeight
              />
              <ScreenshotCard
                src={`${PK}/pollresults.jpg`}
                title="Poll Results"
                description="Live ranked results with vote counts, percentages, and trophy indicators for top picks."
                uniformHeight
              />
            </div>
            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <ScreenshotCard
                src={`${PK}/picker_setup.jpg`}
                title="Random Game Picker"
                description="Filter by type, genre, play time, and player count — then spin to let fate choose your next game."
                uniformHeight
              />
              <ScreenshotCard
                src={`${PK}/picker_result.jpg`}
                title="Picker Result"
                description="Tonight's pick displayed with box art, game type, and player count. Share or pick again."
                uniformHeight
              />
            </div>
          </ScreenshotGroup>

          {/* Lending */}
          <ScreenshotGroup label="Lending & Borrowing">
            <div className="grid md:grid-cols-3 gap-8">
              <ScreenshotCard
                src={`${PK}/borrow1.jpg`}
                title="Lending Management"
                description="Full lending dashboard with inventory overview, pending requests, and loan history tracking."
                uniformHeight
              />
              <ScreenshotCard
                src={`${PK}/borrow2.jpg`}
                title="Loan Approval"
                description="Approve borrow requests with condition notes, due dates, and optional pickup instructions."
                uniformHeight
              />
              <ScreenshotCard
                src={`${PK}/borrow_returned.jpg`}
                title="Returned & Rated"
                description="Track return condition and rate borrowers to build community trust and lending reputation."
                uniformHeight
              />
            </div>
          </ScreenshotGroup>
        </div>
      </section>

      {/* ── Key Features for Press ── */}
      <section className="bg-muted/30 border-y border-border/20">
        <div className="container mx-auto px-4 py-20">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
            What Makes GameTaverns Special
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">
            Key differentiators that set GameTaverns apart from existing tools.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <DiffCard
              icon={<Upload className="h-6 w-6" />}
              title="Flexible Import Options"
              description="Import your collection via BGG sync, CSV upload, or search the built-in catalog. Set up automatic daily or weekly BGG sync to keep everything current."
            />
            <DiffCard
              icon={<Library className="h-6 w-6" />}
              title="Full Lending Library System"
              description="Not just a catalog — a complete lending workflow with borrow requests, due dates, condition tracking, waitlists, copy management, and borrower reputation ratings."
            />
            <DiffCard
              icon={<Vote className="h-6 w-6" />}
              title="No-Account Game Night Voting"
              description="Create shareable polls for game night decisions. Anyone with the link can vote — no signup required. Live results, RSVP tracking, and event scheduling built in."
            />
            <DiffCard
              icon={<Trophy className="h-6 w-6" />}
              title="Achievements & Gamification"
              description="Milestone badges for play counts, game variety, lending streaks, and community contributions. Track your H-index, win rates, and personal records."
            />
            <DiffCard
              icon={<Swords className="h-6 w-6" />}
              title="ELO Competitive Rankings"
              description="Tag other players in play sessions and track competitive ELO ratings per game and globally. Rankings from Beginner to Elite update automatically when tagged players accept."
            />
            <DiffCard
              icon={<Palette className="h-6 w-6" />}
              title="Fully Customizable Theming"
              description="Every library and profile is unique. Choose your own colors, display fonts, background images, and layout. HSL-based palette system ensures everything looks cohesive."
            />
            <DiffCard
              icon={<Building2 className="h-6 w-6" />}
              title="Clubs: Multi-Library Networks"
              description="Connect multiple libraries into a shared Club with combined catalogs, cross-library forums, shared events, and unified member management."
            />
            <DiffCard
              icon={<ArrowLeftRight className="h-6 w-6" />}
              title="Automated Trade Matching"
              description="List games you'd trade and GameTaverns automatically finds matches from other libraries. Built-in messaging for negotiation."
            />
            <DiffCard
              icon={<Zap className="h-6 w-6" />}
              title="Smart Recommendations"
              description="Get personalized game suggestions based on your play history and preferences — only recommending games that actually exist in your library or local community."
            />
            <DiffCard
              icon={<Shield className="h-6 w-6" />}
              title="Privacy-First Architecture"
              description="Every feature can be toggled on or off. Libraries can be public or private. Profiles are only visible to connected community members and admins."
            />
          </div>
        </div>
      </section>

      {/* ── Who It's For ── */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
          Who GameTaverns Is Built For
        </h2>
        <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
          Different audiences, one unified platform.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <AudienceBlock
            icon={<BookOpen className="h-6 w-6" />}
            title="Board Game Collectors"
            points={["Import & sync with BGG", "Track condition, location & value", "Log plays with stats & charts", "Earn achievements"]}
          />
          <AudienceBlock
            icon={<Users className="h-6 w-6" />}
            title="Game Groups"
            points={["Game night polls & RSVP", "Lending with request tracking", "Random game picker", "Trade matching"]}
          />
          <AudienceBlock
            icon={<Building2 className="h-6 w-6" />}
            title="Community Libraries"
            points={["Full borrower management", "QR codes for shelves", "Events & announcements", "Multi-library Clubs"]}
          />
          <AudienceBlock
            icon={<Star className="h-6 w-6" />}
            title="Content Creators"
            points={["Embed & share library links", "Deep game data & stats", "Community forums", "Public profiles & activity"]}
          />
        </div>
      </section>

      {/* ── Brand Assets ── */}
      <section id="brand-assets" className="bg-muted/30 border-y border-border/20">
        <div className="container mx-auto px-4 py-20">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
            Brand Assets
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
            Download our logo and follow our brand guidelines when featuring GameTaverns.
          </p>
          <div className="max-w-3xl mx-auto">
            <div className="grid sm:grid-cols-2 gap-8">
              {/* Logo preview */}
              <div className="bg-background border border-border/30 rounded-2xl p-8 flex flex-col items-center gap-6">
                <div className="bg-muted/50 rounded-xl p-8 w-full flex items-center justify-center">
                  <img src={logoImage} alt="GameTaverns Logo" className="h-24 w-auto" />
                </div>
                <div className="text-center">
                  <h3 className="font-display font-bold text-foreground mb-1">Primary Logo</h3>
                  <p className="text-sm text-muted-foreground">Use on dark or light backgrounds</p>
                </div>
              </div>

              {/* Brand guidelines */}
              <div className="bg-background border border-border/30 rounded-2xl p-8 flex flex-col gap-5">
                <h3 className="font-display font-bold text-foreground text-lg">Brand Guidelines</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="font-semibold text-foreground">Name:</span>
                    <span className="text-muted-foreground ml-2">GameTaverns (one word, capital G and T)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Tagline:</span>
                    <span className="text-muted-foreground ml-2">"Your Board Game Collection Finally Has a Home"</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Primary Color:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded bg-secondary border border-border/30" />
                      <span className="text-muted-foreground">Amber / Gold</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Font:</span>
                    <span className="text-muted-foreground ml-2">Display headings use a bold serif/display typeface</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Tone:</span>
                    <span className="text-muted-foreground ml-2">Warm, welcoming, community-focused. Think friendly game store, not corporate SaaS.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Boilerplate / Quick Copy ── */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
          Ready-to-Use Copy
        </h2>
        <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
          Short and long descriptions you can use in articles, videos, and social posts.
        </p>
        <div className="max-w-4xl mx-auto space-y-8">
          <CopyBlock
            label="One-Liner"
            text="GameTaverns is the free, all-in-one platform for board game collectors and communities to catalog, lend, and celebrate their collections."
          />
          <CopyBlock
            label="Short Description (50 words)"
            text="GameTaverns is a free platform that turns your board game collection into a shareable, fully customizable library. Import from BoardGameGeek in seconds, log plays with ELO rankings, lend games with tracking, run game night polls, earn achievements, and connect with other enthusiasts. Built for collectors, game groups, and community lending libraries."
          />
          <CopyBlock
            label="Long Description (100 words)"
            text="GameTaverns is the all-in-one board game library management platform designed for collectors, game groups, and community lending libraries. Import your entire BoardGameGeek collection with one click, then track every game's condition, location, and value. Log play sessions with scores, tag other players, and track competitive ELO rankings from Beginner to Elite. Every library and profile is fully customizable with unique themes, colors, fonts, and backgrounds. The built-in lending system handles borrow requests, due dates, and borrower reputation. Game night polls let anyone vote — no account needed. Libraries can form Clubs to create multi-library networks. Trade matching connects you with nearby collections. Free, privacy-first, and open to all."
          />
        </div>
      </section>

      {/* ── Contact CTA ── */}
      <section className="bg-muted/30 border-t border-border/20">
        <div className="container mx-auto px-4 py-24 text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-foreground mb-4">
            Want to Feature GameTaverns?
          </h2>
          <p className="text-muted-foreground mb-10 max-w-lg mx-auto text-lg">
            We'd love to hear from you. Reach out for review copies, interviews, additional assets, or partnership opportunities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="mailto:press@gametaverns.com">
              <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-10 py-6">
                <Mail className="h-5 w-5 mr-2" />
                press@gametaverns.com
              </Button>
            </a>
            <a href="https://gametaverns.com" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Visit GameTaverns
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ── Sub-components ──

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background border border-border/30 rounded-xl p-6 text-center">
      <div className="text-2xl font-bold text-secondary font-display mb-1">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function ScreenshotCard({ src, title, description, placeholder = false, uniformHeight = false }: { src: string; title: string; description: string; placeholder?: boolean; uniformHeight?: boolean }) {
  return (
    <div className="group">
      <a href={src} target="_blank" rel="noopener noreferrer" className="block">
        <div className={`overflow-hidden rounded-xl border mb-4 ${placeholder ? "border-dashed border-secondary/40 bg-secondary/5" : "border-border/30 bg-muted/30"}`}>
          {placeholder ? (
            <div className="w-full aspect-video flex flex-col items-center justify-center gap-3 p-8">
              <Upload className="h-10 w-10 text-secondary/40" />
              <span className="text-sm text-muted-foreground text-center">Replace with your own screenshot</span>
            </div>
          ) : (
            <img
              src={src}
              alt={title}
              className={`w-full object-cover object-top transition-transform duration-300 group-hover:scale-105 ${uniformHeight ? "aspect-video" : "h-auto"}`}
              loading="lazy"
            />
          )}
        </div>
      </a>
      <h3 className="font-display font-bold text-foreground text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function ScreenshotGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-xl font-bold text-secondary mb-6">{label}</h3>
      {children}
    </div>
  );
}

function DiffCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-5 p-6 rounded-xl border border-border/20 bg-background">
      <div className="text-secondary shrink-0 mt-1">{icon}</div>
      <div>
        <h3 className="font-display font-bold text-foreground text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function AudienceBlock({ icon, title, points }: { icon: React.ReactNode; title: string; points: string[] }) {
  return (
    <div className="bg-muted/50 border border-border/30 rounded-xl p-6">
      <div className="text-secondary mb-3">{icon}</div>
      <h3 className="font-display font-bold text-foreground mb-3">{title}</h3>
      <ul className="space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
            <ChevronRight className="h-3.5 w-3.5 text-secondary shrink-0 mt-0.5" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-muted/50 border border-border/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-foreground">{label}</h3>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="text-muted-foreground hover:text-foreground">
          Copy
        </Button>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
    </div>
  );
}
