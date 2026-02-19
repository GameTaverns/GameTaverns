import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import {
  BookOpen,
  Bell,
  MessageSquare,
  Trophy,
  ArrowLeftRight,
  DollarSign,
  Users,
  Gamepad2,
  Star,
  Heart,
  BarChart3,
  Shield,
  Settings,
  Calendar,
  Palette,
  UserCircle,
  List,
  Mail,
  Server,
  HelpCircle,
  Target,
  RefreshCw,
  Copy,
  Vote,
  MessageCircle,
  Building2,
  Shuffle,
  Download,
  Sparkles,
} from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
        {n}
      </span>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/40 pb-4">
      <p className="font-medium text-sm text-foreground mb-1">{q}</p>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

export default function Docs() {
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const { data: library, isLoading: libraryLoading } = useMyLibrary();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !libraryLoading) {
      if (!isAuthenticated) navigate("/login");
      else if (!isAdmin && !library) navigate("/dashboard");
    }
  }, [loading, libraryLoading, isAuthenticated, isAdmin, library, navigate]);

  if (loading || libraryLoading) {
    return (
      <Layout hideSidebar>
        <div className="container max-w-4xl py-12 text-center text-muted-foreground">Loading…</div>
      </Layout>
    );
  }

  if (!isAuthenticated || (!isAdmin && !library)) return null;

  return (
    <Layout hideSidebar>
      <div className="container max-w-4xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Library Owner Guide</h1>
            <p className="text-muted-foreground mt-1">
              How to get the most out of your GameTaverns library
            </p>
          </div>
          <a
            href="/dashboard#overview"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            ← Back to Dashboard
          </a>
        </div>

        <Tabs defaultValue="getting-started" className="w-full">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="getting-started" className="gap-1.5">
              <BookOpen className="h-4 w-4" /> Getting Started
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-1.5">
              <Gamepad2 className="h-4 w-4" /> Features
            </TabsTrigger>
            <TabsTrigger value="play-tracking" className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> Play Tracking
            </TabsTrigger>
            <TabsTrigger value="social" className="gap-1.5">
              <UserCircle className="h-4 w-4" /> Social
            </TabsTrigger>
            <TabsTrigger value="discord" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Discord
            </TabsTrigger>
            <TabsTrigger value="community" className="gap-1.5">
              <Users className="h-4 w-4" /> Community
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1.5">
              <Settings className="h-4 w-4" /> Advanced
            </TabsTrigger>
            <TabsTrigger value="faq" className="gap-1.5">
              <HelpCircle className="h-4 w-4" /> FAQ
            </TabsTrigger>
          </TabsList>

          {/* ===== GETTING STARTED ===== */}
          <TabsContent value="getting-started" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" /> Setting Up Your Library
                </CardTitle>
                <CardDescription>The essentials to get your library running</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="1. Create Your Library">
                  <p>From the Dashboard, click <strong>"Create Library"</strong>. Choose a name and a URL slug (e.g., <code>my-game-group</code>). Your library will be instantly available at <code>[slug].gametaverns.app</code>.</p>
                </Section>

                <Section title="2. Add Games">
                  <p>You have several ways to populate your collection:</p>
                  <div className="space-y-2 pl-4">
                    <Step n={1}><strong>Search by name or BGG URL</strong> — type a game name or paste a BoardGameGeek URL to import with full metadata.</Step>
                    <Step n={2}><strong>BGG Collection Import</strong> — enter your BGG username to bulk-import your entire collection at once.</Step>
                    <Step n={3}><strong>CSV Import</strong> — upload a spreadsheet for large batch imports.</Step>
                    <Step n={4}><strong>Manual entry</strong> — click "Add Game" and fill in details by hand for games not on BGG.</Step>
                  </div>
                </Section>

                <Section title="3. Customize Your Theme">
                  <p>Go to <strong>Library Settings → Theme</strong> to customize colors, fonts, logo, and background image. You can configure separate looks for light and dark mode. Changes apply instantly with a live preview.</p>
                </Section>

                <Section title="4. Configure Feature Flags">
                  <p>In <strong>Library Settings → Feature Flags</strong>, toggle which features are visible to your visitors. Start minimal and enable more as your community grows. All disabled features are completely hidden from the public view.</p>
                </Section>

                <Section title="5. Invite Members">
                  <p>Share your library URL with friends. They create a GameTaverns account and can join your library as members, which unlocks borrowing, challenges, and community features. You can assign roles (Member, Moderator) in <strong>Library Settings → Members</strong>.</p>
                </Section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== FEATURES ===== */}
          <TabsContent value="features" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" /> Feature Guide
                </CardTitle>
                <CardDescription>What each feature does and how to use it</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <Section title="⭐ Game Ratings">
                  <p>Visitors can rate games on a 5-star scale. Ratings are anonymous — each visitor gets one vote per game, tracked by device fingerprint. View aggregate ratings per game on its detail page and in <strong>Library Settings → Ratings</strong>.</p>
                </Section>

                <Section title="❤️ Wishlist">
                  <p>Visitors can "wish" for games they'd like to see added. No account required. View wishlist votes and voter names in <strong>Library Settings → Wishlist</strong>. Sort your library by wishlist demand to prioritize purchases.</p>
                </Section>

                <Section title="📅 Events & Game Nights">
                  <p>Create events from the <strong>Dashboard → Events</strong> tab. Events appear on your library's calendar and can automatically create Discord Scheduled Events. Members can RSVP and you can attach a game night poll.</p>
                </Section>

                <Section title="📚 Game Lending">
                  <p>Enable in <strong>Library Settings → Feature Flags</strong>. Members can request to borrow games, and you approve or deny requests from the Dashboard. After return, borrowers can be rated. Supports multi-copy assignment — assign a specific copy to each loan.</p>
                </Section>

                <Section title="💰 Collection Value Tracking">
                  <p>Track purchase prices, dates, and current estimated values per game. The system can pull BGG marketplace prices as a reference point. View your total invested vs. current value on the <strong>Dashboard → Library</strong> tab under the Analytics section.</p>
                </Section>

                <Section title="🎯 Group Challenges">
                  <p>Create competitive play challenges for your library members. Configure from <strong>Dashboard → Library</strong>:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>Play Count Goals</strong> — everyone tries to hit X total plays</li>
                    <li><strong>Unique Games</strong> — play as many different games as possible</li>
                    <li><strong>Specific Game</strong> — who can log the most plays of one game</li>
                    <li><strong>Competitive</strong> — leaderboard race for most plays or most unique games</li>
                  </ul>
                  <p className="mt-2">Challenges have start/end dates, leaderboards, and real-time progress tracking.</p>
                </Section>

                <Section title="🔄 Cross-Library Trade Matching">
                  <p>List games you'd trade and games you want on the <strong>Dashboard → Trades</strong> tab. The system automatically matches your offers against other discoverable libraries using BGG IDs. Contact traders directly through the messaging system.</p>
                </Section>

                <Section title="🔁 BGG Auto-Sync">
                  <p>Link your BGG username in <strong>Library Settings → BGG Sync</strong> to keep your collection in sync automatically:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>Frequency</strong> — daily or weekly sync</li>
                    <li><strong>Scope</strong> — sync collection, play history, and/or wishlist</li>
                    <li><strong>Removal behavior</strong> — flag removed games as missing, or auto-remove</li>
                    <li>Sync status and last-run time visible in settings</li>
                  </ul>
                </Section>

                <Section title="📦 Multi-Copy Inventory">
                  <p>For games you own multiple copies of, open the game's detail page and use the <strong>Copies</strong> section. Each copy gets a label, condition grade, and notes field. When approving a loan, assign a specific copy to that borrower.</p>
                </Section>

                <Section title="🏪 For Sale Marketplace">
                  <p>Mark any game as "For Sale" with a price and condition grade. Enable in <strong>Library Settings → Feature Flags</strong>. Interested visitors can send you a message through the integrated secure inquiry system — no email addresses exposed.</p>
                </Section>

                <Section title="📚 Curated Lists">
                  <p>Create hand-picked game lists from <strong>Dashboard → Lists</strong>. Lists can be public (community can vote on them) or private. Great for sharing recommendations like "best games for 2 players" or "gateway games for new players."</p>
                </Section>

                <Section title="🏛️ Clubs">
                  <p>Clubs connect multiple libraries into a shared ecosystem. Create from the Dashboard and invite library owners via invite codes. Club creation requires platform approval. Features include a combined catalog, shared events, and club-scoped forum categories.</p>
                </Section>

                <Section title="💬 Game Inquiries">
                  <p>When messaging is enabled, visitors can contact you about specific games without knowing your email. Messages are encrypted and visible in <strong>Dashboard → Library → Messages</strong>. You can reply directly from the dashboard.</p>
                </Section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== PLAY TRACKING ===== */}
          <TabsContent value="play-tracking" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" /> Play Tracking & Statistics
                </CardTitle>
                <CardDescription>Logging sessions, reading stats, and importing history</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <Section title="Logging a Play Session">
                  <p>Open any game in your library and click <strong>"Log Play"</strong>. You can record:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Date and duration</li>
                    <li>Players (by name or linked user accounts)</li>
                    <li>Scores, winners, and player colors</li>
                    <li>Session notes and location</li>
                    <li>Expansions used</li>
                  </ul>
                  <p className="mt-2">Logged plays immediately update your analytics and H-index.</p>
                </Section>

                <Section title="Understanding Your Stats">
                  <p>The <strong>Play Stats</strong> page (Dashboard → Play Stats) gives you a full picture of your gaming history:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>H-index</strong> — you have an H-index of N if you've played N games at least N times</li>
                    <li><strong>Monthly/Yearly summaries</strong> — total plays, unique games, and active players per period</li>
                    <li><strong>Most played games</strong> — ranked leaderboard of your top games</li>
                    <li><strong>Player stats</strong> — win rates, head-to-head records, favorite games per player</li>
                  </ul>
                </Section>

                <Section title="Importing from BGG">
                  <p>To import your existing play history from BoardGameGeek:</p>
                  <div className="space-y-2 pl-4">
                    <Step n={1}>Go to <strong>Library Settings → BGG Sync</strong> and enter your BGG username.</Step>
                    <Step n={2}>Click <strong>"Import Play History"</strong> to start the import.</Step>
                    <Step n={3}>The system will match BGG plays to games already in your library.</Step>
                    <Step n={4}>Duplicate plays are detected and skipped automatically using BGG play IDs.</Step>
                  </div>
                  <p className="mt-2">Only plays for games that exist in your library will be imported. Add missing games first.</p>
                </Section>

                <Section title="Achievements">
                  <p>Achievements unlock automatically as you hit milestones. View your badges on your <strong>User Profile</strong> page. You can feature one badge on your public profile. Achievement categories include play counts, variety (unique games), winning streaks, and secret achievements discoverable through play.</p>
                </Section>

                <Section title="AI Game Recommendations">
                  <p>On any game's detail page, scroll to the <strong>"You Might Also Like"</strong> section. The AI analyzes the game's mechanics, theme, and complexity to suggest similar games from within your library. Results are cached for 10 minutes and refresh when you revisit.</p>
                </Section>

                <Section title="Random Game Picker">
                  <p>Can't decide what to play? Use <strong>Dashboard → Smart Picker</strong> to get a random suggestion filtered by player count, play time, and whether the game has been played recently. Great for indecisive game nights.</p>
                </Section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== SOCIAL ===== */}
          <TabsContent value="social" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5" /> Social Features
                </CardTitle>
                <CardDescription>Profiles, following, and direct messaging</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <Section title="Your Public Profile">
                  <p>Every GameTaverns user has a public profile page at <code>/u/[username]</code>. Your profile shows:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Display name, avatar, and bio</li>
                    <li>Your featured achievement badge</li>
                    <li>Play history stats (total plays, unique games, H-index)</li>
                    <li>Libraries you own or are a member of</li>
                    <li>Followers and following counts</li>
                  </ul>
                  <p className="mt-2">Edit your profile in <strong>Dashboard → Settings → Profile</strong>. You can upload an avatar, set a bio, and choose which badge to feature.</p>
                </Section>

                <Section title="Following Other Users">
                  <p>Follow other players to build your network and discover their libraries. To follow someone:</p>
                  <div className="space-y-2 pl-4">
                    <Step n={1}>Visit their profile at <code>/u/[username]</code>.</Step>
                    <Step n={2}>Click the <strong>"Follow"</strong> button.</Step>
                    <Step n={3}>You'll now see them in your follower list and they'll appear in the "Discover Users" widget on your Dashboard.</Step>
                  </div>
                  <p className="mt-2">You can also find users through the <strong>Discover Users</strong> widget on the Dashboard, which suggests people you might know based on mutual libraries and activity.</p>
                </Section>

                <Section title="Direct Messages">
                  <p>Send private messages to any user with a GameTaverns account. Access your inbox via the <strong>envelope icon</strong> in the header or at <strong>Dashboard → Messages</strong>.</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Messages are delivered in real-time</li>
                    <li>Unread count shows in the header</li>
                    <li>You can delete a conversation from your side without affecting the other person</li>
                    <li>Great for coordinating trades, loan pickups, or game nights</li>
                  </ul>
                </Section>

                <Section title="Activity Feed">
                  <p>The Dashboard home tab shows a real-time activity feed of events across your libraries: play sessions logged, achievements unlocked, games added, polls created, and events scheduled. This keeps everyone in your community informed without needing Discord or a separate chat app.</p>
                </Section>

                <Section title="Notifications">
                  <p>Notifications appear via the <strong>bell icon</strong> in the header. You'll be notified for:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Replies to your forum posts</li>
                    <li>Loan requests, approvals, and due-date reminders</li>
                    <li>Achievement unlocks</li>
                    <li>New followers</li>
                    <li>Game inquiry responses</li>
                  </ul>
                  <p className="mt-2">Discord DM notifications are also available — link your Discord account in <strong>Settings → Discord</strong>.</p>
                </Section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== DISCORD ===== */}
          <TabsContent value="discord" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" /> Discord Integration
                </CardTitle>
                <CardDescription>Connect your library to Discord for automatic notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Webhook Notifications (Public Events)">
                  <p>Public library events are posted to a Discord channel via webhook. This includes:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>New games added to the collection</li>
                    <li>Wishlist votes and updates</li>
                    <li>Game night polls created or updated</li>
                    <li>New events scheduled</li>
                  </ul>
                  <div className="mt-3 space-y-2">
                    <Step n={1}>In Discord, go to <strong>Server Settings → Integrations → Webhooks</strong> and create a new webhook.</Step>
                    <Step n={2}>Copy the webhook URL.</Step>
                    <Step n={3}>In your library settings, go to <strong>Discord Settings</strong> and paste the webhook URL.</Step>
                    <Step n={4}>Choose which events should trigger notifications.</Step>
                  </div>
                </Section>

                <Section title="Bot DM Notifications (Private)">
                  <p>Private notifications (game inquiries, lending requests) are delivered as direct messages via the platform bot. Users must:</p>
                  <div className="mt-3 space-y-2">
                    <Step n={1}>Share at least one server with the GameTaverns bot.</Step>
                    <Step n={2}>Link their Discord account via <strong>Dashboard → Settings → Discord</strong>.</Step>
                    <Step n={3}>Once linked, they'll receive DMs for inquiries and loan activity on their games.</Step>
                  </div>
                </Section>

                <Section title="Discord Events & Forum Threads">
                  <p>When you create a game night event, the system can automatically:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Create a <strong>Discord Scheduled Event</strong> in your server</li>
                    <li>Post a <strong>forum thread</strong> for discussion (if you have a forum channel configured)</li>
                  </ul>
                  <p className="mt-2">To enable this, set the <strong>Discord Events Channel ID</strong> in your library Discord settings. The bot uses your webhook to discover the Guild ID automatically.</p>
                </Section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== COMMUNITY ===== */}
          <TabsContent value="community" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> Community Management
                </CardTitle>
                <CardDescription>Managing members, forums, polls, and engagement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Members & Roles">
                  <p>Members who join your library gain access to borrowing, challenges, and forums. Promote members to <strong>Moderator</strong> to help manage forum content. Manage members in <strong>Library Settings → Members</strong>.</p>
                </Section>

                <Section title="Community Forum">
                  <p>Enable in <strong>Library Settings → Feature Flags</strong>. You can create custom categories, pin important threads, and lock discussions. Moderators can manage posts within your library's categories. Each thread supports threaded replies.</p>
                </Section>

                <Section title="Polls & Game Night Voting">
                  <p>Create polls from <strong>Dashboard → Polls</strong>. Select games from your library as options, set a voting deadline, and share the poll link. The link works for anyone — no account required to vote. RSVP tracking can be combined with voting so you know who's coming.</p>
                </Section>

                <Section title="Group Challenges">
                  <p>Create time-limited play challenges from <strong>Dashboard → Library</strong>. Members earn progress toward the challenge goal automatically as they log plays. Leaderboards update in real-time. Great for driving engagement and motivating game nights.</p>
                </Section>

                <Section title="Making Your Library Discoverable">
                  <p>Toggle <strong>"Discoverable"</strong> in Library Settings to appear in the public library directory. This enables cross-library trade matching, club discovery, and lets other users find and join your community.</p>
                </Section>

                <Section title="Clubs">
                  <p>Clubs connect multiple library owners into a shared space with a combined catalog, shared events, and club-only forum categories. Request a club from the Dashboard — new clubs require platform approval. Once approved, generate invite codes for other library owners to join.</p>
                </Section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== ADVANCED ===== */}
          <TabsContent value="advanced" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" /> Advanced Configuration
                </CardTitle>
                <CardDescription>Power-user settings, customization, and self-hosting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Feature Flags">
                  <p>Toggle individual features on/off in <strong>Library Settings → Feature Flags</strong>:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Play Logs, Ratings, Wishlist, For Sale, Coming Soon flag</li>
                    <li>Messaging, Events, Achievements, Lending</li>
                    <li>Community Forum</li>
                  </ul>
                  <p className="mt-2">Disabled features are completely hidden from visitors — no broken links or empty pages.</p>
                </Section>

                <Section title="Cloudflare Turnstile (Anti-Spam)">
                  <p>Protect contact forms from spam bots. Configure a Cloudflare Turnstile site key in <strong>Library Settings → General</strong>. When set, visitors must pass a CAPTCHA challenge before submitting game inquiries.</p>
                </Section>

                <Section title="Custom Theme Fonts">
                  <p>Choose from available display and body fonts in <strong>Library Settings → Theme</strong>. Fonts load from Google Fonts automatically. The display font applies to headings, the body font to all other text.</p>
                </Section>

                <Section title="Social Links">
                  <p>Add links to your Discord server, Facebook group, Instagram, or Twitter/X in <strong>Library Settings → General</strong>. These appear in your library's public footer.</p>
                </Section>

                <Section title="Custom Domain">
                  <p>Point any domain or subdomain to your GameTaverns library for a fully branded experience. Configure in <strong>Library Settings → Domain</strong>. SSL is handled automatically. Your default <code>[slug].gametaverns.app</code> subdomain continues to work as an alias.</p>
                </Section>

                <Section title="Collection Value Privacy">
                  <p>Purchase prices and collection values are always hidden from public visitors — only you and library admins can see financial data. Toggle visibility further in <strong>Library Settings → Privacy</strong>.</p>
                </Section>

                <Section title="Two-Factor Authentication">
                  <p>Enable 2FA for your account in <strong>Dashboard → Settings → Security</strong>. Uses time-based one-time passwords (TOTP) compatible with Google Authenticator, Authy, 1Password, and any standard authenticator app. Backup codes are generated on setup for account recovery.</p>
                </Section>

                {isAdmin && (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Shield className="h-5 w-5" /> Admin-Only
                    </h3>
                    <Section title="Platform Administration">
                      <p>As a platform admin, you have access to:</p>
                      <ul className="list-disc pl-6 space-y-1">
                        <li><strong>User Management</strong> — view all users, assign roles, suspend accounts</li>
                        <li><strong>Library Management</strong> — oversee all libraries, manage suspensions and premium status</li>
                        <li><strong>Platform Settings</strong> — global announcements, maintenance mode</li>
                        <li><strong>Feedback</strong> — review user-submitted feedback</li>
                        <li><strong>Analytics</strong> — platform-wide usage statistics</li>
                        <li><strong>Catalog Scraper</strong> — manage the BGG catalog ingestion pipeline</li>
                      </ul>
                      <p className="mt-2">Access via <strong>Dashboard → Platform Admin</strong>.</p>
                    </Section>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== FAQ ===== */}
          <TabsContent value="faq" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" /> Frequently Asked Questions
                </CardTitle>
                <CardDescription>Quick answers to the most common questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FAQ q="Is GameTaverns free to use?">
                  Yes — the core platform is free. Creating a library, adding games, tracking plays, and using community features costs nothing. Advanced features or higher limits may require a premium tier in the future.
                </FAQ>

                <FAQ q="Do I need a BoardGameGeek account to use GameTaverns?">
                  No. BGG integration is optional. You can add games manually, import by name search, or use CSV import. BGG sync and play import are available if you have a BGG account but are never required.
                </FAQ>

                <FAQ q="Can visitors browse my library without an account?">
                  Yes. Your library is publicly accessible by default. Visitors can browse games, see ratings, submit wishlists, and send inquiries — all without creating an account. Borrowing, forum posting, and voting in polls require a GameTaverns account.
                </FAQ>

                <FAQ q="How do I make my library private?">
                  Go to <strong>Library Settings → Visibility</strong> and set your library to <strong>Private</strong>. Only logged-in members will be able to view it. You can also keep it unlisted from the directory while still accessible via direct URL.
                </FAQ>

                <FAQ q="What's the difference between a Member and a Moderator?">
                  Members can borrow games, participate in challenges, and post in forums. Moderators can additionally manage forum posts, pin/lock threads, and help with content in your library's categories. Only library owners and co-owners have access to library settings.
                </FAQ>

                <FAQ q="Can I have more than one library?">
                  Yes. You can create multiple libraries from a single account — useful for running different game groups, a school library, or a board game café. Switch between libraries on the Dashboard.
                </FAQ>

                <FAQ q="How does trade matching work?">
                  You list games you're willing to trade and games you want. The system automatically compares your list against all other discoverable libraries and surfaces mutual matches where another library has what you want and wants what you have. Contact is made through the secure messaging system.
                </FAQ>

                <FAQ q="Can I import my play history from BGG?">
                  Yes. Go to <strong>Library Settings → BGG Sync</strong>, enter your BGG username, and click "Import Play History." The system matches plays to games in your library and skips duplicates automatically using BGG play IDs.
                </FAQ>

                <FAQ q="Is my purchase price data visible to visitors?">
                  No. Purchase prices and collection values are always private — only you and library admins can see financial data. There is no way for a visitor or member to see what you paid for your games.
                </FAQ>

                <FAQ q="Can I host GameTaverns on my own server?">
                  Yes. GameTaverns is self-hostable using Docker Compose. The repository includes everything you need: the frontend, backend functions, a self-hosted database, and Nginx configuration. Full feature parity with the cloud version. See the deployment guide in the repository.
                </FAQ>

                <FAQ q="How do I set up Discord notifications?">
                  In <strong>Library Settings → Discord Settings</strong>, paste a Discord webhook URL. You can choose which events trigger a notification (new games, polls, events, etc.). For private DM notifications (loan alerts, inquiries), users link their Discord account in their personal settings.
                </FAQ>

                <FAQ q="How do I delete a game from my library?">
                  Open the game's detail page, click the <strong>⋯ menu</strong> (top right), and select <strong>"Remove from Library"</strong>. This removes the game from your library but does not delete it from the global catalog.
                </FAQ>

                <FAQ q="What happens to my data if I delete my library?">
                  Deleting a library removes all associated games, play logs, loans, and settings permanently. User accounts that were members are not affected — they keep their profiles and play history. This action cannot be undone.
                </FAQ>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
