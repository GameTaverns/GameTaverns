import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { 
  ArrowLeft, 
  Pin, 
  Lock, 
  Unlock,
  MessageCircle, 
  Eye,
  Reply,
  MoreVertical,
  Trash2,
  FolderInput
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RichTextEditor, RichTextContent } from "@/components/community/RichTextEditor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { 
  useThread, 
  useThreadReplies, 
  useCreateReply, 
  useToggleThreadPin,
  useToggleThreadLock,
  useDeleteThread,
  useMoveThread,
  useSiteWideCategories,
  useLibraryCategories,
  useClubCategories,
  type ForumReply,
  type ForumCategory
} from "@/hooks/useForum";
import { useThreadRepliesRealtime } from "@/hooks/useForumRealtime";
import { useAuth } from "@/hooks/useAuth";
import { FeaturedBadge } from "@/components/achievements/FeaturedBadge";
import { UserLink } from "@/components/social/UserLink";
import { UserSpecialBadges } from "@/components/social/SpecialBadge";

function ReplyCard({ reply }: { reply: ForumReply }) {
  const initials = reply.author?.display_name
    ? reply.author.display_name.slice(0, 2).toUpperCase()
    : "??";

  return (
    <div className="flex gap-4 py-4 border-b last:border-0">
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <UserLink username={reply.author?.username} displayName={reply.author?.display_name} className="font-medium" />
          <FeaturedBadge achievement={reply.author?.featured_badge ?? null} size="xs" />
          <UserSpecialBadges badges={reply.author?.special_badges ?? []} size="xs" />
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
          </span>
        </div>
        <RichTextContent html={reply.content} />
      </div>
    </div>
  );
}

function ReplyForm({ threadId, isLocked }: { threadId: string; isLocked: boolean }) {
  const [content, setContent] = useState("");
  const createReply = useCreateReply();
  const { isAuthenticated } = useAuth();

  const hasContent = content.replace(/<[^>]*>/g, "").trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasContent) return;

    createReply.mutate(
      { threadId, content },
      {
        onSuccess: () => setContent(""),
      }
    );
  };

  if (!isAuthenticated) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-4 text-center">
          <p className="text-muted-foreground mb-2">Sign in to reply to this thread</p>
          <Link to="/login">
            <Button variant="outline">Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (isLocked) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-4 text-center">
          <Lock className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">This thread is locked</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <RichTextEditor
        content={content}
        onChange={setContent}
        placeholder="Write your reply..."
        minHeight="120px"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={!hasContent || createReply.isPending}>
          <Reply className="h-4 w-4 mr-2" />
          {createReply.isPending ? "Posting..." : "Post Reply"}
        </Button>
      </div>
    </form>
  );
}

function flattenCategories(categories: ForumCategory[]): ForumCategory[] {
  const result: ForumCategory[] = [];
  for (const cat of categories) {
    result.push(cat);
    if (cat.children?.length) {
      result.push(...flattenCategories(cat.children));
    }
  }
  return result;
}

