import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SEO } from "@/components/seo/SEO";
import {
  Library,
  Users,
  Palette,
  Shield,
  Dice6,
  BarChart3,
  Calendar,
  MessageSquare,
  Star,
  Heart,
  Clock,
  Upload,
  BookOpen,
  Trophy,
  Bell,
  Shuffle,
  ArrowLeft,
  MessageCircle,
  ArrowLeftRight,
  Target,
  Vote,
  DollarSign,
  Download,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Copy,
  Store,
  Building2,
  Layers,
  UserCircle,
  List,
  Mail,
  UserPlus,
  Server,
  Globe,
  Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import logoImage from "@/assets/logo.png";

interface FeatureDetailProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlights?: string[];
  badge?: string;
}

function FeatureDetail({ icon, title, description, highlights, badge }: FeatureDetailProps) {
  return (
    <div className="bg-muted/50 dark:bg-wood-medium/20 rounded-xl p-6 border border-border/20 hover:border-secondary/40 transition-colors relative">
      {badge && (
        <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-secondary/20 text-secondary px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div className="flex items-start gap-4">
        <div className="text-secondary shrink-0 mt-1">{icon}</div>
        <div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">{title}</h3>
          <p className="text-muted-foreground mb-3">{description}</p>
          {highlights && highlights.length > 0 && (
            <ul className="space-y-1">
              {highlights.map((highlight, i) => (
                <li key={i} className="text-muted-foreground/70 text-sm flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-secondary flex-shrink-0" />
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="font-display text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
      <span className="text-secondary">{icon}</span>
      {title}
    </h2>
  );
}

export default function Features() {
  const { isAuthenticated } = useAuth();
  const { data: myLibrary } = useMyLibrary();

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium">
      <SEO
        title="Features"
        description="Everything GameTaverns offers: collection management, play tracking, lending library, community forums, polls, trade matching, achievements, AI recommendations, and self-hosting."
        canonical="https://hobby-shelf-spark.lovable.app/features"
      />
      {/* Header */}
      <header className="border-b border-border/30 bg-muted/50 dark:bg-wood-dark/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoImage} alt="GameTaverns" className="h-10 w-auto" />
            <span className="font-display text-2xl font-bold text-foreground">GameTaverns</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <FeedbackDialog />
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                    Dashboard
                  </Button>
                </Link>
                {myLibrary && (
                  <a href={getLibraryUrl(myLibrary.slug, "/")}>
                    <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                      My Library
                    </Button>
                  </a>
                )}
              </>
            ) : (
              <Link to="/login">
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                  Sign In
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
          Everything Your Library Needs
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mb-4">
          GameTaverns is built by board gamers, for board gamers. A complete platform for managing
          collections, tracking plays, building community, and connecting with others who love the hobby.
        </p>
        <div className="flex flex-wrap gap-3 mb-12">
          {[
            "Collection Management", "Play Tracking", "Lending Library", "Social Profiles",
            "Events & Polls", "Community Forums", "Trade Matching", "BGG Sync",
            "Achievements", "AI Recommendations", "Self-Hostable"
          ].map((tag) => (
            <span key={tag} className="text-xs font-medium px-3 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* Core Library */}
      <section className="container mx-auto px-4 py-8">
        <SectionHeading icon={<Library className="h-6 w-6" />} title="Core Library Features" />
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FeatureDetail
            icon={<Upload className="h-6 w-6" />}
            title="Easy Game Import"
            description="Add games in seconds with automatic data from BoardGameGeek — no manual entry required."
            highlights={[
              "Search by name or paste a BGG URL",
              "Bulk CSV import for large collections",
              "Box art, player counts, descriptions auto-filled",
              "Edit any field after import"
            ]}
          />
          <FeatureDetail
            icon={<BookOpen className="h-6 w-6" />}
            title="Rich Game Details"
            description="Every game includes a full detail page with everything you need at a glance."
            highlights={[
              "Player count, play time, complexity",
              "Your personal notes and condition grade",
              "Storage location tracking",
              "Linked expansions and parent games"
            ]}
          />
          <FeatureDetail
            icon={<Star className="h-6 w-6" />}
            title="Ratings & Favorites"
            description="Let visitors rate games and mark your favorites to highlight the best in your collection."
            highlights={[
              "5-star guest rating system (no account needed)",
              "Favorite games displayed prominently",
              "Average ratings on every game card",
              "BGG community rating comparison"
            ]}
          />
          <FeatureDetail
            icon={<Heart className="h-6 w-6" />}
            title="Guest Wishlist"
            description="Visitors can wishlist games they'd love to see added — great for planning purchases."
            highlights={[
              "No account required for guests",
              "See which games get the most requests",
              "Sort your collection by wishlist demand",
              "Perfect for game night planning"
            ]}
          />
          <FeatureDetail
            icon={<DollarSign className="h-6 w-6" />}
            title="Collection Value Tracking"
            description="Understand the financial picture of your collection with purchase prices and current values."
            highlights={[
              "Record purchase price and date per game",
              "Set estimated current market values",
              "BGG marketplace price integration",
              "Total invested vs. current value dashboard"
            ]}
          />
          <FeatureDetail
            icon={<Copy className="h-6 w-6" />}
            title="Multi-Copy Inventory"
            description="Own multiple copies of a game? Track each one individually with per-unit detail."
            highlights={[
              "Label and number each copy",
              "Condition tracking per unit",
              "Assign specific copies to loans",
              "Notes field per copy"
            ]}
          />
          <FeatureDetail
            icon={<RefreshCw className="h-6 w-6" />}
            title="BGG Auto-Sync"
            description="Keep your GameTaverns library in perfect sync with your BoardGameGeek collection — automatically."
            highlights={[
              "Daily or weekly sync schedules",
              "Sync collection, plays, and wishlist",
              "Configurable removal behavior",
              "Sync status and last-run time visible in settings"
            ]}
          />
          <FeatureDetail
            icon={<Store className="h-6 w-6" />}
            title="For Sale Marketplace"
            description="List games you're selling directly from your library. Buyers contact you through the integrated messaging system."
            highlights={[
              "Set prices and condition grades",
              "Visible to all library visitors",
              "Integrated with secure messaging",
              "Toggle on/off per game"
            ]}
          />
          <FeatureDetail
            icon={<Layers className="h-6 w-6" />}
            title="Multiple Libraries"
            description="Manage more than one library from a single account — for clubs, schools, or multiple game groups."
            highlights={[
              "Switch between libraries on the dashboard",
              "Separate collections, members, and settings per library",
              "Unified personal profile across all libraries",
              "Configurable per-platform limits"
            ]}
          />
          <FeatureDetail
            icon={<List className="h-6 w-6" />}
            title="Curated Lists"
            description="Create and share hand-picked game lists — best games for families, party picks, gateway games, and more."
            highlights={[
              "Build public or private lists",
              "Share lists across the community",
              "Community voting on public lists",
              "Link lists to your library"
            ]}
            badge="New"
          />
        </div>
      </section>

      {/* Play Tracking */}
      <section className="container mx-auto px-4 py-8">
        <SectionHeading icon={<Dice6 className="h-6 w-6" />} title="Play Tracking & Statistics" />
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FeatureDetail
            icon={<Clock className="h-6 w-6" />}
            title="Play Session Logging"
            description="Record every game session with detailed information — who played, who won, and how long it took."
            highlights={[
              "Date, duration, and player count",
              "Track winners, scores, and player colors",
              "Add session notes",
              "Log expansions used"
            ]}
          />
          <FeatureDetail
            icon={<BarChart3 className="h-6 w-6" />}
            title="BG Stats-Style Analytics"
            description="Deep play statistics with beautiful charts — inspired by the best in the hobby."
            highlights={[
              "H-index calculation for breadth",
              "Monthly and yearly play summaries",
              "Most-played games leaderboard",
              "Player win rates and head-to-head stats"
            ]}
          />
          <FeatureDetail
            icon={<Trophy className="h-6 w-6" />}
            title="Achievements System"
            description="Automatically earn badges as you hit milestones — motivation to keep playing."
            highlights={[
              "Play count, variety, and streak achievements",
              "Secret achievements to discover",
              "Feature a badge on your public profile",
              "Tier-based progression (bronze → platinum)"
            ]}
          />
          <FeatureDetail
            icon={<Gamepad2 className="h-6 w-6" />}
            title="Group Challenges"
            description="Set play goals and compete with your library community over a defined period."
            highlights={[
              "Play count or unique games goals",
              "Competitive leaderboards",
              "Real-time progress tracking",
              "Start/end date configuration"
            ]}
          />
          <FeatureDetail
            icon={<Shuffle className="h-6 w-6" />}
            title="Random Game Picker"
            description="Can't decide what to play? Let the picker choose for you with smart filters."
            highlights={[
              "Filter by player count and play time",
              "Exclude recently played games",
              "Spin the wheel for game night drama",
              "Works on mobile"
            ]}
          />
          <FeatureDetail
            icon={<Download className="h-6 w-6" />}
            title="BGG Play History Import"
            description="Bring all your existing play data from BoardGameGeek in one go."
            highlights={[
              "Import by BGG username",
              "Smart deduplication — no double counting",
              "Player names, scores, and colors imported",
              "Update existing plays with fresh data"
            ]}
          />
          <FeatureDetail
            icon={<Sparkles className="h-6 w-6" />}
            title="AI Game Recommendations"
            description="Discover what to play next with intelligent suggestions based on what's in your library."
            highlights={[
              "\"Games like this\" on every game detail page",
              "Based on mechanics, theme, and complexity",
              "Only recommends games actually in your library",
              "Powered by AI analysis"
            ]}
          />
        </div>
      </section>

      {/* Social */}
      <section className="container mx-auto px-4 py-8">
        <SectionHeading icon={<UserCircle className="h-6 w-6" />} title="Social & Profiles" />
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FeatureDetail
            icon={<UserCircle className="h-6 w-6" />}
            title="Public User Profiles"
            description="Every user gets a rich public profile page showcasing their gaming life."
            highlights={[
              "Display name, avatar, and bio",
              "Featured achievement badge",
              "Play history stats at a glance",
              "Listed libraries and collections"
            ]}
            badge="New"
          />
          <FeatureDetail
            icon={<UserPlus className="h-6 w-6" />}
            title="Follow System"
            description="Follow other players to see their activity and build your gaming network."
            highlights={[
              "Follow/unfollow any user",
              "See followers and following counts",
              "Discover users through suggestions",
              "Search by username or display name"
            ]}
            badge="New"
          />
          <FeatureDetail
            icon={<Mail className="h-6 w-6" />}
            title="Direct Messages"
            description="Private messaging between users — coordinate trades, loans, or game nights."
            highlights={[
              "Real-time message delivery",
              "Conversation threads per user pair",
              "Unread count in the header",
              "Delete messages on either side"
            ]}
            badge="New"
          />
          <FeatureDetail
            icon={<Bell className="h-6 w-6" />}
            title="Activity Feed & Notifications"
            description="Stay informed about what's happening across your libraries and network."
            highlights={[
              "Real-time notifications in the header",
              "Loan request and approval alerts",
              "Forum reply notifications",
              "Achievement unlock announcements"
            ]}
          />
        </div>
      </section>

      {/* Community */}
      <section className="container mx-auto px-4 py-8">
        <SectionHeading icon={<Users className="h-6 w-6" />} title="Lending Library & Community" />
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FeatureDetail
            icon={<Users className="h-6 w-6" />}
            title="Lending Library"
            description="Run a community lending program with request management, tracking, and borrower accountability."
            highlights={[
              "Members request to borrow games",
              "Track who has what and when it's due",
              "Borrower ratings and reviews after return",
              "Multi-copy assignment for duplicate games"
            ]}
          />
          <FeatureDetail
            icon={<Calendar className="h-6 w-6" />}
            title="Events & Game Nights"
            description="Plan, promote, and manage game nights with full Discord integration."
            highlights={[
              "Create events with dates and locations",
              "RSVP tracking for attendees",
              "Auto-create Discord Scheduled Events",
              "Discord forum thread per event"
            ]}
          />
          <FeatureDetail
            icon={<Vote className="h-6 w-6" />}
            title="Polls & Game Night Voting"
            description="Let your group vote on what to play — shareable links work for anyone, no account needed."
            highlights={[
              "Pick games from your library as options",
              "Configurable max votes per person",
              "Share via link to your Discord or group chat",
              "Live results as votes come in"
            ]}
          />
          <FeatureDetail
            icon={<MessageCircle className="h-6 w-6" />}
            title="Community Forums"
            description="Built-in discussion boards for your library and cross-library clubs."
            highlights={[
              "Library-scoped and club-scoped categories",
              "Threaded replies on every post",
              "Moderator tools for library owners",
              "Real-time updates via live sync"
            ]}
          />
          <FeatureDetail
            icon={<ArrowLeftRight className="h-6 w-6" />}
            title="Trade Matching"
            description="Automatically find trade opportunities with other discoverable libraries — no marketplace needed."
            highlights={[
              "List games you'd trade and games you want",
              "Automatic cross-library matching by BGG ID",
              "Contact traders directly via messaging",
              "Only shows games from libraries you can discover"
            ]}
          />
          <FeatureDetail
            icon={<MessageSquare className="h-6 w-6" />}
            title="Secure Game Inquiries"
            description="Visitors can ask about specific games without exposing your email address."
            highlights={[
              "Encrypted message storage",
              "Reply directly from the dashboard",
              "Cloudflare Turnstile spam protection",
              "No account required to send"
            ]}
          />
          <FeatureDetail
            icon={<Building2 className="h-6 w-6" />}
            title="Clubs"
            description="Connect multiple libraries under a shared club for cross-library discovery and events."
            highlights={[
              "Combined catalog with ownership attribution",
              "Shared event calendar across member libraries",
              "Club-scoped forum categories",
              "Invite-code access for privacy"
            ]}
          />
          <FeatureDetail
            icon={<Target className="h-6 w-6" />}
            title="Catalog Browser"
            description="Browse the global GameTaverns catalog of thousands of board games, even without a library."
            highlights={[
              "Search and filter 50,000+ games",
              "Community ratings and review data",
              "Video guides linked per game",
              "Add directly to your library from results"
            ]}
          />
        </div>
      </section>

      {/* Customization */}
      <section className="container mx-auto px-4 py-8">
        <SectionHeading icon={<Palette className="h-6 w-6" />} title="Customization & Privacy" />
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FeatureDetail
            icon={<Palette className="h-6 w-6" />}
            title="Full Theme Customization"
            description="Make your library look uniquely yours with complete visual control over every element."
            highlights={[
              "Custom colors for light and dark mode independently",
              "Upload your own logo and background image",
              "Choose display and body fonts",
              "Live preview as you edit"
            ]}
          />
          <FeatureDetail
            icon={<Shield className="h-6 w-6" />}
            title="Privacy Controls"
            description="You decide what visitors can see — every feature can be toggled on or off independently."
            highlights={[
              "Per-feature visibility toggles",
              "Hide purchase prices from public view",
              "Public or private library mode",
              "Directory listing opt-in"
            ]}
          />
          <FeatureDetail
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Two-Factor Authentication"
            description="Protect your account with TOTP-based 2FA from any standard authenticator app."
            highlights={[
              "Works with Google Authenticator, Authy, 1Password, etc.",
              "Backup codes for account recovery",
              "Configurable grace periods",
              "QR code setup flow"
            ]}
          />
          <FeatureDetail
            icon={<Globe className="h-6 w-6" />}
            title="Custom Domain Support"
            description="Host your library on your own domain for a fully branded experience."
            highlights={[
              "Point any domain or subdomain to your library",
              "Automatic SSL / HTTPS",
              "Tenant-aware routing",
              "Works alongside the default .gametaverns.app subdomain"
            ]}
          />
        </div>
      </section>

      {/* Self-Hosting */}
      <section className="container mx-auto px-4 py-8">
        <SectionHeading icon={<Server className="h-6 w-6" />} title="Self-Hosting" />
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FeatureDetail
            icon={<Server className="h-6 w-6" />}
            title="Fully Self-Hostable"
            description="Run GameTaverns on your own infrastructure — full feature parity with the cloud version."
            highlights={[
              "Docker Compose deployment on any VPS",
              "Bundled with self-hosted Supabase (PostgreSQL + auth + storage)",
              "Nginx reverse-proxy configuration included",
              "All edge functions included and self-contained"
            ]}
            badge="Open Source"
          />
          <FeatureDetail
            icon={<Shield className="h-6 w-6" />}
            title="Data Sovereignty"
            description="Your data stays on your server. No third-party cloud storage, no data sharing."
            highlights={[
              "All data in your own PostgreSQL database",
              "File storage on your own filesystem",
              "No telemetry or analytics sent externally",
              "Full database export at any time"
            ]}
            badge="Open Source"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="bg-muted/50 dark:bg-wood-medium/30 rounded-2xl p-12 border border-border/30">
          <h2 className="font-display text-3xl font-bold text-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Create your free library today and discover why GameTaverns is the most complete board game library platform available.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              myLibrary ? (
                <a href={getLibraryUrl(myLibrary.slug, "/")}>
                  <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8">
                    Go to My Library
                  </Button>
                </a>
              ) : (
                <Link to="/create-library">
                  <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8">
                    Create Your Library
                  </Button>
                </Link>
              )
            ) : (
              <Link to="/signup">
                <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8">
                  Start Now — It's Free
                </Button>
              </Link>
            )}
            <Link to="/">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-muted/50 dark:bg-wood-dark/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} GameTaverns. A hobby project made with ❤️ for board game enthusiasts.
            </p>
            <nav className="flex gap-6 text-sm">
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
              <Link to="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">Cookies</Link>
              <Link to="/legal" className="text-muted-foreground hover:text-foreground transition-colors">Legal</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
