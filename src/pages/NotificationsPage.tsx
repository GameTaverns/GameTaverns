import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Check, CheckCheck, BookOpen, Trophy, Calendar,
  MessageSquare, Heart, Mail, UserPlus, UserCheck,
  ArrowLeftRight, Filter, ArrowLeft, Trash2
} from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { useUserProfile } from "@/hooks/useLibrary";
import { cn } from "@/lib/utils";

// ── Category mapping ──
type NotifCategory = "all" | "activity" | "social" | "lending" | "system";

const CATEGORY_MAP: Record<string, NotifCategory> = {
  achievement_earned: "activity",
  session_tag: "activity",
  activity_reaction: "social",
  forum_reply: "social",
  new_follower: "social",
  direct_message: "social",
  loan_request: "lending",
  loan_approved: "lending",
  loan_returned: "lending",
  loan_declined: "lending",
  loan_rejected: "lending",
  trade_offer_received: "lending",
  trade_offer_accepted: "lending",
  trade_offer_declined: "lending",
  trade_match_found: "lending",
  event_reminder: "system",
  message_received: "system",
  wishlist_alert: "activity",
  referral_signup: "social",
};

function getCategory(type: string): NotifCategory {
  return CATEGORY_MAP[type] || "system";
}

// ── Icons ──
const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  loan_request: <BookOpen className="h-4 w-4 text-blue-500" />,
  loan_approved: <Check className="h-4 w-4 text-green-500" />,
  loan_returned: <BookOpen className="h-4 w-4 text-purple-500" />,
  loan_rejected: <BookOpen className="h-4 w-4 text-destructive" />,
  loan_declined: <BookOpen className="h-4 w-4 text-destructive" />,
  achievement_earned: <Trophy className="h-4 w-4 text-secondary" />,
  event_reminder: <Calendar className="h-4 w-4 text-primary" />,
  message_received: <Mail className="h-4 w-4 text-indigo-500" />,
  wishlist_alert: <Heart className="h-4 w-4 text-primary" />,
  forum_reply: <MessageSquare className="h-4 w-4 text-green-500" />,
  new_follower: <UserPlus className="h-4 w-4 text-secondary" />,
  direct_message: <MessageSquare className="h-4 w-4 text-indigo-500" />,
  session_tag: <UserCheck className="h-4 w-4 text-primary" />,
  activity_reaction: <Heart className="h-4 w-4 text-pink-500" />,
  trade_offer_received: <ArrowLeftRight className="h-4 w-4 text-secondary" />,
  trade_offer_accepted: <Check className="h-4 w-4 text-green-500" />,
  trade_offer_declined: <ArrowLeftRight className="h-4 w-4 text-destructive" />,
  trade_match_found: <ArrowLeftRight className="h-4 w-4 text-primary" />,
  referral_signup: <UserPlus className="h-4 w-4 text-secondary" />,
};

// ── Navigation helper ──
function getNotificationPath(notification: Notification, myUsername?: string | null): string | null {
  const metadata = notification.metadata as Record<string, unknown> | null;
  switch (notification.notification_type) {
    case "forum_reply":
      if (metadata?.thread_id) return `/community/thread/${metadata.thread_id}`;
      break;
    case "loan_request":
    case "loan_approved":
    case "loan_rejected":
    case "loan_returned":
      return "/dashboard";
    case "achievement_earned":
      return "/achievements";
    case "new_follower":
      if (metadata?.username) return `/u/${metadata.username}`;
      return "/dashboard";
    case "direct_message":
      if (metadata?.sender_id) return `/dm/${metadata.sender_id}`;
      return "/dm";
    case "activity_reaction":
      if (myUsername) return `/u/${myUsername}`;
      return "/dashboard";
    case "trade_offer_received":
    case "trade_offer_accepted":
    case "trade_offer_declined":
    case "trade_match_found":
      return "/dashboard?tab=community";
  }
  return null;
}

// ── Group notifications by date ──
interface NotifGroup {
  label: string;
  notifications: Notification[];
}

function groupByDate(notifications: Notification[]): NotifGroup[] {
  const groups: { label: string; items: Notification[] }[] = [];
  const buckets: Record<string, Notification[]> = {};

  for (const n of notifications) {
    const d = new Date(n.sent_at);
    let label: string;
    if (isToday(d)) label = "Today";
    else if (isYesterday(d)) label = "Yesterday";
    else if (isThisWeek(d)) label = "This Week";
    else label = "Earlier";

    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(n);
  }

  const order = ["Today", "Yesterday", "This Week", "Earlier"];
  for (const label of order) {
    if (buckets[label]?.length) {
      groups.push({ label, items: buckets[label] });
    }
  }

  return groups.map(g => ({ label: g.label, notifications: g.items }));
}

