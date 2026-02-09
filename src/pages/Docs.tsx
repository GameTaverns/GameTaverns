import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  HandshakeIcon,
  Palette,
  Link as LinkIcon,
  Target,
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

export default function Docs() {
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const { data: library, isLoading: libraryLoading } = useMyLibrary();
  const navigate = useNavigate();

  // Gate: must be logged in and be admin or library owner
  useEffect(() => {
    if (!loading && !libraryLoading) {
      if (!isAuthenticated) {
        navigate("/login");
      } else if (!isAdmin && !library) {
        navigate("/dashboard");
      }
    }
  }, [loading, libraryLoading, isAuthenticated, isAdmin, library, navigate]);

  if (loading || libraryLoading) {
    return (
      <Layout>
        <div className="container max-w-4xl py-12 text-center text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  if (!isAuthenticated || (!isAdmin && !library)) {
    return null;
  }

  return (
    <Layout>
      <div className="container max-w-4xl py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Library Owner Guide</h1>
          <p className="text-muted-foreground mt-1">
            How to get the most out of your GameTaverns library
          </p>
        </div>

        <Tabs defaultValue="getting-started" className="w-full">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="getting-started" className="gap-1.5">
              <BookOpen className="h-4 w-4" /> Getting Started
            </TabsTrigger>
            <TabsTrigger value="discord" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Discord
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-1.5">
              <Gamepad2 className="h-4 w-4" /> Features
            </TabsTrigger>
            <TabsTrigger value="community" className="gap-1.5">
              <Users className="h-4 w-4" /> Community
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1.5">
              <Settings className="h-4 w-4" /> Advanced
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
                  <p>From the Dashboard, click <strong>"Create Library"</strong>. Choose a name and a URL slug (e.g., <code>my-game-group</code>). Your library will be instantly available.</p>
                </Section>

                <Section title="2. Add Games">
                  <p>You have several ways to populate your collection:</p>
                  <div className="space-y-2 pl-4">
                    <Step n={1}><strong>Manual entry</strong> — Click "Add Game" and fill in the details.</Step>
                    <Step n={2}><strong>BGG Import</strong> — Enter a BoardGameGeek username to bulk-import your entire collection with images, descriptions, and metadata.</Step>
                    <Step n={3}><strong>CSV Import</strong> — Upload a spreadsheet for large batch imports.</Step>
                    <Step n={4}><strong>URL Import</strong> — Paste a BGG game URL to import a single game with all details pre-filled.</Step>
                  </div>
                </Section>

                <Section title="3. Customize Your Theme">
                  <p>Go to <strong>Library Settings → Theme</strong> to customize colors, fonts, and branding. You can set separate light/dark mode themes, upload a logo, and add a background image.</p>
                </Section>

                <Section title="4. Invite Members">
                  <p>Share your library URL with friends. They can create accounts and join your library as members, which enables borrowing, challenge participation, and community features.</p>
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
                  <p className="mt-2">To enable this, set the <strong>Discord Events Channel ID</strong> in your library Discord settings. The bot will use your webhook to discover the Guild ID automatically.</p>
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
                  <p>Visitors can rate games on a 5-star scale. Ratings are anonymous — each visitor gets one vote per game, tracked by a device fingerprint. View aggregate ratings in <strong>Library Settings → Ratings</strong>.</p>
                </Section>

                <Section title="❤️ Wishlist">
                  <p>Visitors can "wish" for games they'd like to see added. View wishlist votes and voter names in <strong>Library Settings → Wishlist</strong>. Use this to gauge demand before purchasing.</p>
                </Section>

                <Section title="🎲 Play Logging">
                  <p>Log game sessions with players, scores, winners, and duration. Data feeds into the <strong>Play Stats</strong> page with charts, win rates, and an H-index. You can also <strong>import play history from BGG</strong>.</p>
                </Section>

                <Section title="📅 Events & Game Nights">
                  <p>Create events from the Dashboard. Events appear on the library calendar and can be linked to Discord. Polls let members vote on which games to play.</p>
                </Section>

                <Section title="📚 Game Lending">
                  <p>Enable lending in <strong>Library Settings → Feature Flags</strong>. Members can request to borrow games, and you approve/deny from the Dashboard. Track loan status, due dates, and borrower ratings.</p>
                </Section>

                <Section title="🏆 Achievements">
                  <p>Automatic achievement badges unlock as users hit milestones — play counts, unique games, win streaks, and more. Members can feature their favorite badge on their profile.</p>
                </Section>

                <Section title="📊 Analytics">
                  <p>The Library Analytics dashboard shows play trends, most-played games, active players, and growth over time. Available on the <strong>Dashboard → Library</strong> tab.</p>
                </Section>

                <Section title="💬 Game Inquiries">
                  <p>When messaging is enabled, visitors can contact you about specific games (e.g., to ask about condition or negotiate a sale). Messages are encrypted and visible in <strong>Dashboard → Library → Messages</strong>.</p>
                </Section>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    Self-Hosted Exclusive Features
                    <Badge variant="secondary" className="text-xs">Self-Hosted</Badge>
                  </h3>

                  <div className="space-y-6">
                    <Section title="💰 Collection Value Tracking">
                      <p>Track purchase prices and current market values for every game. The system can pull BGG marketplace prices as a reference. View total invested vs. current value, gains/losses per game, on the <strong>Dashboard → Library</strong> tab.</p>
                    </Section>

                    <Section title="🎯 Group Challenges">
                      <p>Create competitive challenges for your library members:</p>
                      <ul className="list-disc pl-6 space-y-1">
                        <li><strong>Play Count Goals</strong> — everyone tries to hit X total plays</li>
                        <li><strong>Unique Games</strong> — play as many different games as possible</li>
                        <li><strong>Specific Game</strong> — who can play a specific game the most</li>
                        <li><strong>Competitive</strong> — most plays or most unique games wins</li>
                      </ul>
                      <p className="mt-2">Create from <strong>Dashboard → Library</strong> tab. Challenges have start/end dates, leaderboards, and progress tracking.</p>
                    </Section>

                    <Section title="🔄 Cross-Library Trade Matching">
                      <p>List games you're willing to trade and games you want. The system matches your offers against other discoverable libraries using BGG IDs. Find matches on the <strong>Dashboard → Trades</strong> tab.</p>
                    </Section>
                  </div>
                </div>
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
                <CardDescription>Managing members, forums, and engagement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Members & Roles">
                  <p>Members who join your library get access to borrowing, challenges, and forums. You can promote members to <strong>Moderator</strong> to help manage content. Manage members in <strong>Library Settings → Members</strong>.</p>
                </Section>

                <Section title="Community Forum">
                  <p>Enable the forum in <strong>Library Settings → Feature Flags</strong>. You can create custom categories, pin important threads, and lock discussions. Moderators can manage posts within your library's categories.</p>
                </Section>

                <Section title="Notifications">
                  <p>Members receive real-time notifications for:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Replies to their forum threads</li>
                    <li>Lending activity (request approved, game due, etc.)</li>
                    <li>Achievement unlocks</li>
                  </ul>
                  <p className="mt-2">Notifications appear via the bell icon in the header and can optionally be delivered as Discord DMs.</p>
                </Section>

                <Section title="Making Your Library Discoverable">
                  <p>Toggle <strong>"Discoverable"</strong> in Library Settings to appear in the public library directory. This lets other users find and join your community, and enables cross-library trade matching.</p>
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
                <CardDescription>Power-user settings and customization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Section title="Feature Flags">
                  <p>Toggle individual features on/off in <strong>Library Settings → Feature Flags</strong>:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Play Logs, Ratings, Wishlist, For Sale, Coming Soon</li>
                    <li>Messaging, Events, Achievements, Lending</li>
                    <li>Community Forum</li>
                  </ul>
                  <p className="mt-2">Disabled features are completely hidden from visitors.</p>
                </Section>

                <Section title="Cloudflare Turnstile (Anti-Spam)">
                  <p>To protect contact forms from spam, configure a Cloudflare Turnstile site key in <strong>Library Settings → General</strong>. When set, visitors must pass a CAPTCHA challenge before submitting inquiries.</p>
                </Section>

                <Section title="Custom Theme Fonts">
                  <p>Choose from available display and body fonts in <strong>Library Settings → Theme</strong>. Fonts are loaded from Google Fonts automatically. The display font is used for headings, the body font for all other text.</p>
                </Section>

                <Section title="Social Links">
                  <p>Add links to your Discord server, Facebook group, Instagram, and Twitter in <strong>Library Settings → General</strong>. These appear in your library's footer.</p>
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
                      </ul>
                      <p className="mt-2">Access via <strong>Dashboard → Platform Admin</strong>.</p>
                    </Section>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
