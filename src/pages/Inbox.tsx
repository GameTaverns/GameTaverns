import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Mail, MailOpen, Trash2, ExternalLink, MessageSquare, ChevronDown, ChevronUp, User, Store, Reply, Send, Inbox as InboxIcon } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useMessages, useMarkMessageRead, useDeleteMessage } from "@/hooks/useMessages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { getPlatformUrl } from "@/hooks/useTenantUrl";
import { supabase } from "@/integrations/backend/client";
import { useQueryClient } from "@tanstack/react-query";
import { MyInquiriesSection } from "@/components/dashboard/MyInquiriesSection";
import { useMyLibraries } from "@/hooks/useLibrary";

const Inbox = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { data: myLibraries = [], isLoading: librariesLoading } = useMyLibraries();
  const queryClient = useQueryClient();

  // Use the first owned library for received messages
  const library = myLibraries[0] || null;
  const isOwner = !!library;

  // Fetch messages for the user's library
  const { data: messages = [], isLoading: messagesLoading } = useMessages(library?.id);
  const markRead = useMarkMessageRead();
  const deleteMessage = useDeleteMessage();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  if (authLoading || librariesLoading) {
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleMarkRead = async (id: string) => {
    try {
      await markRead.mutateAsync(id);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage.mutateAsync(id);
      toast({ title: "Message deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleExpand = (id: string, isRead: boolean) => {
    setExpandedId(expandedId === id ? null : id);
    if (!isRead) handleMarkRead(id);
    if (expandedId !== id) {
      setReplyingToId(null);
      setReplyText("");
    }
  };

  const handleSendReply = async (messageId: string) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("reply-to-inquiry", {
        body: { message_id: messageId, reply_text: replyText.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send reply");
      toast({ title: "Reply sent!" });
      setReplyText("");
      setReplyingToId(null);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send reply", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const unreadCount = messages.filter((m) => !m.is_read).length;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-6 -ml-2" onClick={() => window.location.href = getPlatformUrl("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <InboxIcon className="h-7 w-7 text-secondary" />
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Inbox</h1>
            <p className="text-muted-foreground text-sm">All your messages in one place</p>
          </div>
        </div>

        <Tabs defaultValue={isOwner ? "received" : "sent"}>
          <TabsList className="mb-6">
            {isOwner && (
              <TabsTrigger value="received" className="gap-2">
                <Mail className="h-4 w-4" />
                Received
                {unreadCount > 0 && (
                  <Badge variant="default" className="ml-1 text-[10px] px-1.5 py-0">{unreadCount}</Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="sent" className="gap-2">
              <Send className="h-4 w-4" />
              Sent
            </TabsTrigger>
          </TabsList>

          {isOwner && (
            <TabsContent value="received">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : messages.length === 0 ? (
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
                  {messages.map((message) => {
                    const hasReplies = message.replies && message.replies.length > 0;
                    const isExpanded = expandedId === message.id;

                    return (
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
                                <div className="flex items-center gap-2">
                                  <CardTitle className="font-display text-base truncate">
                                    {message.sender_name}
                                  </CardTitle>
                                  {hasReplies && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Reply className="h-3 w-3 mr-1" />
                                      {message.replies!.length}
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="text-xs">
                                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!message.is_read && <Badge variant="default" className="text-xs">New</Badge>}
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {message.game && (
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">Re: {message.game.title}</Badge>
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/game/${message.game?.slug || message.game_id}`);
                              }}>
                                <ExternalLink className="h-3 w-3 mr-1" />View
                              </Button>
                            </div>
                          )}
                          <div className={`${isExpanded ? "" : "line-clamp-2"}`}>
                            {isExpanded && (
                              <div className="flex items-center gap-2 mb-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">{message.sender_name} (Buyer)</span>
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground">{message.message}</p>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-border space-y-4" onClick={(e) => e.stopPropagation()}>
                              {hasReplies && (
                                <div className="space-y-3">
                                  {message.replies!.map((reply) => (
                                    <div key={reply.id} className={`rounded-lg p-3 ${
                                      reply.is_owner_reply ? "bg-primary/10 border border-primary/20 ml-4" : "bg-muted/50 mr-4"
                                    }`}>
                                      <div className="flex items-center gap-2 mb-1">
                                        {reply.is_owner_reply ? (
                                          <><Store className="h-3 w-3 text-primary" /><span className="text-xs font-medium text-primary">You (Owner)</span></>
                                        ) : (
                                          <><User className="h-3 w-3 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground">{message.sender_name} (Buyer)</span></>
                                        )}
                                      </div>
                                      <p className="text-sm">{reply.reply_text}</p>
                                      <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {replyingToId === message.id ? (
                                <div className="space-y-2 ml-4">
                                  <Textarea placeholder="Write your reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} maxLength={2000} />
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => { setReplyingToId(null); setReplyText(""); }}>Cancel</Button>
                                    <Button size="sm" disabled={!replyText.trim() || sending} onClick={() => handleSendReply(message.id)}>
                                      <Send className="h-4 w-4 mr-1" />{sending ? "Sending..." : "Send"}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Button variant="default" size="sm" onClick={() => setReplyingToId(message.id)}>
                                    <MessageSquare className="h-4 w-4 mr-2" />Reply
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete message?</AlertDialogTitle>
                                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(message.id)}>Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="sent">
            <MyInquiriesSection />
            {/* Show empty state if MyInquiriesSection returns null */}
            <InquiriesEmptyFallback />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

/** Shows empty state only when MyInquiriesSection renders null */
function InquiriesEmptyFallback() {
  return (
    <div className="text-center py-12 text-muted-foreground hidden only:block">
      <Send className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
      <h3 className="font-display text-lg font-semibold text-foreground mb-2">No sent inquiries</h3>
      <p>When you message library owners about games, your conversations will appear here.</p>
    </div>
  );
}

export default Inbox;
