import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCheck, X, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSessionTagRequests } from "@/hooks/usePlayerElo";
import { supabase } from "@/integrations/backend/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export function SessionTagNotifications() {
  const { data: requests = [], isLoading } = useSessionTagRequests();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const respond = useMutation({
    mutationFn: async ({ requestId, accept }: { requestId: string; accept: boolean }) => {
      const { error } = await (supabase as any)
        .from("session_tag_requests")
        .update({ status: accept ? "accepted" : "rejected" })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["session-tag-requests"] });
      queryClient.invalidateQueries({ queryKey: ["user-elo"] });
      toast({
        title: vars.accept ? "Session tag accepted!" : "Tag declined",
        description: vars.accept
          ? "This session will now appear on your profile and your ELO will be updated."
          : "The session tag has been declined.",
      });
    },
  });

  if (isLoading || requests.length === 0) return null;

  return (
    <div className="space-y-2">
      {requests.map((req: any) => (
        <Card key={req.id} className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <Trophy className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">You were tagged in a play session</p>
                <p className="text-xs text-muted-foreground">
                  {req.game_title}
                  {req.session_date ? ` · ${format(new Date(req.session_date), "MMM d, yyyy")}` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Accept to have this session appear on your profile and update your ELO rating.
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => respond.mutate({ requestId: req.id, accept: false })}
                  disabled={respond.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => respond.mutate({ requestId: req.id, accept: true })}
                  disabled={respond.isPending}
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                  Accept
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
