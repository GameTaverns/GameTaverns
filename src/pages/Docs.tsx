import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomTabs } from "@/components/mobile/MobileBottomTabs";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen, Gamepad2, BarChart3, UserCircle, MessageSquare,
  Users, Settings, HelpCircle, Shield, Search,
  Sparkles, Globe, Calendar, BookMarked, Mail, Dice5,
  ClipboardList, Library, TrendingUp, Heart, Star, RefreshCw,
  Copy, Vote, Building2, Target, Download, Palette, DollarSign,
  ArrowLeftRight, Bell, Server, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/navigation/BackLink";

/* ── Helpers ── */

function SectionCard({ icon: Icon, title, children }: {
  icon: any; title: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary shrink-0" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{n}</span>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-secondary/30 border border-secondary/50 px-4 py-3 text-sm text-foreground">
      <strong className="text-secondary">💡 Tip:</strong> {children}
    </div>
  );
}

/* ── Navigation sections ── */

const sections = [
  { id: "getting-started", label: "Getting Started", icon: BookOpen },
  { id: "dashboard", label: "Dashboard & Navigation", icon: MapPin },
  { id: "collection", label: "Collection Management", icon: Gamepad2 },
  { id: "insights", label: "Insights & Analytics", icon: Sparkles },
  { id: "play-tracking", label: "Play Tracking", icon: BarChart3 },
  { id: "lending", label: "Lending & Loans", icon: BookMarked },
  { id: "social", label: "Social & Messaging", icon: UserCircle },
  { id: "community", label: "Community & Events", icon: Users },
  { id: "catalog", label: "Game Catalog & Directory", icon: Globe },
  { id: "discord", label: "Discord Integration", icon: MessageSquare },
  { id: "advanced", label: "Advanced Settings", icon: Settings },
  { id: "faq", label: "FAQ", icon: HelpCircle },
] as const;

type SectionId = typeof sections[number]["id"];

/* ── Main Component ── */

