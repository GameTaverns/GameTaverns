import { useState, useMemo } from "react";
import {
  Trophy, Plus, Trash2, Play, CheckCircle2, Settings2,
  Swords, Users, RotateCcw, Award
} from "lucide-react";
import { TournamentBracketVisual } from "@/components/events/TournamentBracketVisual";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useTournamentConfig,
  useUpsertTournamentConfig,
  useTournamentPlayers,
  useAddTournamentPlayer,
  useRemoveTournamentPlayer,
  useTournamentMatches,
  useCreateTournamentMatches,
  useUpdateMatchResult,
  generateSingleEliminationBracket,
  generateRoundRobinMatches,
  generateSwissMatches,
  type TournamentPlayer,
  type TournamentMatch,
  type TournamentFormat,
} from "@/hooks/useEventTournament";

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  swiss: "Swiss",
};

interface EventTournamentTabProps {
  eventId: string;
}

export function EventTournamentTab({ eventId }: EventTournamentTabProps) {
  const { data: config, isLoading: configLoading } = useTournamentConfig(eventId);
  const upsertConfig = useUpsertTournamentConfig();
  const { data: players = [] } = useTournamentPlayers(eventId);
  const { data: matches = [] } = useTournamentMatches(eventId);
  const addPlayer = useAddTournamentPlayer();
  const removePlayer = useRemoveTournamentPlayer();
  const createMatches = useCreateTournamentMatches();
  const updateMatch = useUpdateMatchResult();
  const [activeTab, setActiveTab] = useState("players");
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);

  // Config form
  const [cfgFormat, setCfgFormat] = useState<TournamentFormat>("single_elimination");
  const [cfgPointsWin, setCfgPointsWin] = useState("3");
  const [cfgPointsDraw, setCfgPointsDraw] = useState("1");
  const [cfgMaxRounds, setCfgMaxRounds] = useState("");

  const openConfigDialog = () => {
    if (config) {
      setCfgFormat(config.format as TournamentFormat);
      setCfgPointsWin(String(config.points_win));
      setCfgPointsDraw(String(config.points_draw));
      setCfgMaxRounds(config.max_rounds ? String(config.max_rounds) : "");
    }
    setShowConfigDialog(true);
  };

  const handleSaveConfig = async () => {
    await upsertConfig.mutateAsync({
      event_id: eventId,
      format: cfgFormat,
      points_win: parseInt(cfgPointsWin) || 3,
      points_draw: parseInt(cfgPointsDraw) || 1,
      max_rounds: cfgMaxRounds ? parseInt(cfgMaxRounds) : null,
    });
    setShowConfigDialog(false);
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    await addPlayer.mutateAsync({
      event_id: eventId,
      player_name: newPlayerName.trim(),
      seed: players.length + 1,
    });
    setNewPlayerName("");
  };

  const handleGenerateBracket = async () => {
    if (players.length < 2) return;
    const format = config?.format || "single_elimination";
    let generated: Omit<TournamentMatch, "id" | "created_at" | "updated_at">[];

    switch (format) {
      case "round_robin":
        generated = generateRoundRobinMatches(eventId, players);
        break;
      case "swiss":
        generated = generateSwissMatches(eventId, players, 1);
        break;
      default:
        generated = generateSingleEliminationBracket(eventId, players);
    }

    await createMatches.mutateAsync({ eventId, matches: generated });
    if (config?.status === "setup") {
      await upsertConfig.mutateAsync({ event_id: eventId, status: "in_progress", current_round: 1 });
    }
    setActiveTab("bracket");
  };

  // Group matches by round
  const matchesByRound = useMemo(() => {
    const grouped: Record<number, TournamentMatch[]> = {};
    matches.forEach(m => {
      if (!grouped[m.round_number]) grouped[m.round_number] = [];
      grouped[m.round_number].push(m);
    });
    return grouped;
  }, [matches]);

  const playerMap = useMemo(() => {
    const map: Record<string, TournamentPlayer> = {};
    players.forEach(p => { map[p.id] = p; });
    return map;
  }, [players]);

  // Standings sorted by points desc
  const standings = useMemo(() => {
    return [...players].sort((a, b) => b.points - a.points || b.tiebreaker_score - a.tiebreaker_score);
  }, [players]);

  const tournamentStatus = config?.status || "setup";

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Tournament
              </CardTitle>
              <CardDescription>
                {config ? FORMAT_LABELS[config.format] : "Not configured"} •{" "}
                {players.length} player{players.length !== 1 ? "s" : ""} •{" "}
                <Badge variant={tournamentStatus === "completed" ? "default" : tournamentStatus === "in_progress" ? "secondary" : "outline"} className="text-[10px] ml-1">
                  {tournamentStatus}
                </Badge>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={openConfigDialog}>
                <Settings2 className="h-4 w-4 mr-1" /> Config
              </Button>
              {players.length >= 2 && tournamentStatus !== "completed" && (
                <Button size="sm" onClick={handleGenerateBracket} disabled={createMatches.isPending}>
                  <Play className="h-4 w-4 mr-1" />
                  {matches.length > 0 ? "Regenerate" : "Generate"} Bracket
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="players" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Players
          </TabsTrigger>
          <TabsTrigger value="bracket" className="gap-1.5">
            <Swords className="h-3.5 w-3.5" /> Bracket
          </TabsTrigger>
          <TabsTrigger value="standings" className="gap-1.5">
            <Award className="h-3.5 w-3.5" /> Standings
          </TabsTrigger>
        </TabsList>

        {/* Players Tab */}
        <TabsContent value="players">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                  placeholder="Add player..."
                  onKeyDown={e => e.key === "Enter" && handleAddPlayer()}
                />
                <Button size="sm" onClick={handleAddPlayer} disabled={!newPlayerName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {players.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Add players to start the tournament</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {players.map((player, idx) => (
                    <div key={player.id} className="flex items-center gap-3 p-2 rounded-md border bg-card group">
                      <Badge variant="outline" className="text-xs w-6 h-6 flex items-center justify-center p-0">
                        {idx + 1}
                      </Badge>
                      <span className="flex-1 text-sm font-medium">{player.player_name}</span>
                      {player.is_eliminated && (
                        <Badge variant="destructive" className="text-[10px]">Eliminated</Badge>
                      )}
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => removePlayer.mutate({ playerId: player.id, eventId })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bracket Tab */}
        <TabsContent value="bracket">
          <Card>
            <CardContent className="pt-4">
              {matches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Swords className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No bracket generated yet</p>
                  <p className="text-xs mt-1">Add players and generate a bracket</p>
                </div>
              ) : (
                <>
                  {/* Visual bracket for single elimination */}
                  {(config?.format === "single_elimination" || !config?.format) && (
                    <div className="mb-6">
                      <TournamentBracketVisual
                        matches={matches}
                        players={players}
                        onSelectMatch={(match) => {
                          if (match.status !== "completed" && match.player1_id && match.player2_id) {
                            setSelectedMatch(match);
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Round-by-round list view (always shown, primary for non-SE formats) */}
                  <div className="space-y-6">
                    {Object.entries(matchesByRound).map(([round, roundMatches]) => (
                      <div key={round}>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          Round {round}
                          <Badge variant="outline" className="text-[10px]">
                            {roundMatches.filter(m => m.status === "completed" || m.status === "bye").length}/{roundMatches.length} complete
                          </Badge>
                        </h4>
                        <div className="space-y-2">
                          {roundMatches.map(match => (
                            <MatchCard
                              key={match.id}
                              match={match}
                              playerMap={playerMap}
                              onReportResult={(winnerId, p1Score, p2Score) => {
                                updateMatch.mutate({
                                  matchId: match.id,
                                  eventId,
                                  winnerId,
                                  player1Score: p1Score,
                                  player2Score: p2Score,
                                });
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Standings Tab */}
        <TabsContent value="standings">
          <Card>
            <CardContent className="pt-4">
              {standings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No standings data yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {standings.map((player, idx) => (
                    <div key={player.id} className="flex items-center gap-3 p-2 rounded-md border bg-card">
                      <Badge variant={idx < 3 ? "default" : "outline"} className="text-xs w-6 h-6 flex items-center justify-center p-0">
                        {idx + 1}
                      </Badge>
                      <span className="flex-1 text-sm font-medium">{player.player_name}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{player.wins}W</span>
                        <span>{player.losses}L</span>
                        <span>{player.draws}D</span>
                        <Badge variant="secondary" className="text-xs">{player.points} pts</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Tournament Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={cfgFormat} onValueChange={v => setCfgFormat(v as TournamentFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_elimination">Single Elimination</SelectItem>
                  <SelectItem value="double_elimination">Double Elimination</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="swiss">Swiss</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(cfgFormat === "swiss" || cfgFormat === "round_robin") && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Win Pts</Label>
                  <Input type="number" value={cfgPointsWin} onChange={e => setCfgPointsWin(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Draw Pts</Label>
                  <Input type="number" value={cfgPointsDraw} onChange={e => setCfgPointsDraw(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Max Rounds</Label>
                  <Input type="number" value={cfgMaxRounds} onChange={e => setCfgMaxRounds(e.target.value)} placeholder="Auto" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={upsertConfig.isPending}>
              {upsertConfig.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MatchCard({
  match,
  playerMap,
  onReportResult,
}: {
  match: TournamentMatch;
  playerMap: Record<string, TournamentPlayer>;
  onReportResult: (winnerId: string | null, p1Score?: number, p2Score?: number) => void;
}) {
  const [showResult, setShowResult] = useState(false);
  const [p1Score, setP1Score] = useState("");
  const [p2Score, setP2Score] = useState("");

  const p1 = match.player1_id ? playerMap[match.player1_id] : null;
  const p2 = match.player2_id ? playerMap[match.player2_id] : null;

  if (match.status === "bye") {
    return (
      <div className="p-2 rounded-md border bg-muted/30 text-sm text-muted-foreground italic">
        {p1?.player_name || p2?.player_name || "TBD"} — Bye
      </div>
    );
  }

  const isComplete = match.status === "completed";

  return (
    <div className={`p-3 rounded-lg border ${isComplete ? "bg-muted/30" : "bg-card"}`}>
      <div className="flex items-center gap-2">
        {/* Player 1 */}
        <div className={`flex-1 text-sm ${match.winner_id === match.player1_id ? "font-bold text-primary" : ""}`}>
          {p1?.player_name || "TBD"}
          {match.player1_score !== null && (
            <span className="ml-2 text-xs text-muted-foreground">({match.player1_score})</span>
          )}
        </div>

        <span className="text-xs text-muted-foreground font-medium">vs</span>

        {/* Player 2 */}
        <div className={`flex-1 text-sm text-right ${match.winner_id === match.player2_id ? "font-bold text-primary" : ""}`}>
          {p2?.player_name || "TBD"}
          {match.player2_score !== null && (
            <span className="ml-2 text-xs text-muted-foreground">({match.player2_score})</span>
          )}
        </div>

        {/* Actions */}
        {!isComplete && p1 && p2 && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowResult(!showResult)}>
            Report
          </Button>
        )}
        {isComplete && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
      </div>

      {/* Score entry */}
      {showResult && p1 && p2 && (
        <div className="mt-3 flex items-center gap-2 pt-2 border-t">
          <Input
            type="number" placeholder="Score" className="h-8 text-sm w-20"
            value={p1Score} onChange={e => setP1Score(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">vs</span>
          <Input
            type="number" placeholder="Score" className="h-8 text-sm w-20"
            value={p2Score} onChange={e => setP2Score(e.target.value)}
          />
          <Button
            size="sm" className="h-8 text-xs"
            onClick={() => {
              const s1 = parseInt(p1Score) || 0;
              const s2 = parseInt(p2Score) || 0;
              const winnerId = s1 > s2 ? p1.id : s2 > s1 ? p2.id : null;
              onReportResult(winnerId, s1, s2);
              setShowResult(false);
            }}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
