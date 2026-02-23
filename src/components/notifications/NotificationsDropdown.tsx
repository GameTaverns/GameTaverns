import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, BookOpen, Trophy, Calendar, MessageSquare, Heart, Mail, UserPlus, UserCheck, ArrowLeftRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { useUserProfile } from "@/hooks/useLibrary";
import { useSessionTagRequests } from "@/hooks/usePlayerElo";
import { SessionTagNotifications } from "@/components/games/SessionTagNotifications";
import { cn } from "@/lib/utils";

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  loan_request: <BookOpen className="h-4 w-4 text-blue-500" />,
  loan_approved: <Check className="h-4 w-4 text-green-500" />,
  loan_returned: <BookOpen className="h-4 w-4 text-purple-500" />,
  loan_rejected: <BookOpen className="h-4 w-4 text-destructive" />,
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
};

// Get navigation path based on notification type and metadata
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
    case "event_reminder":
      return "/dashboard";
    case "message_received":
      return "/dm";
    case "new_follower":
      if (metadata?.username) return `/u/${metadata.username}`;
      return "/dashboard";
    case "direct_message":
      if (metadata?.sender_id) return `/dm/${metadata.sender_id}`;
      return "/dm";
    case "activity_reaction":
      // Go to the current user's own profile where their activity is shown
      if (myUsername) return `/u/${myUsername}`;
      return "/dashboard";
    case "wishlist_alert":
      if (metadata?.game_id) return `/games/${metadata.game_id}`;
      break;
    case "trade_offer_received":
    case "trade_offer_accepted":
    case "trade_offer_declined":
    case "trade_match_found":
      return "/dashboard?tab=community";
  }
  return null;
}

function NotificationItem({ 
  notification, 
  onMarkRead,
  onNavigate,
  myUsername,
}: { 
  notification: Notification; 
  onMarkRead: () => void;
  onNavigate: (path: string) => void;
  myUsername?: string | null;
}) {
  const icon = NOTIFICATION_ICONS[notification.notification_type] || <Bell className="h-4 w-4" />;
  const isUnread = !notification.read_at;
  const path = getNotificationPath(notification, myUsername);

  const handleClick = () => {
    onMarkRead();
    if (path) {
      onNavigate(path);
    }
  };

  return (
    <DropdownMenuItem
      className={cn(
        "flex items-start gap-3 p-3 cursor-pointer",
        isUnread && "bg-accent/50"
      )}
      onClick={handleClick}
    >
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", isUnread && "font-medium")}>{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-muted-foreground line-clamp-2">{notification.body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.sent_at), { addSuffix: true })}
        </p>
      </div>
      {isUnread && (
        <div className="flex-shrink-0 mt-1">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </DropdownMenuItem>
  );
}

interface NotificationsDropdownProps {
  variant?: "default" | "dashboard";
  /** @deprecated Messages now have their own header icon */
  unreadMessageCount?: number;
}

export function NotificationsDropdown({ variant = "default", unreadMessageCount = 0 }: NotificationsDropdownProps) {
  const navigate = useNavigate();
  const { notifications: allNotifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const { data: myProfile } = useUserProfile();
  const { data: tagRequests = [] } = useSessionTagRequests();

  // Direct messages have their own badge on the messenger icon — exclude from this pane
  const notifications = allNotifications.filter(n => n.notification_type !== "direct_message");

  const totalUnread = unreadCount + unreadMessageCount + tagRequests.length;

  const handleMarkRead = (notificationId: string) => {
    markAsRead.mutate(notificationId);
  };
  
  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative",
            variant === "dashboard" && "text-cream hover:text-white hover:bg-wood-medium/50"
          )}
        >
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {totalUnread > 9 ? "9+" : totalUnread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Inbox</span>
          <div className="flex items-center gap-2">
            {unreadMessageCount > 0 && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Mail className="h-3 w-3" /> {unreadMessageCount}
              </Badge>
            )}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs"
                onClick={() => markAllAsRead.mutate()}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Session tag requests */}
        {tagRequests.length > 0 && (
          <>
            <div className="px-3 py-2">
              <SessionTagNotifications />
            </div>
            {(unreadMessageCount > 0 || notifications.length > 0) && <DropdownMenuSeparator />}
          </>
        )}

        {/* Messages section if there are unread messages */}
        {unreadMessageCount > 0 && (
          <>
            <DropdownMenuItem
              className="flex items-start gap-3 p-3 cursor-pointer bg-accent/30"
              onClick={() => navigate("/inbox")}
            >
              <div className="flex-shrink-0 mt-0.5"><Mail className="h-4 w-4 text-indigo-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Unread Messages</p>
                <p className="text-xs text-muted-foreground">{unreadMessageCount} new message{unreadMessageCount > 1 ? 's' : ''} in your library inbox</p>
              </div>
              <div className="flex-shrink-0 mt-1">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
            </DropdownMenuItem>
            {notifications.length > 0 && <DropdownMenuSeparator />}
          </>
        )}

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : notifications.length === 0 && unreadMessageCount === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={() => handleMarkRead(notification.id)}
                onNavigate={handleNavigate}
                myUsername={myProfile?.username}
              />
            ))
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-center justify-center text-xs text-muted-foreground hover:text-foreground cursor-pointer py-2"
          onClick={() => navigate("/notifications")}
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
