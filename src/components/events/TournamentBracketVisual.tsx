import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Minus } from "lucide-react";
import type { TournamentMatch, TournamentPlayer } from "@/hooks/useEventTournament";

interface TournamentBracketVisualProps {
  matches: TournamentMatch[];
  players: TournamentPlayer[];
  onSelectMatch?: (match: TournamentMatch) => void;
}

export function TournamentBracketVisual({ matches, players, onSelectMatch }: TournamentBracketVisualProps) {
  const playerMap = useMemo(() => {
    const map: Record<string, TournamentPlayer> = {};
    players.forEach(p => { map[p.id] = p; });
    return map;
  }, [players]);

  const rounds = useMemo(() => {
    const grouped: Record<number, TournamentMatch[]> = {};
    matches.forEach(m => {
      if (!grouped[m.round_number]) grouped[m.round_number] = [];
      grouped[m.round_number].push(m);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([round, ms]) => ({
        round: Number(round),
        matches: ms.sort((a, b) => a.match_number - b.match_number),
      }));
  }, [matches]);

  if (rounds.length === 0) return null;

  const totalRounds = rounds.length;
  const isFinal = (roundIdx: number) => roundIdx === totalRounds - 1;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-0 min-w-max">
        {rounds.map((round, roundIdx) => {
          // Calculate spacing multiplier for bracket alignment
          const spacingMultiplier = Math.pow(2, roundIdx);
          const matchGap = spacingMultiplier * 4; // rem units

          return (
            <div key={round.round} className="flex flex-col items-center" style={{ minWidth: 220 }}>
              {/* Round header */}
              <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                {isFinal(roundIdx) ? (
                  <>
                    <Trophy className="h-3.5 w-3.5 text-primary" />
                    Final
                  </>
                ) : (
                  `Round ${round.round}`
                )}
              </div>

              {/* Matches */}
              <div
                className="flex flex-col justify-around flex-1"
                style={{ gap: `${matchGap}rem` }}
              >
                {round.matches.map((match) => (
                  <BracketMatchCard
                    key={match.id}
                    match={match}
                    playerMap={playerMap}
                    isFinal={isFinal(roundIdx)}
                    onClick={() => onSelectMatch?.(match)}
                    showConnectors={roundIdx < totalRounds - 1}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatchCard({
  match,
  playerMap,
  isFinal,
  onClick,
  showConnectors,
}: {
  match: TournamentMatch;
  playerMap: Record<string, TournamentPlayer>;
  isFinal: boolean;
  onClick: () => void;
  showConnectors: boolean;
}) {
  const p1 = match.player1_id ? playerMap[match.player1_id] : null;
  const p2 = match.player2_id ? playerMap[match.player2_id] : null;
  const isComplete = match.status === "completed";
  const isBye = match.status === "bye";

  if (isBye) {
    return (
      <div className="w-[200px] rounded-lg border border-dashed border-border/50 bg-muted/20 p-2 text-center">
        <span className="text-xs text-muted-foreground italic">
          {p1?.player_name || p2?.player_name || "TBD"} — Bye
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        onClick={onClick}
        className={cn(
          "w-[200px] rounded-lg border transition-all cursor-pointer",
          isFinal && "ring-2 ring-primary/20",
          isComplete ? "bg-muted/30 border-border" : "bg-card hover:border-primary/50 hover:shadow-sm"
        )}
      >
        {/* Player 1 */}
        <div
          className={cn(
            "flex items-center justify-between px-3 py-2 border-b",
            isComplete && match.winner_id === match.player1_id && "bg-primary/5"
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isComplete && match.winner_id === match.player1_id && (
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
            <span
              className={cn(
                "text-xs truncate",
                isComplete && match.winner_id === match.player1_id && "font-bold text-primary",
                !p1 && "text-muted-foreground italic"
              )}
            >
              {p1?.player_name || "TBD"}
            </span>
          </div>
          {match.player1_score !== null && (
            <span className="text-xs font-mono font-bold ml-2">{match.player1_score}</span>
          )}
        </div>

        {/* Player 2 */}
        <div
          className={cn(
            "flex items-center justify-between px-3 py-2",
            isComplete && match.winner_id === match.player2_id && "bg-primary/5"
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isComplete && match.winner_id === match.player2_id && (
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
            <span
              className={cn(
                "text-xs truncate",
                isComplete && match.winner_id === match.player2_id && "font-bold text-primary",
                !p2 && "text-muted-foreground italic"
              )}
            >
              {p2?.player_name || "TBD"}
            </span>
          </div>
          {match.player2_score !== null && (
            <span className="text-xs font-mono font-bold ml-2">{match.player2_score}</span>
          )}
        </div>

        {/* Match status indicator */}
        {!isComplete && p1 && p2 && (
          <div className="absolute -top-1 -right-1">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </div>
        )}
      </div>

      {/* Connector line to next round */}
      {showConnectors && (
        <div className="absolute top-1/2 -right-[10px] w-[10px] h-px bg-border" />
      )}
    </div>
  );
}