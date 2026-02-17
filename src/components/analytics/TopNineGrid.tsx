import { useRef, useState, useCallback } from "react";
import { useTopNineGames } from "@/hooks/useTopNineGames";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GameImage } from "@/components/games/GameImage";
import { Download, Grid3X3, Share2 } from "lucide-react";
import { toPng } from "html-to-image";
import { format } from "date-fns";

interface TopNineGridProps {
  libraryId: string;
  libraryName?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function TopNineGrid({ libraryId, libraryName }: TopNineGridProps) {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState<number | null>(currentDate.getMonth());
  const gridRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { data: topGames, isLoading } = useTopNineGames({ libraryId, year, month });

  // Generate year options (last 5 years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const periodLabel = month !== null 
    ? `${MONTHS[month]} ${year}` 
    : `${year}`;

  const handleExport = useCallback(async () => {
    if (!gridRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(gridRef.current, {
        backgroundColor: "#1a1207",
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
  }, [year, month, libraryName]);

  const handleShare = useCallback(async () => {
    if (!gridRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(gridRef.current, {
        backgroundColor: "#1a1207",
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
        // Fallback to download
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
  }, [periodLabel]);

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
          <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
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
            className="max-w-md mx-auto p-4 rounded-xl"
            style={{ backgroundColor: "#1a1207" }}
          >
            {/* Header inside the exportable area */}
            <div className="text-center mb-3">
              <h3 className="text-lg font-bold text-cream">
                {libraryName ? `${libraryName}'s` : "My"} Top {Math.min(topGames.length, 9)}
              </h3>
              <p className="text-sm text-cream/60">{periodLabel}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {topGames.map((game, index) => (
                <div
                  key={game.id}
                  className="relative aspect-square rounded-lg overflow-hidden bg-wood-dark/50 group"
                >
                  {game.image_url ? (
                    <GameImage
                      imageUrl={game.image_url}
                      alt={game.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-wood-medium/30">
                      <span className="text-xs text-cream/50 text-center px-1 leading-tight">
                        {game.title}
                      </span>
                    </div>
                  )}
                  {/* Overlay with rank and play count */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5">
                    <p className="text-[10px] sm:text-xs font-semibold text-white leading-tight truncate">
                      {game.title}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-white/70">
                      {game.playCount} play{game.playCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {/* Rank badge */}
                  <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{index + 1}</span>
                  </div>
                </div>
              ))}

              {/* Fill empty slots if fewer than 9 */}
              {Array.from({ length: Math.max(0, 9 - topGames.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-square rounded-lg bg-wood-dark/20 border border-dashed border-cream/10"
                />
              ))}
            </div>

            {/* Footer watermark */}
            <p className="text-center text-[9px] text-cream/30 mt-2">GameTaverns</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