function MoveThreadDialog({
  open,
  onOpenChange,
  thread,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thread: { id: string; category_id: string; category?: ForumCategory };
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const moveThread = useMoveThread();

  // Determine scope from the thread's current category
  const libraryId = thread.category?.library_id || undefined;
  const clubId = thread.category?.club_id || undefined;

  // Fetch categories for the same scope
  const { data: siteCategories = [] } = useSiteWideCategories();
  const { data: libraryCategories = [] } = useLibraryCategories(libraryId);
  const { data: clubCategories = [] } = useClubCategories(clubId);

  const rawCategories = libraryId
    ? libraryCategories
    : clubId
    ? clubCategories
    : siteCategories;

  const allCategories = flattenCategories(rawCategories).filter(
    (c) => !c.is_archived && c.id !== thread.category_id
  );

  const handleMove = () => {
    if (!selectedCategoryId) return;
    moveThread.mutate(
      { threadId: thread.id, categoryId: selectedCategoryId },
      { onSuccess: () => { onOpenChange(false); setSelectedCategoryId(""); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Thread</DialogTitle>
          <DialogDescription>
            Select a category to move this thread to.
          </DialogDescription>
        </DialogHeader>
        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Select category..." />
          </SelectTrigger>
          <SelectContent>
            {allCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.parent_category_id ? `  ↳ ${cat.name}` : cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={!selectedCategoryId || moveThread.isPending}>
            {moveThread.isPending ? "Moving..." : "Move Thread"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ThreadDetail() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: thread, isLoading: threadLoading } = useThread(threadId);
  const { data: replies = [], isLoading: repliesLoading } = useThreadReplies(threadId);
  
  // Subscribe to realtime reply updates
  useThreadRepliesRealtime(threadId);
  
  // Moderation hooks
  const togglePin = useToggleThreadPin();
  const toggleLock = useToggleThreadLock();
  const deleteThread = useDeleteThread();
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  const handleDelete = () => {
    if (!thread) return;
    deleteThread.mutate(thread.id, {
      onSuccess: () => {
        navigate(thread.category?.slug ? `/community/${thread.category.slug}` : "/community");
      },
    });
  };

  if (threadLoading) {
    return (
      <Layout hideSidebar>
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Layout>
    );
  }

  if (!thread) {
    return (
      <Layout hideSidebar>
        <div className="max-w-3xl mx-auto text-center py-12">
          <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Thread not found</h2>
          <Button variant="outline" onClick={() => navigate("/community")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Forums
          </Button>
        </div>
      </Layout>
    );
  }

  const categorySlug = thread.category?.slug || "";
  const authorInitials = thread.author?.display_name
    ? thread.author.display_name.slice(0, 2).toUpperCase()
    : "??";

  // Check if user can moderate this thread (admin for now, can extend to moderators)
  const canModerate = isAdmin;

  return (
    <Layout hideSidebar>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back Navigation */}
        <Link
          to={categorySlug ? `/community/${categorySlug}` : "/community"}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {thread.category?.name || "Forums"}
        </Link>

        {/* Thread Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2 flex-wrap">
              {thread.is_pinned && (
                <Badge variant="secondary">
                  <Pin className="h-3 w-3 mr-1" />
                  Pinned
                </Badge>
              )}
              {thread.is_locked && (
                <Badge variant="outline">
                  <Lock className="h-3 w-3 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
            
            {/* Moderation Controls */}
            {canModerate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => togglePin.mutate({ threadId: thread.id, isPinned: !thread.is_pinned })}
                    disabled={togglePin.isPending}
                  >
                    <Pin className="h-4 w-4 mr-2" />
                    {thread.is_pinned ? "Unpin thread" : "Pin thread"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toggleLock.mutate({ threadId: thread.id, isLocked: !thread.is_locked })}
                    disabled={toggleLock.isPending}
                  >
                    {thread.is_locked ? (
                      <>
                        <Unlock className="h-4 w-4 mr-2" />
                        Unlock thread
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Lock thread
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowMoveDialog(true)}>
                    <FolderInput className="h-4 w-4 mr-2" />
                    Move to category...
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete thread
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <h1 className="text-3xl font-bold">{thread.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
              </Avatar>
              <UserLink username={thread.author?.username} displayName={thread.author?.display_name} />
              <FeaturedBadge achievement={thread.author?.featured_badge ?? null} size="sm" />
            </div>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>{thread.view_count} views</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              <span>{thread.reply_count} replies</span>
            </div>
          </div>
        </div>

        {/* Move Thread Dialog */}
        {canModerate && (
          <MoveThreadDialog
            open={showMoveDialog}
            onOpenChange={setShowMoveDialog}
            thread={thread}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this thread?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the thread and all its replies. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteThread.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Thread Content */}
        <Card>
          <CardContent className="py-6">
            <RichTextContent html={thread.content} />
          </CardContent>
        </Card>

        {/* Replies */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Replies ({replies.length})
          </h2>

          {repliesLoading ? (
            <Card>
              <CardContent className="py-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ) : replies.length > 0 ? (
            <Card>
              <CardContent className="divide-y">
                {replies.map((reply) => (
                  <ReplyCard key={reply.id} reply={reply} />
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-muted/30">
              <CardContent className="py-8 text-center">
                <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No replies yet. Be the first to respond!</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Reply Form */}
        <ReplyForm threadId={thread.id} isLocked={thread.is_locked} />
      </div>
    </Layout>
  );
}
