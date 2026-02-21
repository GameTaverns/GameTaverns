import { useState } from "react";
import { Vote, PartyPopper, Plus, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibraryPolls, type Poll } from "@/hooks/usePolls";
import { PollCard } from "./PollCard";
import { PollResultsDialog } from "./PollResultsDialog";
import { CreatePollDialog } from "./CreatePollDialog";
import { Button } from "@/components/ui/button";
import { useMyMemberships } from "@/hooks/useLibraryMembership";
import { useTenant } from "@/contexts/TenantContext";
import { getLibraryUrl } from "@/hooks/useTenantUrl";

/**
 * Shows polls across all of a user's libraries (platform mode)
 * or for the current library (tenant mode).
 */
export function CommunityPollsList() {
  const { library, isTenantMode, isOwner } = useTenant();
  const { data: memberships = [] } = useMyMemberships();
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);

  if (isTenantMode && library) {
    return (
      <SingleLibraryPolls
        libraryId={library.id}
        libraryName={library.name}
        canManage={!!isOwner}
        selectedPollId={selectedPollId}
        onSelectPoll={setSelectedPollId}
      />
    );
  }

  // Platform mode: show polls grouped by library
  if (memberships.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <Vote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No polls to show</h3>
        <p className="text-muted-foreground">
          Join a library to see polls here.
        </p>
      </div>
    );
  }

  // Show ALL libraries (owned + member) with polls
  return (
    <div className="space-y-8">
      {memberships.map((m) => (
        <SingleLibraryPolls
          key={m.library!.id}
          libraryId={m.library!.id}
          libraryName={m.library!.name}
          librarySlug={m.library!.slug}
          canManage={m.role === "owner"}
          selectedPollId={selectedPollId}
          onSelectPoll={setSelectedPollId}
        />
      ))}
    </div>
  );
}

function SingleLibraryPolls({
  libraryId,
  libraryName,
  librarySlug,
  canManage,
  selectedPollId,
  onSelectPoll,
}: {
  libraryId: string;
  libraryName: string;
  librarySlug?: string;
  canManage: boolean;
  selectedPollId: string | null;
  onSelectPoll: (id: string | null) => void;
}) {
  const { data: polls, isLoading } = useLibraryPolls(libraryId);

  const openPolls = polls?.filter((p) => p.status === "open") || [];
  const quickPolls = polls?.filter((p) => p.poll_type === "quick") || [];
  const gameNights = polls?.filter((p) => p.poll_type === "game_night") || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold font-display">{libraryName}</h2>
          {librarySlug && (
            <a
              href={getLibraryUrl(librarySlug, "/community?tab=polls")}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Visit
            </a>
          )}
        </div>
        {canManage && (
          <CreatePollDialog
            libraryId={libraryId}
            trigger={
              <Button
                size="sm"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs h-7 gap-1.5"
              >
                <Plus className="h-3 w-3" />
                Create Poll
              </Button>
            }
          />
        )}
      </div>

      {(!polls || polls.length === 0) ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Vote className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No polls yet</p>
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="h-auto flex-wrap gap-0.5 p-0.5">
            <TabsTrigger value="all" className="text-[11px] h-6 px-2">
              All ({polls.length})
            </TabsTrigger>
            <TabsTrigger value="open" className="text-[11px] h-6 px-2">
              Open ({openPolls.length})
            </TabsTrigger>
            <TabsTrigger value="quick" className="text-[11px] h-6 px-2">
              Quick ({quickPolls.length})
            </TabsTrigger>
            <TabsTrigger value="game_night" className="text-[11px] h-6 px-2">
              Nights ({gameNights.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <PollGrid polls={polls} libraryId={libraryId} canManage={canManage} onViewResults={onSelectPoll} />
          </TabsContent>
          <TabsContent value="open" className="mt-4">
            <PollGrid polls={openPolls} libraryId={libraryId} canManage={canManage} onViewResults={onSelectPoll} emptyMessage="No open polls" />
          </TabsContent>
          <TabsContent value="quick" className="mt-4">
            <PollGrid polls={quickPolls} libraryId={libraryId} canManage={canManage} onViewResults={onSelectPoll} emptyMessage="No quick votes" emptyIcon={Vote} />
          </TabsContent>
          <TabsContent value="game_night" className="mt-4">
            <PollGrid polls={gameNights} libraryId={libraryId} canManage={canManage} onViewResults={onSelectPoll} emptyMessage="No game nights" emptyIcon={PartyPopper} />
          </TabsContent>
        </Tabs>
      )}

      <PollResultsDialog
        pollId={selectedPollId}
        open={!!selectedPollId}
        onOpenChange={(open) => !open && onSelectPoll(null)}
      />
    </div>
  );
}

function PollGrid({
  polls,
  libraryId,
  canManage,
  onViewResults,
  emptyMessage = "No polls",
  emptyIcon: EmptyIcon = Vote,
}: {
  polls: Poll[];
  libraryId: string;
  canManage: boolean;
  onViewResults: (pollId: string) => void;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
}) {
  if (polls.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <EmptyIcon className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {polls.map((poll) => (
        <PollCard
          key={poll.id}
          poll={poll}
          libraryId={libraryId}
          canManage={canManage}
          onViewResults={onViewResults}
        />
      ))}
    </div>
  );
}
