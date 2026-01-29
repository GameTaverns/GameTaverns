import { useState } from "react";
import { Vote, PartyPopper, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibraryPolls, type Poll } from "@/hooks/usePolls";
import { CreatePollDialog } from "./CreatePollDialog";
import { PollCard } from "./PollCard";
import { PollResultsDialog } from "./PollResultsDialog";
import { Button } from "@/components/ui/button";

interface PollsManagerProps {
  libraryId: string;
}

export function PollsManager({ libraryId }: PollsManagerProps) {
  const { data: polls, isLoading } = useLibraryPolls(libraryId);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);

  const openPolls = polls?.filter(p => p.status === "open") || [];
  const closedPolls = polls?.filter(p => p.status === "closed") || [];
  const quickPolls = polls?.filter(p => p.poll_type === "quick") || [];
  const gameNights = polls?.filter(p => p.poll_type === "game_night") || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with create buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Game Polls</h2>
          <p className="text-muted-foreground">
            Create polls to help your group decide what to play
          </p>
        </div>
        <CreatePollDialog
          libraryId={libraryId}
          trigger={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Poll
            </Button>
          }
        />
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All ({polls?.length || 0})</TabsTrigger>
          <TabsTrigger value="open">Open ({openPolls.length})</TabsTrigger>
          <TabsTrigger value="quick">Quick Votes ({quickPolls.length})</TabsTrigger>
          <TabsTrigger value="game_night">Game Nights ({gameNights.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <PollGrid 
            polls={polls || []} 
            libraryId={libraryId}
            onViewResults={setSelectedPollId}
          />
        </TabsContent>

        <TabsContent value="open" className="mt-6">
          <PollGrid 
            polls={openPolls} 
            libraryId={libraryId}
            onViewResults={setSelectedPollId}
            emptyMessage="No open polls. Create one to get started!"
          />
        </TabsContent>

        <TabsContent value="quick" className="mt-6">
          <PollGrid 
            polls={quickPolls} 
            libraryId={libraryId}
            onViewResults={setSelectedPollId}
            emptyMessage="No quick votes yet"
            emptyIcon={Vote}
          />
        </TabsContent>

        <TabsContent value="game_night" className="mt-6">
          <PollGrid 
            polls={gameNights} 
            libraryId={libraryId}
            onViewResults={setSelectedPollId}
            emptyMessage="No game nights scheduled"
            emptyIcon={PartyPopper}
          />
        </TabsContent>
      </Tabs>

      {/* Results Dialog */}
      <PollResultsDialog
        pollId={selectedPollId}
        open={!!selectedPollId}
        onOpenChange={(open) => !open && setSelectedPollId(null)}
      />
    </div>
  );
}

function PollGrid({
  polls,
  libraryId,
  onViewResults,
  emptyMessage = "No polls yet",
  emptyIcon: EmptyIcon = Vote,
}: {
  polls: Poll[];
  libraryId: string;
  onViewResults: (pollId: string) => void;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
}) {
  if (polls.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <EmptyIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {polls.map((poll) => (
        <PollCard
          key={poll.id}
          poll={poll}
          libraryId={libraryId}
          onViewResults={onViewResults}
        />
      ))}
    </div>
  );
}