// ── Group similar notifications ──
// e.g. "3 people liked your activity" instead of 3 separate items
function groupSimilar(notifications: Notification[]): (Notification | { grouped: true; type: string; count: number; latest: Notification; ids: string[] })[] {
  const result: any[] = [];
  const typeGroups: Record<string, Notification[]> = {};

  // Group consecutive same-type unread notifications
  for (const n of notifications) {
    const key = n.notification_type;
    if (!typeGroups[key]) typeGroups[key] = [];
    typeGroups[key].push(n);
  }

  // For types with 3+ items, group them; otherwise keep individual
  const GROUPABLE_TYPES = ["activity_reaction", "new_follower", "achievement_earned"];
  const grouped = new Set<string>();
  for (const [type, items] of Object.entries(typeGroups)) {
    if (items.length >= 3 && GROUPABLE_TYPES.includes(type)) {
      result.push({
        grouped: true,
        type,
        count: items.length,
        latest: items[0],
        ids: items.map(i => i.id),
      });
      items.forEach(i => grouped.add(i.id));
    }
  }

  // Add non-grouped individually, preserving order
  for (const n of notifications) {
    if (!grouped.has(n.id)) {
      result.push(n);
    }
  }

  return result;
}

// ── Main component ──
export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications: allNotifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const { data: myProfile } = useUserProfile();
  const [filter, setFilter] = useState<NotifCategory>("all");

  // Exclude direct messages — they have their own dedicated messenger section
  const MESSAGE_TYPES = ["direct_message", "message_received"];
  const notifications = useMemo(() => allNotifications.filter(n => !MESSAGE_TYPES.includes(n.notification_type)), [allNotifications]);

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter(n => getCategory(n.notification_type) === filter);
  }, [notifications, filter]);

  const dateGroups = useMemo(() => groupByDate(filtered), [filtered]);

  const categoryUnread = useMemo(() => {
    const counts: Record<NotifCategory, number> = { all: 0, activity: 0, social: 0, lending: 0, system: 0 };
    for (const n of notifications) {
      if (!n.read_at) {
        counts.all++;
        counts[getCategory(n.notification_type)]++;
      }
    }
    return counts;
  }, [notifications]);

  const handleClick = (n: Notification) => {
    if (!n.read_at) markAsRead.mutate(n.id);
    const path = getNotificationPath(n, myProfile?.username);
    if (path) navigate(path);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-cream hover:text-white gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <h1 className="font-display text-xl font-bold text-cream flex items-center gap-2">
              <Bell className="h-5 w-5 text-secondary" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
              )}
            </h1>
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => markAllAsRead.mutate()}
              className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5 text-xs"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>

        {/* Category filters */}
        <Tabs value={filter} onValueChange={v => setFilter(v as NotifCategory)} className="mb-6">
          <TabsList className="bg-wood-dark/60 border border-wood-medium/40 h-auto flex-wrap gap-1 p-1">
            {(["all", "activity", "social", "lending", "system"] as NotifCategory[]).map(cat => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40 capitalize"
              >
                {cat}
                {categoryUnread[cat] > 0 && (
                  <Badge variant="destructive" className="text-[10px] ml-1 px-1 h-4 min-w-[16px]">
                    {categoryUnread[cat]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Notification list */}
        {isLoading ? (
          <div className="text-center py-12 text-cream/50">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-cream/20 mb-4" />
              <p className="text-cream/50">
                {filter === "all" ? "No notifications yet" : `No ${filter} notifications`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {dateGroups.map(group => {
              const items = groupSimilar(group.notifications);
              return (
                <div key={group.label}>
                  <h3 className="text-xs font-semibold text-cream/50 uppercase tracking-wider mb-2 px-1">
                    {group.label}
                  </h3>
                  <div className="space-y-1">
                    {items.map((item: any) => {
                      if (item.grouped) {
                        // Grouped notification
                        const icon = NOTIFICATION_ICONS[item.type] || <Bell className="h-4 w-4" />;
                        const labels: Record<string, string> = {
                          activity_reaction: "people liked your activity",
                          new_follower: "new followers",
                          achievement_earned: "achievements unlocked",
                        };
                        return (
                          <div
                            key={`grouped-${item.type}`}
                            className="flex items-start gap-3 p-3 rounded-lg bg-wood-medium/20 hover:bg-wood-medium/30 cursor-pointer transition-colors"
                            onClick={() => handleClick(item.latest)}
                          >
                            <div className="flex-shrink-0 mt-0.5">{icon}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-cream">
                                {item.count} {labels[item.type] || "notifications"}
                              </p>
                              <p className="text-xs text-cream/50 mt-0.5">
                                {formatDistanceToNow(new Date(item.latest.sent_at), { addSuffix: true })}
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">{item.count}</Badge>
                          </div>
                        );
                      }

                      // Individual notification
                      const n = item as Notification;
                      const icon = NOTIFICATION_ICONS[n.notification_type] || <Bell className="h-4 w-4" />;
                      const isUnread = !n.read_at;

                      return (
                        <div
                          key={n.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                            isUnread
                              ? "bg-secondary/10 hover:bg-secondary/15 border border-secondary/20"
                              : "bg-wood-medium/10 hover:bg-wood-medium/20"
                          )}
                          onClick={() => handleClick(n)}
                        >
                          <div className="flex-shrink-0 mt-0.5">{icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm text-cream", isUnread && "font-medium")}>
                              {n.title}
                            </p>
                            {n.body && (
                              <p className="text-xs text-cream/50 line-clamp-2 mt-0.5">{n.body}</p>
                            )}
                            <p className="text-xs text-cream/40 mt-1">
                              {formatDistanceToNow(new Date(n.sent_at), { addSuffix: true })}
                            </p>
                          </div>
                          {isUnread && (
                            <div className="flex-shrink-0 mt-1.5">
                              <div className="h-2 w-2 rounded-full bg-secondary" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
