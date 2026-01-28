import { useState } from "react";
import { format } from "date-fns";
import { Mail, Trash2, Check, Bug, Lightbulb, MessageCircle, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePlatformFeedback,
  useMarkFeedbackRead,
  useDeleteFeedback,
  PlatformFeedback,
  FeedbackType,
} from "@/hooks/usePlatformFeedback";
import { toast } from "@/hooks/use-toast";

const feedbackTypeConfig: Record<FeedbackType, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  feedback: {
    label: "Feedback",
    icon: <MessageCircle className="h-3 w-3" />,
    variant: "secondary",
  },
  bug: {
    label: "Bug",
    icon: <Bug className="h-3 w-3" />,
    variant: "destructive",
  },
  feature_request: {
    label: "Feature",
    icon: <Lightbulb className="h-3 w-3" />,
    variant: "default",
  },
};

function FeedbackCard({ feedback }: { feedback: PlatformFeedback }) {
  const [viewOpen, setViewOpen] = useState(false);
  const markRead = useMarkFeedbackRead();
  const deleteFeedback = useDeleteFeedback();
  const config = feedbackTypeConfig[feedback.type];

  const handleMarkRead = async () => {
    try {
      await markRead.mutateAsync(feedback.id);
      toast({ title: "Marked as read" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to mark as read", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteFeedback.mutateAsync(feedback.id);
      toast({ title: "Feedback deleted" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const handleView = () => {
    setViewOpen(true);
    if (!feedback.is_read) {
      markRead.mutate(feedback.id);
    }
  };

  return (
    <>
      <Card className={`transition-colors ${!feedback.is_read ? "border-primary/50 bg-primary/5" : ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={config.variant} className="gap-1">
                {config.icon}
                {config.label}
              </Badge>
              {!feedback.is_read && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  New
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(feedback.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
          <CardTitle className="text-base">{feedback.sender_name}</CardTitle>
          <CardDescription className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {feedback.sender_email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {feedback.message}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleView}>
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            {!feedback.is_read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkRead}
                disabled={markRead.isPending}
              >
                <Check className="h-3 w-3 mr-1" />
                Mark Read
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete feedback?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this feedback.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge variant={config.variant} className="gap-1">
                {config.icon}
                {config.label}
              </Badge>
            </div>
            <DialogTitle>{feedback.sender_name}</DialogTitle>
            <DialogDescription className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {feedback.sender_email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm whitespace-pre-wrap">{feedback.message}</p>
            <p className="text-xs text-muted-foreground">
              Submitted {format(new Date(feedback.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FeedbackManagement() {
  const { data: feedback, isLoading, error } = usePlatformFeedback();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error loading feedback</CardTitle>
          <CardDescription>
            {error instanceof Error ? error.message : "Failed to load feedback"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const unreadCount = feedback?.filter((f) => !f.is_read).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-cream">
            User Feedback
            {unreadCount > 0 && (
              <Badge className="ml-2 bg-primary text-primary-foreground">
                {unreadCount} new
              </Badge>
            )}
          </h2>
          <p className="text-cream/70 text-sm">
            Review feedback, bug reports, and feature requests from users.
          </p>
        </div>
      </div>

      {!feedback || feedback.length === 0 ? (
        <Card className="bg-wood-medium/20 border-wood-medium/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageCircle className="h-12 w-12 text-cream/30 mb-4" />
            <p className="text-cream/70 text-center">
              No feedback yet. When users submit feedback, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {feedback.map((item) => (
            <FeedbackCard key={item.id} feedback={item} />
          ))}
        </div>
      )}
    </div>
  );
}
