import { useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Share2, Sparkles, Brain, Users, Calendar, Dices, Diamond } from "lucide-react";
import { toBlob } from "html-to-image";
import logoImage from "@/assets/logo.png";
import { useCollectionIntelligence, type CollectionIntelligence } from "@/hooks/useCollectionIntelligence";
import { toast } from "@/hooks/use-toast";

interface Props {
  libraryId: string;
  libraryName?: string;
}

const DEFAULT_BG = { h: "39", s: "45", l: "94" };

function clean(val: string | null | undefined, fallback: string): string {
  if (!val) return fallback;
  return val.replace(/%/g, "").trim() || fallback;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function useLibraryTheme(libraryId: string) {
  return useQuery({
    queryKey: ["library-light-bg", libraryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("library_settings")
        .select("theme_background_h, theme_background_s, theme_background_l")
        .eq("library_id", libraryId)
        .maybeSingle();
      return {
        h: clean(data?.theme_background_h, DEFAULT_BG.h),
        s: clean(data?.theme_background_s, DEFAULT_BG.s),
        l: clean(data?.theme_background_l, DEFAULT_BG.l),
      };
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function CollectionInsightsCard({ libraryId, libraryName }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const { data: intelligence, isLoading } = useCollectionIntelligence(libraryId);
  const { data: bg } = useLibraryTheme(libraryId);

  const theme = useMemo(() => {
    const h = Number(bg?.h || DEFAULT_BG.h);
    const s = Number(bg?.s || DEFAULT_BG.s);
    const l = Number(bg?.l || DEFAULT_BG.l);
    const isLight = l > 60;
    return {
      bg: `hsl(${h}, ${s}%, ${l}%)`,
      bgHex: hslToHex(h, s, l),
      card: isLight
        ? `hsla(${h}, ${Math.round(s * 0.6)}%, ${Math.max(l - 8, 20)}%, 0.55)`
        : `hsla(${h}, ${s}%, ${Math.min(l + 8, 80)}%, 0.25)`,
      text: isLight ? "#1a1207" : "#f5f0e8",
      textSub: isLight ? "#1a1207bb" : "#f5f0e8bb",
      textMuted: isLight ? "#1a120766" : "#f5f0e888",
      accent: isLight
        ? `hsl(${h}, ${Math.min(s + 25, 100)}%, 38%)`
        : `hsl(${h}, ${Math.min(s + 25, 100)}%, 65%)`,
      barColor: isLight
        ? `hsl(${h}, ${Math.min(s + 15, 100)}%, 50%)`
        : `hsl(${h}, ${Math.min(s + 15, 100)}%, 60%)`,
      barBg: isLight ? `hsla(${h}, ${s}%, 50%, 0.12)` : `hsla(${h}, ${s}%, 60%, 0.12)`,
      accentGlow: isLight
        ? `hsla(${h}, ${Math.min(s + 30, 100)}%, 45%, 0.15)`
        : `hsla(${h}, ${Math.min(s + 30, 100)}%, 55%, 0.2)`,
    };
  }, [bg]);

  const captureCardBlob = useCallback(async () => {
    if (!cardRef.current) return null;
    return toBlob(cardRef.current, {
      backgroundColor: theme.bgHex,
      pixelRatio: 2,
      cacheBust: true,
      style: {
        width: "480px",
        maxWidth: "none",
        margin: "0",
      },
    });
  }, [theme.bgHex]);

  const downloadBlob = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await captureCardBlob();
      if (!blob) throw new Error("Could not capture image");
      downloadBlob(blob, `collection-dna-${libraryName || "library"}.png`);
      toast({ title: "Image downloaded" });
    } catch (err) {
      console.error("Export failed:", err);
      toast({ title: "Download failed", description: "Please try again." });
    } finally {
      setExporting(false);
    }
  }, [captureCardBlob, downloadBlob, libraryName]);

  const handleShare = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await captureCardBlob();
      if (!blob) throw new Error("Could not capture image");
      const file = new File([blob], "collection-dna.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `My Collection DNA — ${libraryName || "My Library"}`, files: [file] });
        return;
      }

      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast({ title: "Image copied", description: "Paste it anywhere to share." });
        return;
      }

      downloadBlob(blob, `collection-dna-${libraryName || "library"}.png`);
      toast({ title: "Desktop fallback used", description: "Native image sharing isn’t available here, so we downloaded it." });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Share failed:", err);
        toast({ title: "Share failed", description: "Please try again." });
      }
    } finally {
      setExporting(false);
    }
  }, [captureCardBlob, downloadBlob, libraryName]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Collection DNA</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-80" /></CardContent>
      </Card>
    );
  }

  if (!intelligence) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Add games to discover your Collection DNA.</CardContent>
      </Card>
    );
  }

  const { personality, mechanicDNA, avgWeight, weightLabel, shelfOfShamePercent, shelfOfShameCount, totalGames, totalExpansions, sweetSpotPlayers, decadeSpread, rarity } = intelligence;
  const topMechanics = mechanicDNA.slice(0, 8);
  const maxMechanicPct = topMechanics.length > 0 ? Math.max(...topMechanics.map(m => m.percentage)) : 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Collection DNA
            </CardTitle>
            <CardDescription>Your gaming personality & collection intelligence</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-1">
              <Download className="h-4 w-4" /><span className="hidden sm:inline">Save</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} disabled={exporting} className="gap-1">
              <Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={cardRef}
          className="w-[480px] max-w-full mx-auto rounded-2xl overflow-hidden"
          style={{ backgroundColor: theme.bg }}
        >
          {/* Hero: Gaming Personality */}
          <div className="p-5 pb-3 text-center" style={{ background: `linear-gradient(135deg, ${theme.accentGlow}, transparent)` }}>
            <div className="text-4xl mb-1">{personality.archetype.emoji}</div>
            <h3 className="text-xl font-extrabold tracking-tight" style={{ color: theme.text }}>
              {personality.archetype.name}
            </h3>
            <p className="text-[11px] max-w-[280px] mx-auto mt-1 leading-snug" style={{ color: theme.textSub }}>
              {personality.archetype.description}
            </p>
            {personality.secondaryArchetype && (
              <p className="text-[10px] mt-2 font-semibold" style={{ color: theme.textMuted }}>
                with a dash of {personality.secondaryArchetype.emoji} {personality.secondaryArchetype.name}
              </p>
            )}
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-4 gap-0 px-3 py-2">
            <StatPill icon="🎲" value={totalGames} label="Games" theme={theme} />
            <StatPill icon="📦" value={totalExpansions} label="Expansions" theme={theme} />
            <StatPill icon="👥" value={sweetSpotPlayers} label="Sweet Spot" theme={theme} />
            <StatPill icon="⚖️" value={avgWeight > 0 ? avgWeight.toFixed(1) : "—"} label={weightLabel} theme={theme} />
          </div>

          {/* Mechanic DNA bars */}
          <div className="px-4 py-2">
            <p className="text-[9px] font-bold tracking-widest uppercase mb-2" style={{ color: theme.textMuted }}>
              MECHANIC DNA
            </p>
            <div className="space-y-1">
              {topMechanics.map((m) => (
                <div key={m.name} className="flex items-center gap-2">
                  <span className="text-[9px] w-[100px] truncate text-right flex-shrink-0" style={{ color: theme.textSub }}>
                    {m.name}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.barBg }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(4, (m.percentage / maxMechanicPct) * 100)}%`,
                        backgroundColor: theme.barColor,
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-bold w-[28px] text-right tabular-nums" style={{ color: theme.text }}>
                    {m.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Shelf of Shame + Decades */}
          <div className="grid grid-cols-2 gap-2 px-4 py-2">
            {/* Shelf of Shame gauge */}
            <div className="rounded-xl p-2.5" style={{ backgroundColor: theme.card }}>
              <p className="text-[8px] font-bold tracking-wider mb-1" style={{ color: theme.textMuted }}>SHELF OF SHAME</p>
              <div className="flex items-end gap-1.5">
                <span className="text-2xl font-black leading-none" style={{ color: shelfOfShamePercent > 50 ? "#ef4444" : shelfOfShamePercent > 25 ? "#f59e0b" : theme.accent }}>
                  {shelfOfShamePercent}%
                </span>
                <span className="text-[9px] pb-0.5" style={{ color: theme.textSub }}>
                  ({shelfOfShameCount} games)
                </span>
              </div>
              <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ backgroundColor: theme.barBg }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${shelfOfShamePercent}%`,
                    backgroundColor: shelfOfShamePercent > 50 ? "#ef4444" : shelfOfShamePercent > 25 ? "#f59e0b" : theme.barColor,
                  }}
                />
              </div>
            </div>

            {/* Decade mini-chart */}
            <div className="rounded-xl p-2.5" style={{ backgroundColor: theme.card }}>
              <p className="text-[8px] font-bold tracking-wider mb-1" style={{ color: theme.textMuted }}>DECADES</p>
              {decadeSpread.length > 0 ? (
                <div className="flex items-end gap-[2px] h-8">
                  {decadeSpread.map((d) => {
                    const maxD = Math.max(...decadeSpread.map(x => x.count));
                    return (
                      <div key={d.decade} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className="w-full rounded-t-sm"
                          style={{
                            height: `${Math.max(3, (d.count / maxD) * 100)}%`,
                            backgroundColor: theme.barColor,
                            minHeight: "2px",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[9px]" style={{ color: theme.textMuted }}>No year data</p>
              )}
              {decadeSpread.length > 0 && (
                <div className="flex justify-between mt-0.5">
                  <span className="text-[6px]" style={{ color: theme.textMuted }}>{decadeSpread[0]?.decade}</span>
                  <span className="text-[6px]" style={{ color: theme.textMuted }}>{decadeSpread[decadeSpread.length - 1]?.decade}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rarity & Uniqueness */}
          {rarity && (rarity.uniqueGamesCount > 0 || rarity.rareGamesCount > 0) && (
            <div className="px-4 py-2">
              <p className="text-[9px] font-bold tracking-widest uppercase mb-2" style={{ color: theme.textMuted }}>
                COLLECTION RARITY
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-2.5" style={{ backgroundColor: theme.card }}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">💎</span>
                    <p className="text-[8px] font-bold tracking-wider" style={{ color: theme.textMuted }}>UNIQUE TO YOU</p>
                  </div>
                  <span className="text-2xl font-black leading-none" style={{ color: theme.accent }}>
                    {rarity.uniqueGamesCount}
                  </span>
                  <p className="text-[8px] mt-0.5" style={{ color: theme.textSub }}>
                    {rarity.uniqueGamesCount === 1 ? "game nobody else has" : "games nobody else has"}
                  </p>
                </div>
                <div className="rounded-xl p-2.5" style={{ backgroundColor: theme.card }}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">✨</span>
                    <p className="text-[8px] font-bold tracking-wider" style={{ color: theme.textMuted }}>RARE FINDS</p>
                  </div>
                  <span className="text-2xl font-black leading-none" style={{ color: theme.accent }}>
                    {rarity.rareGamesCount}
                  </span>
                  <p className="text-[8px] mt-0.5" style={{ color: theme.textSub }}>
                    owned by ≤3 collectors
                  </p>
                </div>
              </div>
              {/* Rare game names */}
              {(rarity.uniqueGames.length > 0 || rarity.rareGames.length > 0) && (
                <div className="mt-2 space-y-0.5">
                  {rarity.uniqueGames.slice(0, 3).map(g => (
                    <div key={g.title} className="flex items-center gap-1.5">
                      <span className="text-[8px]">💎</span>
                      <span className="text-[9px] truncate" style={{ color: theme.text }}>{g.title}</span>
                      <span className="text-[8px] ml-auto flex-shrink-0 font-bold" style={{ color: theme.accent }}>Only you!</span>
                    </div>
                  ))}
                  {rarity.rareGames.slice(0, 2).map(g => (
                    <div key={g.title} className="flex items-center gap-1.5">
                      <span className="text-[8px]">✨</span>
                      <span className="text-[9px] truncate" style={{ color: theme.text }}>{g.title}</span>
                      <span className="text-[8px] ml-auto flex-shrink-0" style={{ color: theme.textSub }}>{g.ownerCount} owners</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs font-bold" style={{ color: theme.accent }}>
                {libraryName || "My Library"}
              </p>
              <p className="text-[9px]" style={{ color: theme.textMuted }}>#CollectionDNA</p>
            </div>
            <div className="flex items-center gap-1.5">
              <img src={logoImage} alt="GameTaverns" className="h-4 w-auto opacity-60" crossOrigin="anonymous" />
              <span className="text-[10px] font-semibold tracking-wide" style={{ color: theme.textMuted }}>GameTaverns</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Helper ─── */
function StatPill({ icon, value, label, theme }: { icon: string; value: string | number; label: string; theme: any }) {
  return (
    <div className="text-center py-1">
      <span className="text-sm">{icon}</span>
      <p className="text-base font-extrabold leading-tight" style={{ color: theme.text }}>{value}</p>
      <p className="text-[7px] font-semibold tracking-wider uppercase" style={{ color: theme.textMuted }}>{label}</p>
    </div>
  );
}
