import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { useTenant } from "@/contexts/TenantContext";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Printer, Download, Search, QrCode, Loader2 } from "lucide-react";
import { toast } from "sonner";
import QRCodeLib from "qrcode";
import { useEffect } from "react";

interface GameForPrint {
  id: string;
  title: string;
  slug: string | null;
  image_url: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time: string | null;
  library_id: string;
}

interface QRCardProps {
  game: GameForPrint;
  showImage: boolean;
  showMeta: boolean;
  librarySlug: string;
}

function QRCard({ game, showImage, showMeta, librarySlug }: QRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameUrl = getLibraryUrl(librarySlug, `/game/${game.slug || game.id}`);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, gameUrl, {
      width: 120,
      margin: 1,
      color: { dark: "#1a1008", light: "#ffffff" },
    }).catch(() => {});
  }, [gameUrl]);

  const playerRange = game.min_players && game.max_players
    ? game.min_players === game.max_players
      ? `${game.min_players}p`
      : `${game.min_players}–${game.max_players}p`
    : null;

  return (
    <div className="qr-card border border-gray-300 rounded-lg p-3 flex flex-col items-center gap-2 bg-white break-inside-avoid">
      {showImage && game.image_url && (
        <img
          src={game.image_url}
          alt={game.title}
          className="w-full h-20 object-cover rounded"
          crossOrigin="anonymous"
        />
      )}
      <canvas ref={canvasRef} width={120} height={120} className="rounded" />
      <div className="text-center w-full">
        <p className="text-xs font-bold leading-tight line-clamp-2">{game.title}</p>
        {showMeta && (
        <p className="text-[10px] text-gray-500 mt-0.5">
            {[playerRange, game.play_time ? game.play_time : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <p className="text-[9px] text-gray-400 mt-0.5 truncate">{gameUrl.replace("https://", "")}</p>
      </div>
    </div>
  );
}

export default function CatalogPrint() {
  const { library, tenantSlug } = useTenant();
  const [search, setSearch] = useState("");
  const [showImages, setShowImages] = useState(true);
  const [showMeta, setShowMeta] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["games-for-print", library?.id],
    queryFn: async () => {
      if (!library?.id) return [];
      const { data, error } = await supabase
        .from("games_public")
        .select("id, title, slug, image_url, min_players, max_players, play_time, library_id")
        .eq("library_id", library.id)
        .order("title");
      if (error) throw error;
      return data as GameForPrint[];
    },
    enabled: !!library?.id,
  });

  const filteredGames = search.trim()
    ? games.filter((g) => g.title.toLowerCase().includes(search.toLowerCase()))
    : games;

  const librarySlug = tenantSlug || library?.slug || "";

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  return (
    <>
      {/* Print styles injected globally */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print { display: none !important; }
          .qr-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            padding: 20px;
          }
          .qr-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <Layout hideSidebar>
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Header — no-print */}
          <div className="no-print mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">QR Catalog Printout</h1>
                <p className="text-muted-foreground text-sm">
                  Print QR codes for your entire game catalog. Post them on a wall or attach to game boxes.
                </p>
              </div>
            </div>
          </div>

          {/* Controls — no-print */}
          <div className="no-print bg-muted/40 border border-border rounded-lg p-4 mb-6 space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-48">
                <Label className="text-sm mb-1.5 block">Search games</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter by title..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch id="show-images" checked={showImages} onCheckedChange={setShowImages} />
                  <Label htmlFor="show-images" className="text-sm cursor-pointer">Show cover images</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="show-meta" checked={showMeta} onCheckedChange={setShowMeta} />
                  <Label htmlFor="show-meta" className="text-sm cursor-pointer">Show player count / time</Label>
                </div>
              </div>

              <Button onClick={handlePrint} disabled={isPrinting || isLoading} className="gap-2">
                {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Print / Save as PDF
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Showing <strong>{filteredGames.length}</strong> of {games.length} games.{" "}
              Use your browser's Print dialog and set <strong>Layout: Landscape</strong> for best results.
              Save as PDF to share digitally.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <QrCode className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{search ? "No games match your search." : "No games in this library yet."}</p>
            </div>
          ) : (
            <div id="print-area">
              {/* Print header */}
              <div className="hidden print:block mb-4 text-center">
                <h1 className="text-xl font-bold">{library?.name || "Game Library"} — Catalog</h1>
                <p className="text-xs text-gray-500">Scan any QR code to view game details</p>
              </div>

              <div className="qr-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredGames.map((game) => (
                  <QRCard
                    key={game.id}
                    game={game}
                    showImage={showImages}
                    showMeta={showMeta}
                    librarySlug={librarySlug}
                  />
                ))}
              </div>

              {/* Print footer */}
              <div className="hidden print:block mt-6 text-center text-xs text-gray-400">
                Generated by GameTaverns · gametaverns.app
              </div>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
