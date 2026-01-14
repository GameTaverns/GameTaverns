import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Mail, MailOpen, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useMessages, useMarkMessageRead, useDeleteMessage, GameMessage } from "@/hooks/useMessages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ReplyDialog } from "@/components/messages/ReplyDialog";

const Messages = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, roleLoading, loading: authLoading } = useAuth();
  const { data: messages = [], isLoading } = useMessages();
  const markRead = useMarkMessageRead();
  const deleteMessage = useDeleteMessage();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState<GameMessage | null>(null);

  // While auth/role is resolving, show loading UI (prevents redirect flicker on first load)
  if (authLoading || roleLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // Redirect if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleMarkRead = async (id: string) => {
    try {
      await markRead.mutateAsync(id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage.mutateAsync(id);
      toast({ title: "Message deleted" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleExpand = (id: string, isRead: boolean) => {
    setExpandedId(expandedId === id ? null : id);
    if (!isRead) {
      handleMarkRead(id);
    }
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const unreadCount = messages.filter((m) => !m.is_read).length;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-6 -ml-2" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Messages</h1>
            <p className="text-muted-foreground mt-1">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
              {unreadCount > 0 && ` • ${unreadCount} unread`}
            </p>
          </div>
        </div>

        {messages.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">No messages yet</h3>
              <p className="text-muted-foreground">
                When visitors inquire about games you have for sale, their messages will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <Card
                key={message.id}
                className={`card-elevated transition-all cursor-pointer ${
                  !message.is_read ? "border-primary/50 bg-primary/5" : ""
                }`}
                onClick={() => toggleExpand(message.id, message.is_read)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {message.is_read ? (
                        <MailOpen className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <CardTitle className="font-display text-base truncate">
                          {message.sender_name}
                        </CardTitle>
                        <CardDescription className="truncate">{message.sender_email}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!message.is_read && (
                        <Badge variant="default" className="text-xs">New</Badge>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {message.game && (
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        Re: {message.game.title}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/game/${message.game?.slug || message.game_id}`);
                        }}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  )}
                  
                  <p className={`text-sm text-muted-foreground ${expandedId === message.id ? "" : "line-clamp-2"}`}>
                    {message.message}
                  </p>

                  {expandedId === message.id && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyMessage(message);
                        }}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Reply via Email
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete message?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. The message from {message.sender_name} will be permanently deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(message.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <ReplyDialog
          open={!!replyMessage}
          onOpenChange={(open) => !open && setReplyMessage(null)}
          recipientName={replyMessage?.sender_name || ""}
          recipientEmail={replyMessage?.sender_email || ""}
          gameTitle={replyMessage?.game?.title}
        />
      </div>
    </Layout>
  );
};

export default Messages;