export default function Docs() {
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const { data: library, isLoading: libraryLoading } = useMyLibrary();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionId>("getting-started");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!loading && !libraryLoading) {
      if (!isAuthenticated) navigate("/login");
      else if (!isAdmin && !library) navigate("/dashboard");
    }
  }, [loading, libraryLoading, isAuthenticated, isAdmin, library, navigate]);

  if (loading || libraryLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated || (!isAdmin && !library)) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      <main className="container mx-auto px-4 py-6 max-w-5xl flex-1">
        {/* Header */}
        <div className="mb-6">
          <BackLink fallback="/dashboard" className="mb-3" />
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Help & Documentation</h1>
          <p className="text-muted-foreground mt-1">Everything you need to know about GameTaverns</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search help topics…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-6">
          {/* Sidebar nav — desktop only */}
          <nav className="hidden lg:block w-56 shrink-0 sticky top-24 self-start space-y-0.5">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSection(s.id);
                  document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors",
                  activeSection === s.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.label}
              </button>
            ))}
          </nav>

          {/* Mobile section picker */}
          <div className="lg:hidden mb-4 w-full">
            <select
              value={activeSection}
              onChange={(e) => {
                setActiveSection(e.target.value as SectionId);
                document.getElementById(`section-${e.target.value}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground"
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* ═══ GETTING STARTED ═══ */}
            <section id="section-getting-started" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Getting Started
              </h2>

              <SectionCard icon={Library} title="1. Create Your Library">
                <p>From the Dashboard, click <strong>"Add Game"</strong> — if you don't have a library yet, you'll be prompted to create one. Choose a name and URL slug (e.g., <code>my-game-group</code>). Your library is instantly live at <code>[slug].gametaverns.app</code>.</p>
              </SectionCard>

              <SectionCard icon={Gamepad2} title="2. Add Games">
                <p>Multiple ways to populate your collection:</p>
                <div className="space-y-2 pl-1">
                  <Step n={1}><strong>Search by name or BGG URL</strong> — type a game name or paste a BoardGameGeek URL to import with full metadata.</Step>
                  <Step n={2}><strong>BGG Collection Import</strong> — enter your BGG username to bulk-import your entire collection.</Step>
                  <Step n={3}><strong>CSV Import</strong> — upload a spreadsheet for large batch imports.</Step>
                  <Step n={4}><strong>Manual entry</strong> — fill in details by hand for games not on BGG.</Step>
                </div>
              </SectionCard>

              <SectionCard icon={Palette} title="3. Customize Your Theme">
                <p>Go to <strong>Library Settings → Theme</strong> to customize colors, fonts, logo, and background image. Configure separate looks for light and dark mode with an instant live preview.</p>
              </SectionCard>

              <SectionCard icon={Settings} title="4. Configure Feature Flags">
                <p>In <strong>Library Settings → Feature Flags</strong>, toggle which features are visible. All disabled features are completely hidden — no broken links or empty pages.</p>
              </SectionCard>

              <SectionCard icon={Users} title="5. Invite Members">
                <p>Share your library URL. Visitors create a GameTaverns account to join as members, unlocking borrowing, challenges, and community features. Assign roles (Member, Moderator) in <strong>Library Settings → Members</strong>.</p>
              </SectionCard>
            </section>

            {/* ═══ DASHBOARD & NAVIGATION ═══ */}
            <section id="section-dashboard" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Dashboard & Navigation
              </h2>

              <SectionCard icon={MapPin} title="Hub & Spoke Layout">
                <p>Your Dashboard is a central hub with six cards that link to dedicated pages:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>My Collection</strong> — browse, filter & manage your games</li>
                  <li><strong>Lending & Loans</strong> — pending requests, active loans, trade hub</li>
                  <li><strong>Insights & Analytics</strong> — Collection DNA, stats, achievements</li>
                  <li><strong>Community & Events</strong> — clubs, forums, events, RSVP</li>
                  <li><strong>Messages & Social</strong> — DMs, inquiries, activity feed</li>
                  <li><strong>Settings & Account</strong> — profile, security, preferences</li>
                </ul>
                <p>Each card shows live data summaries (e.g., pending loan count, unread messages).</p>
              </SectionCard>

              <SectionCard icon={Sparkles} title="Quick Actions Bar">
                <p>A scrollable row of action buttons sits above the hub cards for fast access:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Add Game</strong> — jump to the collection page to add a new game</li>
                  <li><strong>Library</strong> — visit your library's public page (dropdown if you own multiple)</li>
                  <li><strong>Catalog</strong> — browse the global game catalog</li>
                  <li><strong>Directory</strong> — discover other libraries near you</li>
                  <li><strong>Events</strong> — view public game events</li>
                  <li><strong>Lending</strong> — manage loans directly</li>
                  <li><strong>Log Play</strong> — record a play session</li>
                  <li><strong>Random</strong> — random game picker</li>
                  <li><strong>Profile</strong> — your public profile</li>
                  <li><strong>Help</strong> — this page</li>
                </ul>
              </SectionCard>

              <Tip>On mobile, the quick actions bar scrolls horizontally. Swipe left to reveal more buttons.</Tip>
            </section>

            {/* ═══ COLLECTION MANAGEMENT ═══ */}
            <section id="section-collection" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-primary" /> Collection Management
              </h2>

              <SectionCard icon={Search} title="Browse & Filter">
                <p>The Collection page lets you search, sort, and filter your entire library. Filter by player count, play time, weight, mechanics, and more. Toggle between grid and list views.</p>
              </SectionCard>

              <SectionCard icon={Copy} title="Multi-Copy Inventory">
                <p>For games you own multiple copies of, open the game's detail page and use the <strong>Copies</strong> section. Each copy gets a label, condition grade, and notes. When approving a loan, assign a specific copy.</p>
              </SectionCard>

              <SectionCard icon={Heart} title="Shelf of Shame">
                <p>The "Shelf of Shame" highlights unplayed games in your collection — games you own but have never logged a play session for. A great motivator for game night picks.</p>
              </SectionCard>

              <SectionCard icon={Dice5} title="Random Game Picker">
                <p>Can't decide what to play? The random picker suggests a game filtered by player count, play time, and recent plays. Available from the Collection page or via the <strong>Random</strong> quick action.</p>
              </SectionCard>

              <SectionCard icon={Download} title="Import & Export">
                <p>Import from BGG (collection + plays), CSV, or manual entry. Export your collection data for backup or analysis at any time.</p>
              </SectionCard>

              <SectionCard icon={DollarSign} title="Collection Value Tracking">
                <p>Track purchase prices, dates, and current estimated values per game. The system can pull BGG marketplace prices as reference. View total invested vs. current value in <strong>Insights & Analytics</strong>.</p>
              </SectionCard>

              <SectionCard icon={Star} title="Game Ratings">
                <p>Visitors can rate games on a 5-star scale. Ratings are anonymous — one vote per game per device. View aggregate ratings on each game's detail page.</p>
              </SectionCard>

              <SectionCard icon={Heart} title="Wishlist">
                <p>Visitors can "wish" for games they'd like to see added. No account required. View wishlist votes in <strong>Library Settings → Wishlist</strong>. Sort your library by wishlist demand.</p>
              </SectionCard>

              <SectionCard icon={Vote} title="Curated Lists">
                <p>Create hand-picked game lists (e.g., "Best 2-player games"). Lists can be public with community voting or private. Manage from <strong>My Collection → Lists</strong>.</p>
              </SectionCard>

              <SectionCard icon={DollarSign} title="For Sale Marketplace">
                <p>Mark any game as "For Sale" with a price and condition grade. Interested visitors send inquiries through the secure messaging system — no email exposed.</p>
              </SectionCard>
            </section>

            {/* ═══ INSIGHTS & ANALYTICS ═══ */}
            <section id="section-insights" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Insights & Analytics
              </h2>

              <SectionCard icon={Sparkles} title="Collection DNA">
                <p>Your Collection DNA analyzes your entire library to reveal your collector personality — favorite mechanics, theme affinities, complexity preferences, and rarity scores. Share your DNA card on social media.</p>
              </SectionCard>

              <SectionCard icon={TrendingUp} title="Stats Overview">
                <p>View comprehensive statistics including total plays, unique games played, H-index, monthly/yearly summaries, and player leaderboards. All stats update in real-time as plays are logged.</p>
              </SectionCard>

              <SectionCard icon={Target} title="Achievements">
                <p>Achievements unlock automatically as you hit milestones — play counts, variety (unique games), winning streaks, and secret achievements. Feature your best badge on your public profile.</p>
              </SectionCard>

              <SectionCard icon={Sparkles} title="AI Recommendations">
                <p>On any game's detail page, scroll to <strong>"You Might Also Like"</strong>. AI analyzes mechanics, theme, and complexity to suggest similar games from your library.</p>
              </SectionCard>

              <SectionCard icon={ClipboardList} title="Shareable Cards">
                <p>Generate shareable collection summary cards and achievement cards. Perfect for social media or sharing with your game group.</p>
              </SectionCard>
            </section>

            {/* ═══ PLAY TRACKING ═══ */}
            <section id="section-play-tracking" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Play Tracking
              </h2>

              <SectionCard icon={ClipboardList} title="Logging a Play Session">
                <p>Open any game and click <strong>"Log Play"</strong>, or use the <strong>Log Play</strong> quick action. Record:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Date and duration</li>
                  <li>Players (by name or linked user accounts)</li>
                  <li>Scores, winners, and player colors</li>
                  <li>Session notes and location</li>
                  <li>Expansions used</li>
                </ul>
                <p>Logged plays immediately update your analytics, H-index, and achievements.</p>
              </SectionCard>

              <SectionCard icon={BarChart3} title="Play Stats & H-Index">
                <p>Your H-index: you have an H-index of N if you've played N different games at least N times each. The Play Stats page shows most-played games, monthly/yearly trends, player win rates, and head-to-head records.</p>
              </SectionCard>

              <SectionCard icon={RefreshCw} title="Importing Play History from BGG">
                <div className="space-y-2 pl-1">
                  <Step n={1}>Go to <strong>Library Settings → BGG Sync</strong> and enter your BGG username.</Step>
                  <Step n={2}>Click <strong>"Import Play History"</strong>.</Step>
                  <Step n={3}>The system matches plays to games in your library and skips duplicates automatically.</Step>
                </div>
                <p className="mt-2">Only plays for games already in your library will be imported.</p>
              </SectionCard>

              <SectionCard icon={Target} title="Group Challenges">
                <p>Create competitive play challenges for your library members:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Play Count Goals</strong> — everyone tries to hit X total plays</li>
                  <li><strong>Unique Games</strong> — play as many different games as possible</li>
                  <li><strong>Specific Game</strong> — who can log the most plays of one game</li>
                  <li><strong>Competitive</strong> — leaderboard race</li>
                </ul>
                <p className="mt-1">Challenges have start/end dates, leaderboards, and real-time progress.</p>
              </SectionCard>
            </section>

            {/* ═══ LENDING & LOANS ═══ */}
            <section id="section-lending" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <BookMarked className="h-5 w-5 text-primary" /> Lending & Loans
              </h2>

              <SectionCard icon={BookMarked} title="How Lending Works">
                <p>Enable lending in <strong>Library Settings → Feature Flags</strong>. Members request to borrow games; you approve or deny from <strong>Lending & Loans</strong>. The Dashboard hub card shows your pending request count.</p>
                <div className="space-y-2 pl-1 mt-2">
                  <Step n={1}>Member requests a game → you see a pending notification</Step>
                  <Step n={2}>You approve with optional due date and copy assignment</Step>
                  <Step n={3}>When returned, you mark it as returned and rate the borrower</Step>
                </div>
              </SectionCard>

              <SectionCard icon={ArrowLeftRight} title="Cross-Library Trade Matching">
                <p>List games you'd trade and games you want. The system automatically matches your offers against all discoverable libraries. Contact traders through the messaging system.</p>
              </SectionCard>

              <SectionCard icon={Star} title="Borrower Ratings">
                <p>After a loan is returned, rate the borrower. Ratings build trust across the community and are visible on user profiles.</p>
              </SectionCard>
            </section>

            {/* ═══ SOCIAL & MESSAGING ═══ */}
            <section id="section-social" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-primary" /> Social & Messaging
              </h2>

              <SectionCard icon={UserCircle} title="Your Public Profile">
                <p>Every user has a profile at <code>/u/[username]</code> showing your display name, avatar, bio, featured badge, play stats, libraries, and follower counts. Edit in <strong>Settings → Profile</strong>.</p>
              </SectionCard>

              <SectionCard icon={Users} title="Following">
                <p>Follow other players to build your network. Visit any user's profile and click <strong>"Follow"</strong>. Discover users through the activity feed and directory.</p>
              </SectionCard>

              <SectionCard icon={Mail} title="Direct Messages">
                <p>Send private messages to any GameTaverns user. Access your inbox from the <strong>Messages & Social</strong> hub card or the envelope icon in the header. Messages are delivered in real-time with unread counts.</p>
              </SectionCard>

              <SectionCard icon={Mail} title="Game Inquiries">
                <p>Visitors can contact you about specific games without knowing your email. Messages are encrypted and visible in <strong>Messages & Social</strong>. Reply directly from the dashboard.</p>
              </SectionCard>

              <SectionCard icon={Bell} title="Notifications">
                <p>Bell icon in the header shows notifications for: forum replies, loan requests/approvals, achievement unlocks, new followers, and inquiry responses.</p>
              </SectionCard>
            </section>

            {/* ═══ COMMUNITY & EVENTS ═══ */}
            <section id="section-community" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Community & Events
              </h2>

              <SectionCard icon={Calendar} title="Events">
                <p>Create game nights and events from <strong>Community & Events</strong>. Events appear on the library calendar and can be listed in the <strong>public Events directory</strong> at <code>/events</code>. Members can RSVP and you can attach a game night poll.</p>
              </SectionCard>

              <SectionCard icon={Building2} title="Clubs">
                <p>Clubs connect multiple libraries into a shared ecosystem. Create from the Dashboard (requires platform approval), invite library owners via codes. Features include combined catalogs, shared events, and club-scoped forums.</p>
              </SectionCard>

              <SectionCard icon={MessageSquare} title="Forums">
                <p>Enable in <strong>Library Settings → Feature Flags</strong>. Create custom categories, pin threads, lock discussions. Moderators manage posts within library categories. Supports threaded replies.</p>
              </SectionCard>

              <SectionCard icon={Vote} title="Polls & Game Night Voting">
                <p>Create polls with games from your library as options. Set voting deadlines and share the link — no account required to vote. RSVP tracking can be combined with voting.</p>
              </SectionCard>

              <SectionCard icon={Users} title="Members & Roles">
                <p>Members can borrow, participate in challenges, and post in forums. Promote to <strong>Moderator</strong> for forum management. Manage in <strong>Library Settings → Members</strong>.</p>
              </SectionCard>
            </section>

            {/* ═══ CATALOG & DIRECTORY ═══ */}
            <section id="section-catalog" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Game Catalog & Directory
              </h2>

              <SectionCard icon={Globe} title="Global Game Catalog">
                <p>Browse thousands of board games at <code>/catalog</code>. Each catalog entry shows BGG data, mechanics, designers, community ratings, videos, and purchase links. The catalog is continuously enriched from BGG data.</p>
              </SectionCard>

              <SectionCard icon={Globe} title="Library Directory">
                <p>The <strong>Directory</strong> (<code>/directory</code>) lists all discoverable libraries. Find nearby game groups, browse their collections, and connect with fellow gamers. Toggle your library's discoverability in Library Settings.</p>
              </SectionCard>

              <SectionCard icon={Calendar} title="Public Events Directory">
                <p>The <strong>Events</strong> page (<code>/events</code>) shows all upcoming public game events across the platform. Anyone can browse and discover game nights near them.</p>
              </SectionCard>
            </section>

            {/* ═══ DISCORD ═══ */}
            <section id="section-discord" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> Discord Integration
              </h2>

              <SectionCard icon={Bell} title="Webhook Notifications">
                <p>Post events to a Discord channel: new games, wishlist votes, polls, and scheduled events.</p>
                <div className="space-y-2 pl-1 mt-2">
                  <Step n={1}>In Discord: <strong>Server Settings → Integrations → Webhooks</strong> → create webhook</Step>
                  <Step n={2}>Copy the webhook URL</Step>
                  <Step n={3}>Paste in <strong>Library Settings → Discord Settings</strong></Step>
                  <Step n={4}>Choose which events trigger notifications</Step>
                </div>
              </SectionCard>

              <SectionCard icon={Mail} title="Bot DM Notifications">
                <p>Private notifications (inquiries, loan requests) delivered as Discord DMs. Users must share a server with the bot and link their Discord account in <strong>Settings → Discord</strong>.</p>
              </SectionCard>

              <SectionCard icon={Calendar} title="Discord Events & Threads">
                <p>Game night events can auto-create Discord Scheduled Events and forum threads. Set the <strong>Discord Events Channel ID</strong> in your library Discord settings.</p>
              </SectionCard>
            </section>

            {/* ═══ ADVANCED ═══ */}
            <section id="section-advanced" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" /> Advanced Settings
              </h2>

              <SectionCard icon={Settings} title="Feature Flags">
                <p>Toggle individual features in <strong>Library Settings → Feature Flags</strong>: Play Logs, Ratings, Wishlist, For Sale, Messaging, Events, Achievements, Lending, Forum, and more. Disabled features are completely hidden.</p>
              </SectionCard>

              <SectionCard icon={RefreshCw} title="BGG Auto-Sync">
                <p>Link your BGG username in <strong>Library Settings → BGG Sync</strong> for automatic synchronization:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Frequency</strong> — daily or weekly</li>
                  <li><strong>Scope</strong> — collection, play history, and/or wishlist</li>
                  <li><strong>Removal behavior</strong> — flag removed games or auto-remove</li>
                </ul>
              </SectionCard>

              <SectionCard icon={Shield} title="Two-Factor Authentication">
                <p>Enable 2FA in <strong>Settings → Security</strong>. Uses TOTP compatible with Google Authenticator, Authy, 1Password, etc. Backup codes are generated on setup.</p>
              </SectionCard>

              <SectionCard icon={Globe} title="Custom Domain">
                <p>Point any domain to your library for a fully branded experience. Configure in <strong>Library Settings → Domain</strong>. SSL is handled automatically.</p>
              </SectionCard>

              <SectionCard icon={Shield} title="Cloudflare Turnstile">
                <p>Protect contact forms from spam bots with Cloudflare Turnstile. Configure a site key in <strong>Library Settings → General</strong>.</p>
              </SectionCard>

              <SectionCard icon={Palette} title="Custom Fonts & Social Links">
                <p>Choose display and body fonts from Google Fonts in <strong>Library Settings → Theme</strong>. Add Discord, Facebook, Instagram, and X links in <strong>Library Settings → General</strong>.</p>
              </SectionCard>

              <SectionCard icon={DollarSign} title="Collection Value Privacy">
                <p>Purchase prices and values are always hidden from visitors. Only you and library admins see financial data.</p>
              </SectionCard>

              {isAdmin && (
                <SectionCard icon={Shield} title="Platform Administration (Admin Only)">
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>User Management</strong> — view all users, assign roles, suspend accounts</li>
                    <li><strong>Library Management</strong> — oversee libraries, suspensions, premium</li>
                    <li><strong>Platform Settings</strong> — announcements, maintenance mode</li>
                    <li><strong>Analytics</strong> — platform-wide usage stats</li>
                    <li><strong>Catalog Scraper</strong> — manage BGG ingestion pipeline</li>
                  </ul>
                </SectionCard>
              )}
            </section>

            {/* ═══ FAQ ═══ */}
            <section id="section-faq" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" /> Frequently Asked Questions
              </h2>

              <Accordion type="multiple" className="space-y-2">
                {[
                  { q: "Is GameTaverns free to use?", a: "Yes — the core platform is free. Creating a library, adding games, tracking plays, and community features cost nothing. Advanced features may require a premium tier in the future." },
                  { q: "Do I need a BoardGameGeek account?", a: "No. BGG integration is optional. You can add games manually, search by name, or use CSV import. BGG sync and play import are available but never required." },
                  { q: "Can visitors browse my library without an account?", a: "Yes. Your library is publicly accessible by default. Visitors can browse, rate games, submit wishlists, and send inquiries without an account. Borrowing, forums, and polls require a GameTaverns account." },
                  { q: "How do I make my library private?", a: "Go to Library Settings → Visibility and set to Private. Only logged-in members can view it. You can also keep it unlisted from the directory while still accessible via direct URL." },
                  { q: "Can I have more than one library?", a: "Yes. Create multiple libraries from a single account — great for different game groups, a school library, or a board game café. Switch between them on the Dashboard." },
                  { q: "What's the difference between a Member and a Moderator?", a: "Members can borrow, participate in challenges, and post in forums. Moderators can additionally manage forum posts, pin/lock threads. Only owners and co-owners access library settings." },
                  { q: "How does trade matching work?", a: "List games you'd trade and games you want. The system compares your list against all discoverable libraries and surfaces mutual matches. Contact is made through secure messaging." },
                  { q: "Can I import play history from BGG?", a: "Yes. Go to Library Settings → BGG Sync, enter your BGG username, and click 'Import Play History.' The system matches plays to your library games and skips duplicates." },
                  { q: "Is my purchase price data visible to visitors?", a: "No. Purchase prices and collection values are always private — only you and library admins can see financial data." },
                  { q: "How do I set up Discord notifications?", a: "In Library Settings → Discord Settings, paste a Discord webhook URL. Choose which events trigger notifications. For private DMs, users link their Discord in personal settings." },
                  { q: "How do I delete a game?", a: "Open the game's detail page, click the ⋯ menu (top right), and select 'Remove from Library.' This removes it from your library but not the global catalog." },
                  { q: "What happens if I delete my library?", a: "Deleting a library permanently removes all games, play logs, loans, and settings. User accounts that were members are not affected. This cannot be undone." },
                  { q: "What is Collection DNA?", a: "Collection DNA analyzes your entire library to reveal your collector personality — favorite mechanics, theme affinities, complexity preferences, and rarity scores. You can share your DNA card on social media." },
                  { q: "How do I find libraries near me?", a: "Use the Directory at /directory to browse discoverable libraries. Libraries with location data can be found geographically." },
                ].map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>

          </div>
        </div>
      </main>

      <Footer />
      <MobileBottomTabs />
    </div>
  );
}
