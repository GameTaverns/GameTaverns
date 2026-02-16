import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  useChallenges,
  useActiveChallenges,
  useChallengeParticipants,
  useCreateChallenge,
  useUpdateChallenge,
  useJoinChallenge,
  useLeaveChallenge,
  type Challenge,
  type ChallengeType,
} from "@/hooks/useChallenges";
import { useAuth } from "@/hooks/useAuth";
import { useAllGamesFlat } from "@/hooks/useGames";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy,
  Target,
  Users,
  Calendar,
  Plus,
  Play,
  Crown,
} from "lucide-react";

interface ChallengesManagerProps {
  libraryId: string;
  canManage?: boolean;
}

const CHALLENGE_TYPE_LABELS: Record<ChallengeType, { label: string; icon: typeof Trophy }> = {
  play_count: { label: "Play Count Goal", icon: Target },
  unique_games: { label: "Unique Games", icon: Trophy },
  specific_game: { label: "Specific Game", icon: Play },
  high_score: { label: "High Score", icon: Crown },
  most_plays: { label: "Most Plays Wins", icon: Trophy },
  most_unique: { label: "Most Unique Wins", icon: Trophy },
};

export function ChallengesManager({ libraryId, canManage = false }: ChallengesManagerProps) {
  const { data: challenges, isLoading } = useChallenges(libraryId);
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const activeChallenges = challenges?.filter((c) => c.status === "active") || [];
  const pastChallenges = challenges?.filter((c) => c.status !== "active") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Group Challenges</h2>
          <p className="text-sm text-muted-foreground">Compete with your library members</p>
        </div>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs h-7 gap-1.5">
                <Plus className="h-3 w-3" />
                New Challenge
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Challenge</DialogTitle>
              </DialogHeader>
              <CreateChallengeForm
                libraryId={libraryId}
                onSuccess={() => setCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {activeChallenges.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Active Challenges</h3>
          {activeChallenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} canManage={canManage} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No active challenges</p>
            {canManage && <p className="text-sm mt-1">Create one to get started!</p>}
          </CardContent>
        </Card>
      )}

      {pastChallenges.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Past Challenges</h3>
          {pastChallenges.slice(0, 5).map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} canManage={canManage} compact />
          ))}
        </div>
      )}
    </div>
  );
}

function ChallengeCard({
  challenge,
  canManage,
  compact = false,
}: {
  challenge: Challenge;
  canManage: boolean;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { data: participants } = useChallengeParticipants(challenge.id);
  const joinChallenge = useJoinChallenge();
  const leaveChallenge = useLeaveChallenge();
  const updateChallenge = useUpdateChallenge();
  const { toast } = useToast();

  const typeInfo = CHALLENGE_TYPE_LABELS[challenge.challenge_type];
  const Icon = typeInfo.icon;
  const isActive = challenge.status === "active";
  const isParticipant = participants?.some((p) => p.user_id === user?.id);
  const endDate = new Date(challenge.end_date);
  const timeLeft = isActive ? formatDistanceToNow(endDate, { addSuffix: true }) : null;

  const handleJoin = async () => {
    try {
      await joinChallenge.mutateAsync(challenge.id);
      toast({ title: "Joined challenge!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleLeave = async () => {
    try {
      await leaveChallenge.mutateAsync(challenge.id);
      toast({ title: "Left challenge" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleActivate = async () => {
    try {
      await updateChallenge.mutateAsync({
        id: challenge.id,
        libraryId: challenge.library_id,
        updates: { status: "active" },
      });
      toast({ title: "Challenge activated!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (compact) {
    return (
      <Card className="bg-card/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium text-sm">{challenge.title}</div>
              <div className="text-xs text-muted-foreground">
                {format(endDate, "MMM d, yyyy")} • {participants?.length || 0} participants
              </div>
            </div>
            <Badge variant={challenge.status === "completed" ? "default" : "secondary"}>
              {challenge.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{challenge.title}</CardTitle>
              <CardDescription>{typeInfo.label}</CardDescription>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={isActive ? "default" : "secondary"}>{challenge.status}</Badge>
            {timeLeft && <div className="text-xs text-muted-foreground mt-1">Ends {timeLeft}</div>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {challenge.description && (
          <p className="text-sm text-muted-foreground">{challenge.description}</p>
        )}

        {challenge.target_game && (
          <div className="text-sm">
            <span className="text-muted-foreground">Target: </span>
            <span className="font-medium">{challenge.target_game.title}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span>Goal: {challenge.target_value}</span>
        </div>

        {/* Participants */}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{participants?.length || 0} participants</span>
          <div className="flex -space-x-2 ml-2">
            {participants?.slice(0, 5).map((p) => (
              <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                <AvatarImage src={p.user_profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {p.user_profile?.display_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>

        {/* Leaderboard Preview */}
        {participants && participants.length > 0 && (
          <div className="space-y-2">
            {participants.slice(0, 3).map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-center font-bold text-muted-foreground">{i + 1}</span>
                <span className="flex-1">{p.user_profile?.display_name || "Anonymous"}</span>
                <Progress value={(p.current_progress / challenge.target_value) * 100} className="w-20 h-2" />
                <span className="text-xs w-12 text-right">{p.current_progress}/{challenge.target_value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {isActive && user && (
            isParticipant ? (
              <Button variant="outline" size="sm" onClick={handleLeave} disabled={leaveChallenge.isPending}>
                Leave
              </Button>
            ) : (
              <Button size="sm" onClick={handleJoin} disabled={joinChallenge.isPending}>
                Join Challenge
              </Button>
            )
          )}
          {canManage && challenge.status === "draft" && (
            <Button size="sm" onClick={handleActivate} disabled={updateChallenge.isPending}>
              Activate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateChallengeForm({
  libraryId,
  onSuccess,
}: {
  libraryId: string;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChallengeType>("play_count");
  const [targetValue, setTargetValue] = useState("10");
  const [targetGameId, setTargetGameId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));

  const { data: games } = useAllGamesFlat();
  const createChallenge = useCreateChallenge();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createChallenge.mutateAsync({
        library_id: libraryId,
        title,
        description: description || undefined,
        challenge_type: type,
        target_value: parseInt(targetValue),
        target_game_id: type === "specific_game" ? targetGameId : null,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        status: "draft",
      });
      toast({ title: "Challenge created!" });
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="January Play Challenge"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Challenge Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as ChallengeType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CHALLENGE_TYPE_LABELS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {type === "specific_game" && (
        <div className="space-y-2">
          <Label>Target Game</Label>
          <Select value={targetGameId || ""} onValueChange={setTargetGameId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a game" />
            </SelectTrigger>
            <SelectContent>
              {games?.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="target">Target Value</Label>
        <Input
          id="target"
          type="number"
          min={1}
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start">Start Date</Label>
          <Input
            id="start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">End Date</Label>
          <Input
            id="end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={createChallenge.isPending}>
          {createChallenge.isPending ? "Creating..." : "Create Challenge"}
        </Button>
      </div>
    </form>
  );
}
