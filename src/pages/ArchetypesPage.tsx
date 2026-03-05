import { ARCHETYPES } from "@/hooks/useCollectionIntelligence";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Brain, Sparkles, Scale, Gamepad2, Library } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ArchetypesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 mb-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Gaming Personality Archetypes</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            Your Gaming Personality is determined by analyzing the <strong>mechanics</strong> of every game in your collection
            and matching them against archetype trigger lists. The result is <strong>play-weighted</strong> — games you actually play
            count more than shelf decorations.
          </p>
        </div>

        {/* How it works */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> How It Works
            </h2>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              <li>We scan every base game in your library and look up its <strong>mechanics</strong> from the catalog.</li>
              <li>Each archetype has <strong>weighted trigger mechanics</strong>. Definitive triggers (⭐⭐⭐) score 3×, strong triggers (⭐⭐) score 2×, and standard triggers score 1×.</li>
              <li>If an archetype requires a minimum collection weight (complexity), a <strong>1.3× bonus</strong> is applied when your collection meets the threshold.</li>
              <li>
                <strong>Play-log weighting:</strong> Games you've actually played get boosted (1 play = 2×, 10 plays = 3.5×).
                Unplayed games receive a <strong>0.5× penalty</strong>.
              </li>
              <li>The highest-scoring archetype becomes your <strong>primary personality</strong>. The runner-up appears as your <strong>secondary</strong>.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Shelf vs Play explanation */}
        <Card className="mb-8 border-border/50">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" /> Shelf vs. Play Style
            </h2>
            <p className="text-sm text-muted-foreground">
              Your Collection DNA shows three perspectives:
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-card border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Library className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm text-foreground">Shelf</span>
                </div>
                <p className="text-xs text-muted-foreground">Based purely on what you own. Every game counts equally.</p>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Gamepad2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm text-foreground">Play Style</span>
                </div>
                <p className="text-xs text-muted-foreground">Based only on games with logged sessions. Reflects what you actually enjoy.</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm text-foreground">Blended</span>
                </div>
                <p className="text-xs text-muted-foreground">The primary result. Played games boosted, unplayed games penalized. Best of both worlds.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Archetype cards */}
        <h2 className="text-xl font-bold text-foreground mb-4">All {ARCHETYPES.length} Archetypes</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {ARCHETYPES.map((arch) => (
            <Card key={arch.id} className="overflow-hidden border-border/50 hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-4xl">{arch.emoji}</span>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{arch.name}</h3>
                    <p className="text-sm text-muted-foreground leading-snug">{arch.description}</p>
                  </div>
                </div>

                {/* Triggers */}
                {arch.triggers.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Trigger Mechanics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {arch.triggers.map((trigger) => (
                        <Badge
                          key={trigger.mechanic}
                          variant={trigger.weight >= 3 ? "default" : "secondary"}
                          className={`text-[11px] font-normal ${trigger.weight >= 3 ? "bg-primary/20 text-primary border-primary/30" : trigger.weight >= 2 ? "bg-accent/50" : ""}`}
                        >
                          {trigger.mechanic}
                          {trigger.weight >= 3 && " ⭐"}
                          {trigger.weight === 2 && " ★"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Fallback archetype — assigned when no other archetype scores strongly.
                  </p>
                )}

                {/* Min weight */}
                {arch.minWeight > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <Scale className="h-3.5 w-3.5" />
                    <span>Weight bonus when collection avg ≥ <strong className="text-foreground">{arch.minWeight.toFixed(1)}</strong></span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 rounded-lg bg-card/50 border border-border/30">
          <p className="text-xs text-muted-foreground">
            <strong>⭐ Definitive trigger</strong> (3× score) &nbsp;·&nbsp;
            <strong>★ Strong trigger</strong> (2× score) &nbsp;·&nbsp;
            <strong>Standard trigger</strong> (1× score)
          </p>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Your personality updates automatically as you add games or log play sessions. Monthly snapshots track how your personality evolves over time.
        </p>
      </div>
    </div>
  );
}
