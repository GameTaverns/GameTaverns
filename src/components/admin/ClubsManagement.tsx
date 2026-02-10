import { useState } from "react";
import { Check, X, Loader2, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePendingClubs, useApproveClub, useRejectClub } from "@/hooks/useClubs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function ClubsManagement() {
  const { data: pendingClubs = [], isLoading } = usePendingClubs();
  const approveClub = useApproveClub();
  const rejectClub = useRejectClub();
  const { toast } = useToast();

  const handleApprove = async (clubId: string, name: string) => {
    try {
      await approveClub.mutateAsync(clubId);
      toast({ title: "Club approved", description: `"${name}" is now active.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleReject = async (clubId: string, name: string) => {
    try {
      await rejectClub.mutateAsync(clubId);
      toast({ title: "Club rejected", description: `"${name}" has been rejected.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-cream/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-cream mb-1">Club Requests</h2>
        <p className="text-cream/60 text-sm">Review and approve pending club creation requests.</p>
      </div>

      {pendingClubs.length === 0 ? (
        <Card className="bg-wood-medium/30 border-wood-medium/50">
          <CardContent className="py-12 text-center">
            <p className="text-cream/50">No pending club requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingClubs.map((club) => (
            <Card key={club.id} className="bg-wood-medium/30 border-wood-medium/50 text-cream">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-display font-semibold truncate">{club.name}</p>
                    <Badge variant="outline" className="text-xs gap-1">
                      {club.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {club.is_public ? "Public" : "Private"}
                    </Badge>
                  </div>
                  {club.description && (
                    <p className="text-sm text-cream/60 line-clamp-2">{club.description}</p>
                  )}
                  <p className="text-xs text-cream/40 mt-1">
                    Requested {format(new Date(club.created_at), "MMM d, yyyy")}
                    {club.owner_name && ` by ${club.owner_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    onClick={() => handleReject(club.id, club.name)}
                    disabled={rejectClub.isPending}
                  >
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApprove(club.id, club.name)}
                    disabled={approveClub.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
