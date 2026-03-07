import { useTranslation } from "react-i18next";
import { ARCHETYPES } from "@/hooks/useCollectionIntelligence";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Brain, Sparkles, Scale, Gamepad2, Library } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ArchetypesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 mb-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {t('common.back')}
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t('archetypes.title')}</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl leading-relaxed" dangerouslySetInnerHTML={{ __html: t('archetypes.intro') }} />
        </div>

        {/* How it works */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> {t('archetypes.howItWorks')}
            </h2>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              <li dangerouslySetInnerHTML={{ __html: t('archetypes.step1') }} />
              <li dangerouslySetInnerHTML={{ __html: t('archetypes.step2') }} />
              <li dangerouslySetInnerHTML={{ __html: t('archetypes.step3') }} />
              <li dangerouslySetInnerHTML={{ __html: t('archetypes.step4') }} />
              <li dangerouslySetInnerHTML={{ __html: t('archetypes.step5') }} />
            </ol>
          </CardContent>
        </Card>

        {/* Shelf vs Play explanation */}
        <Card className="mb-8 border-border/50">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" /> {t('archetypes.shelfVsPlay')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('archetypes.shelfVsPlayIntro')}</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-card border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Library className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm text-foreground">{t('archetypes.shelf')}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t('archetypes.shelfDesc')}</p>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Gamepad2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm text-foreground">{t('archetypes.playStyle')}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t('archetypes.playStyleDesc')}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm text-foreground">{t('archetypes.blended')}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t('archetypes.blendedDesc')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Archetype cards */}
        <h2 className="text-xl font-bold text-foreground mb-4">{t('archetypes.allArchetypes', { count: ARCHETYPES.length })}</h2>
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

                {arch.triggers.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t('archetypes.triggerMechanics')}</p>
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
                  <p className="text-xs text-muted-foreground italic">{t('archetypes.fallbackArchetype')}</p>
                )}

                {arch.minWeight > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <Scale className="h-3.5 w-3.5" />
                    <span dangerouslySetInnerHTML={{ __html: t('archetypes.weightBonus', { value: arch.minWeight.toFixed(1) }) }} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 rounded-lg bg-card/50 border border-border/30">
          <p className="text-xs text-muted-foreground">
            <strong>⭐ {t('archetypes.legendDefinitive')}</strong> (3× score) &nbsp;·&nbsp;
            <strong>★ {t('archetypes.legendStrong')}</strong> (2× score) &nbsp;·&nbsp;
            <strong>{t('archetypes.legendStandard')}</strong> (1× score)
          </p>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-8">{t('archetypes.footerNote')}</p>
      </div>
    </div>
  );
}
