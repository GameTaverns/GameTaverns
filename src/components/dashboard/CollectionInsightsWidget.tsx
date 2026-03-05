import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Share2, Brain, Dices, BookX, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useCollectionIntelligence } from "@/hooks/useCollectionIntelligence";

interface Props {
  libraryId: string | undefined;
}

export function CollectionInsightsWidget({ libraryId }: Props) {
  const { data: intelligence, isLoading } = useCollectionIntelligence(libraryId || null);

  if (isLoading || !intelligence) return null;

  const { personality, mechanicDNA, totalGames, shelfOfShamePercent, weightLabel, avgWeight } = intelligence;
  const topMechanics = mechanicDNA.slice(0, 3);

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/5 border-primary/20 overflow-hidden relative">
      {/* Decorative glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/5 blur-2xl" />
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Your Collection DNA
          </CardTitle>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
            Full Insights <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Personality hero */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50">
          <span className="text-3xl">{personality.archetype.emoji}</span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
              {personality.archetype.name}
              <Link to="/archetypes" className="text-muted-foreground hover:text-primary transition-colors" title="How is this determined?">
                <Info className="h-3.5 w-3.5" />
              </Link>
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
              {personality.archetype.description}
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-card/50 border border-border/30">
            <Dices className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
            <p className="text-lg font-bold text-foreground">{totalGames}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Games</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-card/50 border border-border/30">
            <Brain className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
            <p className="text-lg font-bold text-foreground">{avgWeight > 0 ? avgWeight.toFixed(1) : "—"}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{weightLabel}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-card/50 border border-border/30">
            <BookX className="h-3.5 w-3.5 mx-auto mb-0.5 text-destructive" />
            <p className="text-lg font-bold text-foreground">{shelfOfShamePercent}%</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Unplayed</p>
          </div>
        </div>

        {/* Top mechanics */}
        {topMechanics.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Top Mechanics</p>
            {topMechanics.map((m) => (
              <div key={m.name} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-20 truncate text-right">{m.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${m.percentage}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground w-6 text-right">{m.percentage}%</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
          <Share2 className="h-3.5 w-3.5" />
          View & Share Your Full Collection DNA
        </Button>
      </CardContent>
    </Card>
  );
}
