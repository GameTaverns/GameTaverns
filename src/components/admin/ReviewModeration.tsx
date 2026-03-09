import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Star, Flag, CheckCircle, XCircle, Eye, Search, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ReviewStatus = "published" | "flagged" | "removed";

interface ReviewRow {
  id: string;
  user_id: string;
  catalog_id: string;
  rating_overall: number;
  title: string | null;
  content: string;
  status: ReviewStatus;
  flagged_reason: string | null;
  helpful_count: number;
  unhelpful_count: number;
  reviewer_weight: number;
  created_at: string;
  updated_at: string;
  catalog_title?: string;
  user_display_name?: string;
  user_username?: string;
}

function useAdminReviews(statusFilter: ReviewStatus | "all") {
  return useQuery({
    queryKey: ["admin-reviews", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("game_reviews")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const reviews = (data || []) as ReviewRow[];

      // Fetch catalog titles
      const catalogIds = [...new Set(reviews.map(r => r.catalog_id))];
      if (catalogIds.length > 0) {
        const { data: catalogs } = await supabase
          .from("game_catalog")
          .select("id, title")
          .in("id", catalogIds);
        const catalogMap = Object.fromEntries((catalogs || []).map(c => [c.id, c.title]));
        reviews.forEach(r => { r.catalog_title = catalogMap[r.catalog_id] || "Unknown"; });
      }

      // Fetch user profiles
      const userIds = [...new Set(reviews.map(r => r.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("user_id, display_name, username")
          .in("user_id", userIds);
        const profileMap = Object.fromEntries(
          (profiles || []).map(p => [p.user_id, p])
        );
        reviews.forEach(r => {
          const p = profileMap[r.user_id];
          r.user_display_name = p?.display_name || null;
          r.user_username = p?.username || null;
        });
      }

      return reviews;
    },
  });
}

export function ReviewModeration() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("flagged");
  const [search, setSearch] = useState("");
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);
  const [actionReason, setActionReason] = useState("");

  const { data: reviews, isLoading } = useAdminReviews(statusFilter);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: ReviewStatus; reason?: string }) => {
      const update: Record<string, unknown> = { status };
      if (reason) update.flagged_reason = reason;
      const { error } = await supabase.from("game_reviews").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast.success("Review status updated");
      setSelectedReview(null);
      setActionReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (reviews || []).filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.content.toLowerCase().includes(s) ||
      r.title?.toLowerCase().includes(s) ||
      r.catalog_title?.toLowerCase().includes(s) ||
      r.user_display_name?.toLowerCase().includes(s) ||
      r.user_username?.toLowerCase().includes(s)
    );
  });

  const statusBadge = (status: ReviewStatus) => {
    const variants: Record<ReviewStatus, { class: string; icon: React.ReactNode }> = {
      published: { class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: <CheckCircle className="h-3 w-3" /> },
      flagged: { class: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: <Flag className="h-3 w-3" /> },
      removed: { class: "bg-destructive/20 text-destructive border-destructive/30", icon: <XCircle className="h-3 w-3" /> },
    };
    const v = variants[status];
    return (
      <Badge variant="outline" className={`gap-1 ${v.class}`}>
        {v.icon} {status}
      </Badge>
    );
  };

  const flaggedCount = (reviews || []).filter(r => r.status === "flagged").length;

  return (
    <div className="space-y-4">
      <Card className="bg-wood-panel/50 border-wood-medium/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-cream flex items-center gap-2 text-base">
              <Star className="h-5 w-5 text-secondary" />
              Review Moderation
              {flaggedCount > 0 && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 ml-1">
                  {flaggedCount} flagged
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cream/40" />
                <Input
                  placeholder="Search reviews…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 w-48 bg-wood-medium/30 border-wood-medium/50 text-cream text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReviewStatus | "all")}>
                <SelectTrigger className="w-32 h-9 bg-wood-medium/30 border-wood-medium/50 text-cream text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="removed">Removed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-cream/50 text-sm py-4">Loading reviews…</p>
          ) : filtered.length === 0 ? (
            <p className="text-cream/50 text-sm py-4">No reviews found.</p>
          ) : (
            <div className="rounded-lg border border-wood-medium/30 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-wood-medium/30 hover:bg-transparent">
                    <TableHead className="text-cream/70">Game</TableHead>
                    <TableHead className="text-cream/70">User</TableHead>
                    <TableHead className="text-cream/70">Rating</TableHead>
                    <TableHead className="text-cream/70">Status</TableHead>
                    <TableHead className="text-cream/70">Votes</TableHead>
                    <TableHead className="text-cream/70">Date</TableHead>
                    <TableHead className="text-cream/70 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(review => (
                    <TableRow key={review.id} className="border-wood-medium/30">
                      <TableCell className="text-cream text-sm font-medium max-w-[180px] truncate">
                        {review.catalog_title || "—"}
                      </TableCell>
                      <TableCell className="text-cream/80 text-sm">
                        {review.user_display_name || review.user_username || review.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-cream text-sm">
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-secondary fill-secondary" />
                          {review.rating_overall}
                        </span>
                      </TableCell>
                      <TableCell>{statusBadge(review.status)}</TableCell>
                      <TableCell className="text-cream/70 text-sm">
                        👍 {review.helpful_count} · 👎 {review.unhelpful_count}
                      </TableCell>
                      <TableCell className="text-cream/60 text-xs">
                        {format(new Date(review.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-cream/70 hover:text-cream h-7 px-2"
                          onClick={() => setSelectedReview(review)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review detail dialog */}
      <Dialog open={!!selectedReview} onOpenChange={open => { if (!open) setSelectedReview(null); }}>
        <DialogContent className="bg-wood-panel border-wood-medium/50 text-cream max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedReview && (
            <>
              <DialogHeader>
                <DialogTitle className="text-cream flex items-center gap-2">
                  <Star className="h-5 w-5 text-secondary" />
                  Review for {selectedReview.catalog_title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Meta */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="text-cream/60">By: <span className="text-cream">{selectedReview.user_display_name || selectedReview.user_username || "Unknown"}</span></span>
                  <span className="text-cream/60">Rating: <span className="text-cream font-bold">{selectedReview.rating_overall}/10</span></span>
                  <span className="text-cream/60">Weight: <span className="text-cream">{selectedReview.reviewer_weight}x</span></span>
                  {statusBadge(selectedReview.status)}
                </div>

                {selectedReview.flagged_reason && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-amber-400 text-xs font-medium">Flag reason</p>
                      <p className="text-cream/80 text-sm">{selectedReview.flagged_reason}</p>
                    </div>
                  </div>
                )}

                {/* Title & Content */}
                {selectedReview.title && (
                  <h3 className="font-display font-bold text-cream">{selectedReview.title}</h3>
                )}
                <div className="prose prose-sm prose-invert max-w-none bg-wood-medium/20 rounded-lg p-4 border border-wood-medium/30">
                  <p className="text-cream/90 whitespace-pre-wrap">{selectedReview.content}</p>
                </div>

                {/* Moderation actions */}
                <div className="space-y-2 pt-2 border-t border-wood-medium/30">
                  <label className="text-xs text-cream/60">Moderation reason (optional)</label>
                  <Textarea
                    value={actionReason}
                    onChange={e => setActionReason(e.target.value)}
                    placeholder="Reason for status change…"
                    className="bg-wood-medium/30 border-wood-medium/50 text-cream text-sm min-h-[60px]"
                  />
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2 pt-2">
                {selectedReview.status !== "published" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    onClick={() => updateStatus.mutate({ id: selectedReview.id, status: "published", reason: actionReason || undefined })}
                    disabled={updateStatus.isPending}
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Approve
                  </Button>
                )}
                {selectedReview.status !== "flagged" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 gap-1"
                    onClick={() => updateStatus.mutate({ id: selectedReview.id, status: "flagged", reason: actionReason || undefined })}
                    disabled={updateStatus.isPending}
                  >
                    <Flag className="h-3.5 w-3.5" /> Flag
                  </Button>
                )}
                {selectedReview.status !== "removed" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() => updateStatus.mutate({ id: selectedReview.id, status: "removed", reason: actionReason || undefined })}
                    disabled={updateStatus.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
