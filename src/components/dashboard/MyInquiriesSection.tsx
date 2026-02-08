import { useState } from "react";
import { MessageSquare, ChevronDown, ChevronUp, ExternalLink, Reply, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMyInquiries } from "@/hooks/useMyInquiries";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function MyInquiriesSection() {
  const { data: inquiries = [], isLoading } = useMyInquiries();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const { getPlatformUrl } = useTenantUrl();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (inquiries.length === 0) {
    return null; // Don't show section if user has no inquiries
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const buildGameUrl = (inquiry: typeof inquiries[0]) => {
    if (!inquiry.game?.slug) return null;
    
    const librarySlug = inquiry.game.library_slug;
    if (!librarySlug) return null;
    
    // Build absolute URL to the library subdomain
    const host = window.location.host;
    const isLocalhost = host.includes("localhost");
    const isLovablePreview = host.includes("lovable.app");
    
    if (isLocalhost || isLovablePreview) {
      // Use query param for local/preview
      return `${window.location.origin}/game/${inquiry.game.slug}?tenant=${librarySlug}`;
    }
    
    // Production: use subdomain
    const parts = host.split(".");
    const baseDomain = parts.length > 2 ? parts.slice(-2).join(".") : host;
    return `https://${librarySlug}.${baseDomain}/game/${inquiry.game.slug}`;
  };

  const handleSendReply = async (messageId: string) => {
    if (!replyText.trim()) return;
    
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-inquiry-reply", {
        body: { message_id: messageId, reply_text: replyText.trim() },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send reply");
      
      toast.success("Reply sent!");
      setReplyText("");
      setReplyingToId(null);
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-semibold">My Inquiries</h2>
        <Badge variant="secondary">{inquiries.length}</Badge>
      </div>

      <div className="space-y-3">
        {inquiries.map((inquiry) => {
          const hasReplies = inquiry.replies && inquiry.replies.length > 0;
          const isExpanded = expandedId === inquiry.id;
          const gameUrl = buildGameUrl(inquiry);

          return (
            <Card
              key={inquiry.id}
              className={`card-elevated transition-all cursor-pointer ${
                hasReplies ? "border-primary/30" : ""
              }`}
              onClick={() => toggleExpand(inquiry.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="font-display text-base truncate">
                        {inquiry.game?.title || "Unknown Game"}
                      </CardTitle>
                      {hasReplies && (
                        <Badge variant="default" className="text-xs">
                          <Reply className="h-3 w-3 mr-1" />
                          {inquiry.replies!.length} {inquiry.replies!.length === 1 ? "reply" : "replies"}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      Sent {formatDistanceToNow(new Date(inquiry.created_at), { addSuffix: true })}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {gameUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(gameUrl, "_blank");
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-4">
                    {/* Original message */}
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Your message:</p>
                      <p className="text-sm">{inquiry.message}</p>
                    </div>

                    {/* Replies */}
                    {hasReplies && (
                      <div className="space-y-3 border-t border-border pt-3">
                        <p className="text-xs font-medium text-muted-foreground">Conversation:</p>
                        {inquiry.replies!.map((reply) => (
                          <div
                            key={reply.id}
                            className="bg-primary/5 border border-primary/20 rounded-lg p-3"
                          >
                            <p className="text-sm">{reply.reply_text}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply input */}
                    {hasReplies && (
                      <div className="border-t border-border pt-3">
                        {replyingToId === inquiry.id ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Write your reply..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              rows={3}
                              maxLength={2000}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setReplyingToId(null);
                                  setReplyText("");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                disabled={!replyText.trim() || sending}
                                onClick={() => handleSendReply(inquiry.id)}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                {sending ? "Sending..." : "Send"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReplyingToId(inquiry.id)}
                          >
                            <Reply className="h-4 w-4 mr-1" />
                            Reply
                          </Button>
                        )}
                      </div>
                    )}

                    {!hasReplies && (
                      <p className="text-sm text-muted-foreground italic">
                        No replies yet. The seller will respond here when they reply.
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
