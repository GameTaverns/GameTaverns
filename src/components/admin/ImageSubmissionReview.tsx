import { useState } from "react";
import { Check, X, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  usePendingImageSubmissions,
  useReviewImageSubmission,
  getSubmissionImageUrl,
  type CatalogImageSubmission,
} from "@/hooks/useCatalogImageSubmissions";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

export function ImageSubmissionReview() {
  const { data: submissions = [], isLoading } = usePendingImageSubmissions();
  const review = useReviewImageSubmission();
  const { toast } = useToast();

  if (isLoading) {
    return <p className="text-cream/70 text-sm p-4">Loading submissions…</p>;
  }

  if (submissions.length === 0) {
    return (
      <Card className="border-wood-medium/50">
        <CardContent className="py-8 text-center text-cream/60">
          <p className="text-lg font-semibold">No pending image submissions</p>
          <p className="text-sm mt-1">
            All community image submissions have been reviewed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold text-cream">
          Image Submissions
        </h2>
        <Badge variant="secondary">{submissions.length} pending</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {submissions.map((sub) => (
          <SubmissionCard key={sub.id} submission={sub} />
        ))}
      </div>
    </div>
  );
}

function SubmissionCard({ submission }: { submission: CatalogImageSubmission }) {
  const review = useReviewImageSubmission();
  const { toast } = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const imageUrl = getSubmissionImageUrl(submission.file_path);

  const handleApprove = async () => {
    try {
      await review.mutateAsync({
        submissionId: submission.id,
        action: "approved",
      });
      toast({ title: "Image approved and applied to catalog!" });
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    try {
      await review.mutateAsync({
        submissionId: submission.id,
        action: "rejected",
        rejectionReason: reason.trim() || undefined,
      });
      toast({ title: "Image rejected" });
      setRejecting(false);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-wood-medium/50 overflow-hidden">
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={imageUrl}
          alt={`Submission for ${submission.catalog_title}`}
          className="h-full w-full object-cover"
        />
      </div>
      <CardContent className="p-3 space-y-2">
        <div>
          <Link
            to={`/catalog/${submission.catalog_slug || submission.catalog_id}`}
            className="font-semibold text-sm text-primary hover:underline flex items-center gap-1"
          >
            {submission.catalog_title}
            <ExternalLink className="h-3 w-3" />
          </Link>
          <p className="text-xs text-muted-foreground">
            by {submission.submitter_name} •{" "}
            {new Date(submission.created_at).toLocaleDateString()}
          </p>
          {submission.file_size_bytes && (
            <p className="text-xs text-muted-foreground">
              {(submission.file_size_bytes / 1024).toFixed(0)} KB
            </p>
          )}
        </div>

        {rejecting ? (
          <div className="space-y-2">
            <Input
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={handleReject}
                disabled={review.isPending}
              >
                {review.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Confirm Reject"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRejecting(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1"
              onClick={handleApprove}
              disabled={review.isPending}
            >
              {review.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Check className="h-3 w-3" /> Approve
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setRejecting(true)}
              disabled={review.isPending}
            >
              <X className="h-3 w-3" /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
