import { ARCHETYPES } from "@/hooks/useCollectionIntelligence";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Brain, Sparkles, Scale } from "lucide-react";
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
            and matching them against archetype trigger lists. Collections with heavier average weight get a scoring bonus
            for strategy-oriented archetypes. If no strong match is found, you default to <strong>The Curator</strong>.
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
              <li>Each archetype has a list of <strong>trigger mechanics</strong>. Every match adds to that archetype's score.</li>
              <li>If an archetype requires a minimum collection weight (complexity), a <strong>1.3× bonus</strong> is applied when your collection meets the threshold.</li>
              <li>The highest-scoring archetype becomes your <strong>primary personality</strong>. The runner-up appears as your <strong>secondary</strong> ("with a dash of…").</li>
              <li>A <strong>confidence score</strong> (0–100%) indicates how strongly your collection aligns with the result.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Archetype cards */}
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
                      {arch.triggers.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[11px] font-normal">
                          {t}
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

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Your personality updates automatically as you add or remove games from your collection.
        </p>
      </div>
    </div>
  );
}
