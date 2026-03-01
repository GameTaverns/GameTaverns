import { useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useMonthlyStats } from "@/hooks/useMonthlyStats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GameImage } from "@/components/games/GameImage";
import { Download, BarChart3, Share2 } from "lucide-react";
import { toPng } from "html-to-image";
import logoImage from "@/assets/logo.png";

interface MonthlySummaryCardProps {
  libraryId: string;
  libraryName?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DEFAULT_BG = { h: "39", s: "45", l: "94" };

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
        h: data?.theme_background_h || DEFAULT_BG.h,
        s: data?.theme_background_s || DEFAULT_BG.s,
        l: data?.theme_background_l || DEFAULT_BG.l,
      };
    },
    staleTime: 1000 * 60 * 10,
  });
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

export function MonthlySummaryCard({ libraryId, libraryName }: MonthlySummaryCardProps) {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState<number | null>(currentDate.getMonth());
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { data: stats, isLoading } = useMonthlyStats({ libraryId, year, month });
  const { data: bg } = useLibraryLightBackground(libraryId);

  const theme = useMemo(() => {
    const h = bg?.h || DEFAULT_BG.h;
    const s = bg?.s || DEFAULT_BG.s;
    const l = bg?.l || DEFAULT_BG.l;
    const isLight = Number(l) > 60;
    return {
      bg: `hsl(${h}, ${s}%, ${l}%)`,
      bgHex: hslToHex(Number(h), Number(s), Number(l)),
      card: `hsl(${h}, ${Number(s) * 0.6}%, ${isLight ? Math.max(Number(l) - 10, 20) : Math.min(Number(l) + 10, 80)}%)`,
      cardBg: isLight
        ? `hsla(${h}, ${s}%, ${Math.max(Number(l) - 8, 20)}%, 0.6)`
        : `hsla(${h}, ${s}%, ${Math.min(Number(l) + 8, 80)}%, 0.3)`,
      text: isLight ? "#1a1207" : "#f5f0e8",
      textSub: isLight ? "#1a1207bb" : "#f5f0e8bb",
      textMuted: isLight ? "#1a120766" : "#f5f0e888",
      accent: isLight
        ? `hsl(${h}, ${Math.min(Number(s) + 20, 100)}%, 35%)`
        : `hsl(${h}, ${Math.min(Number(s) + 20, 100)}%, 65%)`,
      barColor: isLight
        ? `hsl(${h}, ${Math.min(Number(s) + 15, 100)}%, 55%)`
        : `hsl(${h}, ${Math.min(Number(s) + 15, 100)}%, 60%)`,
    };
  }, [bg]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);
  const periodLabel = month !== null ? `${MONTHS[month]} ${year}` : `${year}`;
  const shortLabel = month !== null ? `${MONTHS[month].slice(0, 3)} ${year}` : `${year}`;

  const handleExport = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: theme.bgHex,
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `summary-${libraryName || "library"}-${year}${month !== null ? `-${String(month + 1).padStart(2, "0")}` : ""}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [year, month, libraryName, theme.bgHex]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: theme.bgHex,
        pixelRatio: 2,
        cacheBust: true,
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `summary-${periodLabel}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `Monthly Summary - ${periodLabel}`, files: [file] });
      } else {
        const link = document.createElement("a");
        link.download = file.name;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error("Share failed:", err);
    } finally {
      setExporting(false);
    }
  }, [periodLabel, theme.bgHex]);

  const maxDaily = useMemo(() => {
    if (!stats?.dailyPlays) return 1;
    return Math.max(1, ...stats.dailyPlays.map(d => d.count));
  }, [stats?.dailyPlays]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Monthly Summary
            </CardTitle>
            <CardDescription>Play statistics — {periodLabel}</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={month !== null ? String(month) : "year"}
              onValueChange={(val) => setMonth(val === "year" ? null : Number(val))}
            >
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="year">Full Year</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(val) => setYear(Number(val))}>
              <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || !stats?.totalPlays} className="gap-1">
              <Download className="h-4 w-4" /><span className="hidden sm:inline">Save</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} disabled={exporting || !stats?.totalPlays} className="gap-1">
              <Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="max-w-lg mx-auto space-y-3">
            <Skeleton className="h-8 w-48 mx-auto" />
            <div className="grid grid-cols-2 gap-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          </div>
        ) : !stats?.totalPlays ? (
          <div className="py-12 text-center text-muted-foreground">
            No games played in {periodLabel}
          </div>
        ) : (
          <div
            ref={cardRef}
            className="max-w-lg mx-auto rounded-xl overflow-hidden"
            style={{ backgroundColor: theme.bg }}
          >
            {/* Two-column layout */}
            <div className="grid grid-cols-[1fr_1fr] gap-0">
              {/* LEFT: Game images */}
              <div className="p-3 space-y-1">
                {/* Header */}
                <div className="mb-2">
                  <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: theme.textMuted }}>
                    #GameTaverns
                  </p>
                  <p className="text-sm font-bold" style={{ color: theme.text }}>
                    {shortLabel}
                  </p>
                </div>

                {/* #1 game - large */}
                {stats.topGames[0] && (
                  <GameTile game={stats.topGames[0]} size="large" theme={theme} />
                )}

                {/* Games 2-3 */}
                <div className="grid grid-cols-2 gap-1">
                  {stats.topGames.slice(1, 3).map(g => (
                    <GameTile key={g.id} game={g} size="small" theme={theme} />
                  ))}
                </div>

                {/* Games 4-5 */}
                <div className="grid grid-cols-2 gap-1">
                  {stats.topGames.slice(3, 5).map(g => (
                    <GameTile key={g.id} game={g} size="small" theme={theme} />
                  ))}
                </div>

                {/* Games 6-7 */}
                <div className="grid grid-cols-2 gap-1">
                  {stats.topGames.slice(5, 7).map(g => (
                    <GameTile key={g.id} game={g} size="small" theme={theme} />
                  ))}
                </div>

                {/* Games 8-9 */}
                <div className="grid grid-cols-2 gap-1">
                  {stats.topGames.slice(7, 9).map(g => (
                    <GameTile key={g.id} game={g} size="small" theme={theme} />
                  ))}
                </div>
              </div>

              {/* RIGHT: Stats */}
              <div className="p-3 space-y-1.5">
                {/* Library name */}
                <div className="text-right mb-2">
                  <p className="text-xs font-bold" style={{ color: theme.accent }}>
                    {libraryName || "My Library"}
                  </p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-1">
                  <StatBox value={stats.totalPlays} label="PLAYS" theme={theme} />
                  <StatBox value={stats.hIndex} label="H-INDEX" theme={theme} />
                  <StatBox value={stats.uniqueGames} label="GAMES" theme={theme} />
                  <StatBox value={stats.newGames} label="NEW" theme={theme} />
                  <StatBox value={stats.totalHours} label="HOURS" theme={theme} />
                  <StatBox value={stats.daysPlayed} label="DAYS" theme={theme} />
                </div>

                {/* Watermark */}
                <div className="flex items-center justify-center gap-1 py-1">
                  <img src={logoImage} alt="GameTaverns" className="h-3 w-auto opacity-50" />
                  <span className="text-[8px] font-semibold tracking-wide" style={{ color: theme.textMuted }}>
                    GameTaverns
                  </span>
                </div>

                {/* Mini daily chart */}
                <div className="rounded-md p-2" style={{ backgroundColor: theme.cardBg }}>
                  <div className="flex items-end gap-[1px] h-10">
                    {stats.dailyPlays.map((d, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm min-w-[2px]"
                        style={{
                          height: d.count > 0 ? `${Math.max(15, (d.count / maxDaily) * 100)}%` : "2px",
                          backgroundColor: d.count > 0 ? theme.barColor : `${theme.textMuted}33`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Categories */}
                {stats.topCategories.length > 0 && (
                  <div className="rounded-md p-2" style={{ backgroundColor: theme.cardBg }}>
                    <p className="text-[9px] font-bold mb-1" style={{ color: theme.textSub }}>
                      TOP CATEGORIES
                    </p>
                    {stats.topCategories.map((cat, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="text-[9px] truncate mr-2" style={{ color: theme.textSub }}>
                          {cat.name}
                        </span>
                        <span className="text-[9px] font-semibold tabular-nums" style={{ color: theme.text }}>
                          {cat.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────── Sub-components ───────── */

interface GameTileProps {
  game: { id: string; title: string; image_url: string | null; playCount: number };
  size: "large" | "small";
  theme: { card: string; text: string; textSub: string };
}

function GameTile({ game, size, theme }: GameTileProps) {
  const height = size === "large" ? "h-28" : "h-20";
  return (
    <div className={`relative ${height} rounded-lg overflow-hidden`} style={{ backgroundColor: theme.card }}>
      {game.image_url ? (
        <GameImage imageUrl={game.image_url} alt={game.title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-1">
          <span className="text-[10px] text-center leading-tight" style={{ color: theme.textSub }}>
            {game.title}
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-1.5">
        <p className="text-[9px] font-semibold text-white leading-tight truncate">{game.title}</p>
      </div>
      {/* Play count badge */}
      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
        <span className="text-[9px] font-bold text-white">{game.playCount}</span>
      </div>
    </div>
  );
}

interface StatBoxProps {
  value: number;
  label: string;
  theme: { cardBg: string; text: string; textMuted: string };
}

function StatBox({ value, label, theme }: StatBoxProps) {
  return (
    <div className="rounded-md px-2 py-1.5 text-center" style={{ backgroundColor: theme.cardBg }}>
      <p className="text-lg font-bold leading-tight" style={{ color: theme.text }}>{value}</p>
      <p className="text-[8px] font-semibold tracking-wider" style={{ color: theme.textMuted }}>{label}</p>
    </div>
  );
}
