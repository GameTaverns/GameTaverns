import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, ChevronDown, ChevronUp, ExternalLink, Reply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyInquiries } from "@/hooks/useMyInquiries";
import { useTenantUrl } from "@/hooks/useTenantUrl";

export function MyInquiriesSection() {
  const { data: inquiries = [], isLoading } = useMyInquiries();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { buildUrl } = useTenantUrl();

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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (inquiry.game?.slug) {
                          navigate(buildUrl(`/game/${inquiry.game.slug}`));
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Original message */}
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Your message:</p>
                      <p className="text-sm">{inquiry.message}</p>
                    </div>

                    {/* Replies */}
                    {hasReplies && (
                      <div className="space-y-3 border-t border-border pt-3">
                        <p className="text-xs font-medium text-muted-foreground">Replies:</p>
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
