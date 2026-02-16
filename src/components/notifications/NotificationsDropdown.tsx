import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, BookOpen, Trophy, Calendar, MessageSquare, Heart, Mail } from "lucide-react";
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
import { cn } from "@/lib/utils";

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  loan_request: <BookOpen className="h-4 w-4 text-blue-500" />,
  loan_approved: <Check className="h-4 w-4 text-green-500" />,
  loan_returned: <BookOpen className="h-4 w-4 text-purple-500" />,
  loan_rejected: <BookOpen className="h-4 w-4 text-destructive" />,
  achievement_earned: <Trophy className="h-4 w-4 text-yellow-500" />,
  event_reminder: <Calendar className="h-4 w-4 text-orange-500" />,
  message_received: <Mail className="h-4 w-4 text-indigo-500" />,
  wishlist_alert: <Heart className="h-4 w-4 text-pink-500" />,
  forum_reply: <MessageSquare className="h-4 w-4 text-green-500" />,
};

// Get navigation path based on notification type and metadata
function getNotificationPath(notification: Notification): string | null {
  const metadata = notification.metadata as Record<string, unknown> | null;
  
  switch (notification.notification_type) {
    case "forum_reply":
      if (metadata?.thread_id) {
        return `/community/thread/${metadata.thread_id}`;
      }
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
      return "/messages";
    case "wishlist_alert":
      if (metadata?.game_id) {
        return `/games/${metadata.game_id}`;
      }
      break;
  }
  return null;
}

function NotificationItem({ 
  notification, 
  onMarkRead,
  onNavigate,
}: { 
  notification: Notification; 
  onMarkRead: () => void;
  onNavigate: (path: string) => void;
}) {
  const icon = NOTIFICATION_ICONS[notification.notification_type] || <Bell className="h-4 w-4" />;
  const isUnread = !notification.read_at;
  const path = getNotificationPath(notification);

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
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  const totalUnread = unreadCount + unreadMessageCount;

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

        {/* Messages section if there are unread messages */}
        {unreadMessageCount > 0 && (
          <>
            <DropdownMenuItem
              className="flex items-start gap-3 p-3 cursor-pointer bg-accent/30"
              onClick={() => navigate("/dashboard")}
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
              />
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
