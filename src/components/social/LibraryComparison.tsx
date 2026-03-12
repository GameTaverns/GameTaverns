import { useState } from "react";
import { Link } from "react-router-dom";
import { GitCompare, Layers, BarChart3, Gamepad2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useLibraryComparison, type ComparisonGame, type SharedGame, type PlayTogetherGame } from "@/hooks/useLibraryComparison";

interface Props {
  currentUserId: string;
  targetUserId: string;
  currentUserName: string;
  targetUserName: string;
  currentUserAvatar?: string | null;
  targetUserAvatar?: string | null;
  hasTheme?: boolean;
  profileBgColor?: string;
}

function GameThumbnail({ game }: { game: ComparisonGame }) {
  const linkTo = game.slug ? `/games/${game.slug}` : "#";
  return (
    <Link to={linkTo} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors min-w-0">
      {game.image_url ? (
        <img src={game.image_url} alt={game.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs flex-shrink-0">🎲</div>
      )}
      <span className="text-sm truncate">{game.title}</span>
    </Link>
  );
}

function StatBar({ label, valueA, valueB, nameA, nameB, format }: {
  label: string;
  valueA: number | null;
  valueB: number | null;
  nameA: string;
  nameB: string;
  format?: (v: number) => string;
}) {
  const a = valueA ?? 0;
  const b = valueB ?? 0;
  const max = Math.max(a, b, 1);
  const fmt = format || ((v: number) => String(v));

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs w-16 truncate text-right">{nameA}</span>
          <Progress value={(a / max) * 100} className="flex-1 h-2" />
          <span className="text-xs font-medium w-12">{fmt(a)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-16 truncate text-right">{nameB}</span>
          <Progress value={(b / max) * 100} className="flex-1 h-2" />
          <span className="text-xs font-medium w-12">{fmt(b)}</span>
        </div>
      </div>
    </div>
  );
}

function ExpandableGameList({ games, title, emptyMsg }: { games: ComparisonGame[]; title: string; emptyMsg: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? games : games.slice(0, 6);

  if (games.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">{emptyMsg}</p>;
  }

  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground mb-1">{title} ({games.length})</h4>
      <div className="grid grid-cols-1 gap-0.5">
        {shown.map((g, i) => <GameThumbnail key={i} game={g} />)}
      </div>
      {games.length > 6 && (
        <Button variant="ghost" size="sm" className="w-full mt-1 text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? <><ChevronUp className="h-3 w-3 mr-1" />Show less</> : <><ChevronDown className="h-3 w-3 mr-1" />Show all {games.length}</>}
        </Button>
      )}
    </div>
  );
}

export function LibraryComparison({
  currentUserId, targetUserId,
  currentUserName, targetUserName,
  currentUserAvatar, targetUserAvatar,
  hasTheme, profileBgColor,
}: Props) {
  const { data: comparison, isLoading, error } = useLibraryComparison(currentUserId, targetUserId);

  if (isLoading) {
    return (
      <Card className="backdrop-blur-sm border-border" style={hasTheme && profileBgColor ? { backgroundColor: profileBgColor } : { backgroundColor: 'hsl(var(--card) / 0.9)' }}>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="backdrop-blur-sm border-border" style={hasTheme && profileBgColor ? { backgroundColor: profileBgColor } : { backgroundColor: 'hsl(var(--card) / 0.9)' }}>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <p>Unable to compare libraries. You must follow this user to compare.</p>
        </CardContent>
      </Card>
    );
  }

  if (!comparison) return null;

  const shortA = currentUserName.split(" ")[0];
  const shortB = targetUserName.split(" ")[0];

  return (
    <div className="space-y-4">
      {/* Compatibility Score Hero */}
      <Card className="backdrop-blur-sm border-border overflow-hidden" style={hasTheme && profileBgColor ? { backgroundColor: profileBgColor } : { backgroundColor: 'hsl(var(--card) / 0.9)' }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-center">
              <Avatar className="h-12 w-12 mx-auto border-2 border-primary/30">
                <AvatarImage src={currentUserAvatar || undefined} />
                <AvatarFallback className="text-sm">{shortA[0]}</AvatarFallback>
              </Avatar>
              <p className="text-xs mt-1 font-medium truncate max-w-[80px]">{shortA}</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-display font-bold text-primary">{comparison.compatibility_score}%</div>
              <p className="text-xs text-muted-foreground">Compatibility</p>
            </div>
            <div className="text-center">
              <Avatar className="h-12 w-12 mx-auto border-2 border-secondary/30">
                <AvatarImage src={targetUserAvatar || undefined} />
                <AvatarFallback className="text-sm">{shortB[0]}</AvatarFallback>
              </Avatar>
              <p className="text-xs mt-1 font-medium truncate max-w-[80px]">{shortB}</p>
            </div>
          </div>

          {/* Venn-style summary */}
          <div className="flex justify-center gap-2 text-xs">
            <Badge variant="outline" className="gap-1">
              <span className="text-primary font-bold">{comparison.unique_a_count}</span> only {shortA}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Layers className="h-3 w-3" />
              <span className="font-bold">{comparison.shared_count}</span> shared
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="text-secondary font-bold">{comparison.unique_b_count}</span> only {shortB}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Comparison */}
      <Card className="backdrop-blur-sm border-border" style={hasTheme && profileBgColor ? { backgroundColor: profileBgColor } : { backgroundColor: 'hsl(var(--card) / 0.9)' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Collection Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatBar label="Total Games" valueA={comparison.stats_a.total} valueB={comparison.stats_b.total} nameA={shortA} nameB={shortB} />
          <StatBar label="Avg Weight" valueA={comparison.stats_a.avg_weight} valueB={comparison.stats_b.avg_weight} nameA={shortA} nameB={shortB} format={(v) => v.toFixed(1)} />
          <StatBar label="Avg Playtime" valueA={comparison.stats_a.avg_playtime} valueB={comparison.stats_b.avg_playtime} nameA={shortA} nameB={shortB} format={(v) => `${v}m`} />
          <StatBar label="Total Plays" valueA={comparison.stats_a.total_plays} valueB={comparison.stats_b.total_plays} nameA={shortA} nameB={shortB} />
        </CardContent>
      </Card>

      {/* Play Together Recommendations */}
      {comparison.play_together.length > 0 && (
        <Card className="backdrop-blur-sm border-border" style={hasTheme && profileBgColor ? { backgroundColor: profileBgColor } : { backgroundColor: 'hsl(var(--card) / 0.9)' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-primary" />
              Great to Play Together
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">Games you both own and have played — perfect for your next session!</p>
            <div className="grid grid-cols-1 gap-0.5">
              {comparison.play_together.map((g, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
                  {g.image_url ? (
                    <img src={g.image_url} alt={g.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs flex-shrink-0">🎲</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link to={g.slug ? `/games/${g.slug}` : "#"} className="text-sm font-medium hover:underline truncate block">{g.title}</Link>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      {g.play_time_minutes && <span>{g.play_time_minutes}m</span>}
                      {g.weight && <span>Weight: {g.weight.toFixed(1)}</span>}
                      <span>{g.combined_plays} combined plays</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shared Games */}
      <Card className="backdrop-blur-sm border-border" style={hasTheme && profileBgColor ? { backgroundColor: profileBgColor } : { backgroundColor: 'hsl(var(--card) / 0.9)' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Games in Common
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExpandableGameList games={comparison.shared_games} title="Shared" emptyMsg="No games in common yet!" />
        </CardContent>
      </Card>

      {/* Unique Games */}
      <Card className="backdrop-blur-sm border-border" style={hasTheme && profileBgColor ? { backgroundColor: profileBgColor } : { backgroundColor: 'hsl(var(--card) / 0.9)' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            Unique to Each
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ExpandableGameList games={comparison.unique_a} title={`Only in ${shortA}'s library`} emptyMsg={`${shortA} has no unique games`} />
          <ExpandableGameList games={comparison.unique_b} title={`Only in ${shortB}'s library`} emptyMsg={`${shortB} has no unique games`} />
        </CardContent>
      </Card>
    </div>
  );
}
