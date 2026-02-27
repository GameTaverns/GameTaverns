import { useState } from "react";
import { format } from "date-fns";
import { Mail, Trash2, Check, Bug, Lightbulb, MessageCircle, Eye, Send, StickyNote, UserCog, ArrowRight, Image } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  usePlatformFeedback,
  useMarkFeedbackRead,
  useDeleteFeedback,
  useUpdateFeedbackStatus,
  useAssignFeedback,
  useFeedbackNotes,
  useAddFeedbackNote,
  PlatformFeedback,
  FeedbackType,
  FeedbackStatus,
} from "@/hooks/usePlatformFeedback";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/backend/client";

const feedbackTypeConfig: Record<FeedbackType, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  feedback: { label: "Feedback", icon: <MessageCircle className="h-3 w-3" />, variant: "secondary" },
  bug: { label: "Bug", icon: <Bug className="h-3 w-3" />, variant: "destructive" },
  feature_request: { label: "Feature", icon: <Lightbulb className="h-3 w-3" />, variant: "default" },
};

const statusConfig: Record<FeedbackStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  in_progress: { label: "In Progress", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  resolved: { label: "Resolved", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  wont_fix: { label: "Won't Fix", color: "bg-muted text-muted-foreground border-muted" },
};

// ─── Feedback Detail Dialog ────────────────────────────────────────────────
function FeedbackDetailDialog({ 
  feedback, 
  open, 
  onOpenChange,
}: { 
  feedback: PlatformFeedback; 
  open: boolean; 
  onOpenChange: (v: boolean) => void;
}) {
  const { user, isAdmin } = useAuth();
  const config = feedbackTypeConfig[feedback.type];
  const updateStatus = useUpdateFeedbackStatus();
  const assignFeedback = useAssignFeedback();
  const { data: notes = [], isLoading: notesLoading } = useFeedbackNotes(open ? feedback.id : undefined);
  const addNote = useAddFeedbackNote();
  const noteStorageKey = `feedback-note-${feedback.id}`;
  const typeStorageKey = `feedback-note-type-${feedback.id}`;
  const [noteContent, setNoteContent] = useState(() => {
    try { return sessionStorage.getItem(noteStorageKey) || ""; } catch { return ""; }
  });
  const [noteType, setNoteType] = useState<"internal" | "reply">(() => {
    try {
      const saved = sessionStorage.getItem(typeStorageKey);
      return saved === "reply" ? "reply" : "internal";
    } catch { return "internal"; }
  });

  // Persist draft to sessionStorage
  const handleNoteContentChange = (value: string) => {
    setNoteContent(value);
    try { sessionStorage.setItem(noteStorageKey, value); } catch {}
  };
  const handleNoteTypeChange = (type: "internal" | "reply") => {
    setNoteType(type);
    try { sessionStorage.setItem(typeStorageKey, type); } catch {}
  };
  const clearNoteDraft = () => {
    setNoteContent("");
    setNoteType("internal");
    try {
      sessionStorage.removeItem(noteStorageKey);
      sessionStorage.removeItem(typeStorageKey);
    } catch {}
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Staff";
  const hasReplyEmail = !!feedback.sender_email?.trim();

  const handleAddNote = async () => {
    if (!noteContent.trim() || !user) return;

    if (noteType === "reply" && !hasReplyEmail) {
      toast({
        title: "Cannot send reply",
        description: "This feedback has no sender email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      await addNote.mutateAsync({
        feedback_id: feedback.id,
        author_id: user.id,
        author_name: displayName,
        content: noteContent.trim(),
        note_type: noteType,
      });

      // If it's a reply, also send email via edge function
      let emailSent = false;
      let emailErrorMsg: string | null = null;
      if (noteType === "reply" && hasReplyEmail) {
        try {
          const { data: emailResult, error: emailError } = await supabase.functions.invoke("reply-feedback", {
            body: {
              to_email: feedback.sender_email,
              to_name: feedback.sender_name,
              subject: `Re: Your ${feedback.type === "bug" ? "bug report" : feedback.type === "feature_request" ? "feature request" : "feedback"}`,
              message: noteContent.trim(),
              from_name: displayName,
            },
          });
          console.log("Reply invoke result:", { emailResult, emailError });
          if (emailError) {
            console.error("Reply email error:", emailError);
            emailErrorMsg = String(emailError.message || emailError);
          } else if (emailResult && typeof emailResult === "object" && "error" in emailResult && emailResult.error) {
            console.error("Reply email function error:", emailResult.error);
            emailErrorMsg = String(emailResult.error);
          } else {
            emailSent = true;
            console.log("Reply email sent:", emailResult);
          }
        } catch (emailErr: any) {
          console.error("Reply email exception:", emailErr);
          emailErrorMsg = emailErr.message || "Unknown error";
        }
      }

      clearNoteDraft();
      if (noteType === "reply") {
        if (emailSent) {
          toast({ title: "Reply sent to user" });
        } else if (emailErrorMsg) {
          toast({ title: "Reply note saved, but email failed", description: emailErrorMsg, variant: "destructive" });
        } else {
          toast({ title: "Reply note saved" });
        }
      } else {
        toast({ title: "Note added" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAssignToMe = () => {
    if (!user) return;
    assignFeedback.mutate({
      id: feedback.id,
      assignedTo: user.id,
      assignedToName: displayName,
    });
  };

  const handleUnassign = () => {
    assignFeedback.mutate({ id: feedback.id, assignedTo: null, assignedToName: null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent
         className="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
         onPointerDownOutside={(e) => e.preventDefault()}
         onFocusOutside={(e) => e.preventDefault()}
         onInteractOutside={(e) => e.preventDefault()}
       >
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={config.variant} className="gap-1">
              {config.icon}
              {config.label}
            </Badge>
            <Badge variant="outline" className={statusConfig[feedback.status]?.color}>
              {statusConfig[feedback.status]?.label}
            </Badge>
          </div>
          <DialogTitle>{feedback.sender_name}</DialogTitle>
          <DialogDescription className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {feedback.sender_email}
          </DialogDescription>
        </DialogHeader>

        {/* Original message */}
        <div className="space-y-4">
          <div className="p-3 rounded-md bg-muted/50 border">
            <p className="text-sm whitespace-pre-wrap">{feedback.message}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Submitted {format(new Date(feedback.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>

          {/* Screenshots */}
          {feedback.screenshot_urls && feedback.screenshot_urls.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Image className="h-4 w-4" />
                Screenshots ({feedback.screenshot_urls.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {feedback.screenshot_urls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative group"
                  >
                    <img
                      src={url}
                      alt={`Screenshot ${i + 1}`}
                      className="h-24 w-24 object-cover rounded-md border border-border hover:border-primary transition-colors"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Status + Assignment controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Status:</Label>
              <Select
                value={feedback.status}
                onValueChange={(v) => updateStatus.mutate({ id: feedback.id, status: v as FeedbackStatus })}
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Assigned:</Label>
              {feedback.assigned_to_name ? (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs gap-1">
                    <UserCog className="h-3 w-3" />
                    {feedback.assigned_to_name}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleUnassign}>
                    ×
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAssignToMe}>
                  <UserCog className="h-3 w-3 mr-1" /> Assign to me
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Notes / Thread */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Activity</h4>
            {notesLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notes or replies yet.</p>
            ) : (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-3 rounded-md border text-sm ${
                      note.note_type === "reply"
                        ? "bg-primary/5 border-primary/20"
                        : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs">{note.author_name || "Staff"}</span>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {note.note_type === "reply" ? "Reply to user" : "Internal note"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {format(new Date(note.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add note/reply */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  variant={noteType === "internal" ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleNoteTypeChange("internal")}
                >
                  <StickyNote className="h-3 w-3" /> Internal Note
                </Button>
                <Button
                  variant={noteType === "reply" ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleNoteTypeChange("reply")}
                >
                  <Send className="h-3 w-3" /> Reply to User
                </Button>
              </div>
              <Textarea
                value={noteContent}
                onChange={(e) => handleNoteContentChange(e.target.value)}
                placeholder={
                  noteType === "reply"
                    ? hasReplyEmail
                      ? `Reply will be emailed to ${feedback.sender_email}...`
                      : "This feedback has no sender email, so reply email cannot be sent."
                    : "Add an internal note (only visible to staff)..."
                }
                rows={3}
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!noteContent.trim() || addNote.isPending || (noteType === "reply" && !hasReplyEmail)}
              >
                {addNote.isPending
                  ? "Sending..."
                  : noteType === "reply"
                    ? "Send Reply"
                    : "Add Note"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Feedback Card ──────────────────────────────────────────────────────────

function FeedbackCard({ feedback, isOpen, onOpen, onClose }: { feedback: PlatformFeedback; isOpen: boolean; onOpen: () => void; onClose: () => void }) {
  const markRead = useMarkFeedbackRead();
  const deleteFeedback = useDeleteFeedback();
  const updateStatus = useUpdateFeedbackStatus();
  const { isAdmin } = useAuth();
  const config = feedbackTypeConfig[feedback.type];

  const handleMarkRead = async () => {
    try {
      await markRead.mutateAsync(feedback.id);
      toast({ title: "Marked as read" });
    } catch (_e) {
      toast({ title: "Error", description: "Failed to mark as read", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteFeedback.mutateAsync(feedback.id);
      toast({ title: "Feedback deleted" });
    } catch (_e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const handleView = () => {
    onOpen();
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
              <Badge variant="outline" className={`text-[10px] ${statusConfig[feedback.status]?.color}`}>
                {statusConfig[feedback.status]?.label}
              </Badge>
              {!feedback.is_read && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  New
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(feedback.created_at), "MMM d, yyyy")}
            </span>
          </div>
          <CardTitle className="text-base">{feedback.sender_name}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {feedback.sender_email}
            </span>
            {feedback.assigned_to_name && (
              <span className="flex items-center gap-1 text-xs">
                <ArrowRight className="h-3 w-3" />
                <UserCog className="h-3 w-3" />
                {feedback.assigned_to_name}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {feedback.message}
          </p>
          {feedback.screenshot_urls && feedback.screenshot_urls.length > 0 && (
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Image className="h-3 w-3" />
              {feedback.screenshot_urls.length} screenshot{feedback.screenshot_urls.length > 1 ? "s" : ""} attached
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleView}>
              <Eye className="h-3 w-3 mr-1" />
              View & Triage
            </Button>
            {!feedback.is_read && (
              <Button variant="ghost" size="sm" onClick={handleMarkRead} disabled={markRead.isPending}>
                <Check className="h-3 w-3 mr-1" />
                Mark Read
              </Button>
            )}
            {/* Quick status change */}
            {feedback.status === "open" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-400"
                onClick={() => updateStatus.mutate({ id: feedback.id, status: "in_progress" })}
              >
                In Progress
              </Button>
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-auto">
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
            )}
          </div>
        </CardContent>
      </Card>

      <FeedbackDetailDialog feedback={feedback} open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }} />
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function FeedbackManagement() {
  const { data: feedback, isLoading, error } = usePlatformFeedback();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [openFeedbackId, setOpenFeedbackId] = useState<string | null>(() => {
    try { return sessionStorage.getItem("admin-open-feedback-id"); } catch { return null; }
  });

  const handleOpenFeedback = (id: string) => {
    setOpenFeedbackId(id);
    try { sessionStorage.setItem("admin-open-feedback-id", id); } catch {}
  };

  const handleCloseFeedback = () => {
    setOpenFeedbackId(null);
    try { sessionStorage.removeItem("admin-open-feedback-id"); } catch {}
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
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
  const openCount = feedback?.filter((f) => f.status === "open").length || 0;
  const inProgressCount = feedback?.filter((f) => f.status === "in_progress").length || 0;

  // Apply filters
  let filtered = feedback || [];
  if (statusFilter !== "all") {
    filtered = filtered.filter((f) => f.status === statusFilter);
  }
  if (typeFilter !== "all") {
    filtered = filtered.filter((f) => f.type === typeFilter);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-cream">
            User Feedback
          </h2>
          <p className="text-cream/70 text-sm flex items-center gap-3">
            <span>Review, triage, and respond to user feedback.</span>
            {unreadCount > 0 && <Badge className="bg-primary text-primary-foreground">{unreadCount} new</Badge>}
            {openCount > 0 && <Badge variant="outline" className={statusConfig.open.color}>{openCount} open</Badge>}
            {inProgressCount > 0 && <Badge variant="outline" className={statusConfig.in_progress.color}>{inProgressCount} in progress</Badge>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-cream/60">Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="wont_fix">Won't Fix</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-cream/60">Type:</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="feature_request">Feature</SelectItem>
              <SelectItem value="feedback">Feedback</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-wood-medium/20 border-wood-medium/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageCircle className="h-12 w-12 text-cream/30 mb-4" />
            <p className="text-cream/70 text-center">
              {(feedback?.length || 0) > 0 
                ? "No feedback matches the current filters." 
                : "No feedback yet. When users submit feedback, it will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <FeedbackCard key={item.id} feedback={item} isOpen={openFeedbackId === item.id} onOpen={() => handleOpenFeedback(item.id)} onClose={handleCloseFeedback} />
          ))}
        </div>
      )}
    </div>
  );
}
