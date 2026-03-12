import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Clock, Dice5, Shuffle, CalendarClock, MapPinned, Gamepad2,
  BookOpen, Search, CheckCircle,
} from "lucide-react";

interface Props {
  event: any;
  libraryGames: any[];
  activeLoans: any[];
  conventionSettings: any;
}

export function ConventionConcierge({ event, libraryGames, activeLoans, conventionSettings }: Props) {
  const [playerFilter, setPlayerFilter] = useState<string>("any");
  const [timeFilter, setTimeFilter] = useState<string>("any");
  const [spinning, setSpinning] = useState(false);
  const [pickedGame, setPickedGame] = useState<any>(null);
  const [reserveConfirm, setReserveConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Compute availability
  const gamesWithAvailability = useMemo(() => {
    return libraryGames.map((g: any) => {
      const loansOut = activeLoans.filter((l: any) => l.game_id === g.id).length;
      return { ...g, loansOut, available: Math.max(0, (g.copies_owned || 1) - loansOut) };
    });
  }, [libraryGames, activeLoans]);

  // Filter
  const filteredGames = useMemo(() => {
    let games = gamesWithAvailability;
    if (playerFilter !== "any") {
      const count = parseInt(playerFilter);
      games = games.filter(g => g.min_players != null && g.max_players != null && g.min_players <= count && g.max_players >= count);
    }
    if (timeFilter !== "any") {
      if (timeFilter === "quick") games = games.filter(g => g.play_time_minutes != null && g.play_time_minutes <= 30);
      if (timeFilter === "medium") games = games.filter(g => g.play_time_minutes != null && g.play_time_minutes > 30 && g.play_time_minutes <= 60);
      if (timeFilter === "long") games = games.filter(g => g.play_time_minutes != null && g.play_time_minutes > 60);
    }
    if (searchQuery.trim()) {
      games = games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return games;
  }, [gamesWithAvailability, playerFilter, timeFilter, searchQuery]);

  const availableGames = filteredGames.filter(g => g.available > 0);

  const handleSpin = () => {
    if (availableGames.length === 0) return;
    setSpinning(true);
    setPickedGame(null);
    setReserveConfirm(false);
    setTimeout(() => {
      const pick = availableGames[Math.floor(Math.random() * availableGames.length)];
      setPickedGame(pick);
      setSpinning(false);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 py-4">
        <h2 className="text-3xl font-display text-primary">🎲 Game Concierge</h2>
        <p className="text-muted-foreground">Find your next game · {availableGames.length} available</p>
      </div>

      {/* Filters */}
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { value: "any", label: "Any Players" },
            { value: "2", label: "2 Players" },
            { value: "4", label: "3–4 Players" },
            { value: "6", label: "5+ Players" },
          ].map(f => (
            <Button
              key={f.value}
              variant={playerFilter === f.value ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setPlayerFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { value: "any", label: "Any Length" },
            { value: "quick", label: "Quick (≤30m)" },
            { value: "medium", label: "Medium (30–60m)" },
            { value: "long", label: "Long (60m+)" },
          ].map(f => (
            <Button
              key={f.value}
              variant={timeFilter === f.value ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setTimeFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Random Picker */}
      <Card className="max-w-lg mx-auto border-primary/30">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Dice5 className={`h-10 w-10 text-primary ${spinning ? "animate-spin" : ""}`} />
          </div>

          {spinning && (
            <div className="space-y-2">
              <h3 className="font-display text-lg animate-pulse">Picking a game...</h3>
              <p className="text-sm text-muted-foreground">🎰 Spinning the wheel...</p>
            </div>
          )}

          {!pickedGame && !spinning && (
            <>
              <h3 className="font-display text-lg">Can't decide? Let us pick!</h3>
              <p className="text-sm text-muted-foreground">
                We'll randomly select from {availableGames.length} available games matching your filters.
              </p>
              <Button onClick={handleSpin} size="lg" className="gap-2" disabled={availableGames.length === 0}>
                <Shuffle className="h-5 w-5" />
                Pick a Random Game
              </Button>
            </>
          )}

          {pickedGame && !spinning && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-3 overflow-hidden">
                  {pickedGame.image_url ? (
                    <img src={pickedGame.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Gamepad2 className="h-8 w-8 text-primary/60" />
                  )}
                </div>
                <h3 className="font-display text-xl text-primary">{pickedGame.title}</h3>
                <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mt-2">
                  {pickedGame.min_players != null && pickedGame.max_players != null && (
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{pickedGame.min_players}–{pickedGame.max_players}</span>
                  )}
                  {pickedGame.play_time_minutes != null && (
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{pickedGame.play_time_minutes}m</span>
                  )}
                </div>
                <Badge variant="secondary" className="mt-2">{pickedGame.available} of {pickedGame.copies_owned || 1} available</Badge>
              </div>

              {!reserveConfirm ? (
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => setReserveConfirm(true)} className="gap-2">
                    <CalendarClock className="h-4 w-4" /> Reserve This Game
                  </Button>
                  <Button variant="outline" onClick={handleSpin} className="gap-2">
                    <Shuffle className="h-4 w-4" /> Pick Another
                  </Button>
                </div>
              ) : (
                <Card className="bg-primary/5 border-primary/20 text-left">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Reserved! Held for {conventionSettings?.reservation_hold_minutes || 30} minutes.
                    </p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>🎫 Show this screen to a volunteer at the lending desk</p>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => { setPickedGame(null); setReserveConfirm(false); }}>
                      Browse More Games
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Browse Available */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Browse Available Games
          </h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search games..." className="pl-9 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {filteredGames.slice(0, 20).map((game: any) => (
            <Card key={game.id} className={`overflow-hidden ${game.available > 0 ? "card-hover cursor-pointer" : "opacity-60 border-dashed"}`}>
              <div className="aspect-square bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center relative overflow-hidden">
                {game.image_url ? (
                  <img src={game.image_url} alt={game.title} className="w-full h-full object-cover" />
                ) : (
                  <Gamepad2 className={`h-12 w-12 ${game.available > 0 ? "text-primary/40" : "text-muted-foreground/20"}`} />
                )}
                {game.available === 0 && (
                  <Badge className="absolute top-2 right-2 bg-destructive/80 text-destructive-foreground text-xs">
                    All out
                  </Badge>
                )}
              </div>
              <CardContent className="p-2.5">
                <p className="font-display font-medium text-sm truncate">{game.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  {game.min_players != null && <span>{game.min_players}–{game.max_players}p</span>}
                  {game.play_time_minutes != null && <><span>·</span><span>{game.play_time_minutes}m</span></>}
                </div>
                {game.available > 0 ? (
                  <Button size="sm" variant="outline" className="w-full mt-2 text-xs h-7 gap-1">
                    <CalendarClock className="h-3 w-3" /> Reserve
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="w-full mt-2 text-xs h-7 gap-1" disabled>
                    Unavailable
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredGames.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No games match your filters</p>
        )}
      </div>
    </div>
  );
}
