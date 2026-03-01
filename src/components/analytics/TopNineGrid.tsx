import { useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useTopNineGames } from "@/hooks/useTopNineGames";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GameImage } from "@/components/games/GameImage";
import { Download, Grid3X3, Share2 } from "lucide-react";
import { toPng } from "html-to-image";
import logoImage from "@/assets/logo.png";

interface TopNineGridProps {
  libraryId: string;
  libraryName?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DEFAULT_BG = { h: "39", s: "45", l: "94" };

/** Strip any trailing '%' and return a plain numeric string */
function clean(val: string | null | undefined, fallback: string): string {
  if (!val) return fallback;
  return val.replace(/%/g, "").trim() || fallback;
}

function useLibraryLightBackground(libraryId: string) {
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

export function TopNineGrid({ libraryId, libraryName }: TopNineGridProps) {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState<number | null>(currentDate.getMonth());
  const gridRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { data: topGames, isLoading } = useTopNineGames({ libraryId, year, month });
  const { data: bg } = useLibraryLightBackground(libraryId);

  const bgHsl = useMemo(() => {
    const h = bg?.h || DEFAULT_BG.h;
    const s = bg?.s || DEFAULT_BG.s;
    const l = bg?.l || DEFAULT_BG.l;
    return {
      bg: `hsl(${h}, ${s}%, ${l}%)`,
      bgHex: hslToHex(Number(h), Number(s), Number(l)),
      card: `hsl(${h}, ${s}%, ${Math.max(Number(l) - 12, 20)}%)`,
      textMain: Number(l) > 60 ? "#2c1810" : "#f5f0e8",
      textSub: Number(l) > 60 ? "#2c1810aa" : "#f5f0e8aa",
      textMuted: Number(l) > 60 ? "#2c181060" : "#f5f0e880",
      borderMuted: Number(l) > 60 ? "#2c181020" : "#f5f0e820",
      cardBg: Number(l) > 60
        ? `hsla(${h}, ${s}%, ${Math.max(Number(l) - 8, 20)}%, 0.5)`
        : `hsla(${h}, ${s}%, ${Math.min(Number(l) + 8, 80)}%, 0.25)`,
    };
  }, [bg]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const periodLabel = month !== null 
    ? `${MONTHS[month]} ${year}` 
    : `${year}`;

  const handleExport = useCallback(async () => {
    if (!gridRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(gridRef.current, {
        backgroundColor: bgHsl.bgHex,
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `top-9-${libraryName || "library"}-${year}${month !== null ? `-${String(month + 1).padStart(2, "0")}` : ""}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [year, month, libraryName, bgHsl.bgHex]);

  const handleShare = useCallback(async () => {
    if (!gridRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(gridRef.current, {
        backgroundColor: bgHsl.bgHex,
        pixelRatio: 2,
        cacheBust: true,
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `top-9-${periodLabel}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `My Top 9 - ${periodLabel}`,
          files: [file],
        });
      } else {
        const link = document.createElement("a");
        link.download = file.name;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Share failed:", err);
      }
    } finally {
      setExporting(false);
    }
  }, [periodLabel, bgHsl.bgHex]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-primary" />
              Top 9
            </CardTitle>
            <CardDescription>Most played games — {periodLabel}</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select 
              value={month !== null ? String(month) : "year"} 
              onValueChange={(val) => setMonth(val === "year" ? null : Number(val))}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="year">Full Year</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(year)} onValueChange={(val) => setYear(Number(val))}>
              <SelectTrigger className="w-[90px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport} 
              disabled={exporting || !topGames?.length}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleShare} 
              disabled={exporting || !topGames?.length}
              className="gap-1"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-1 max-w-md mx-auto">
            {[...Array(9)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : !topGames?.length ? (
          <div className="py-12 text-center text-muted-foreground">
            No games played in {periodLabel}
          </div>
        ) : (
          <div 
            ref={gridRef} 
            className="max-w-md mx-auto p-3 rounded-xl"
            style={{ backgroundColor: bgHsl.bg }}
          >
            <div className="text-center mb-3">
              <h3 className="text-lg font-bold" style={{ color: bgHsl.textMain }}>
                {libraryName ? `${libraryName}'s` : "My"} Top 9
              </h3>
              <p className="text-sm" style={{ color: bgHsl.textSub }}>{periodLabel}</p>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {topGames.map((game, index) => (
                <div
                  key={game.id}
                  className="relative aspect-square rounded-lg overflow-hidden group"
                  style={{ backgroundColor: bgHsl.card }}
                >
                  {game.image_url ? (
                    <GameImage
                      imageUrl={game.image_url}
                      alt={game.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bgHsl.card }}>
                      <span className="text-xs text-center px-1 leading-tight" style={{ color: bgHsl.textMuted }}>
                        {game.title}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5">
                    <p className="text-[10px] sm:text-xs font-semibold text-white leading-tight truncate">
                      {game.title}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-white/70">
                      {game.playCount} play{game.playCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{index + 1}</span>
                  </div>
                </div>
              ))}

              {Array.from({ length: Math.max(0, 9 - topGames.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-square rounded-lg border border-dashed"
                  style={{ borderColor: bgHsl.borderMuted, backgroundColor: bgHsl.cardBg }}
                />
              ))}
            </div>

            <div className="flex items-center justify-end gap-1.5 mt-3 pr-1">
              <img src={logoImage} alt="GameTaverns" className="h-4 w-auto opacity-60" />
              <span className="text-[10px] font-semibold tracking-wide" style={{ color: bgHsl.textMuted }}>GameTaverns</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Convert HSL (degrees, %, %) to hex string for html-to-image */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
