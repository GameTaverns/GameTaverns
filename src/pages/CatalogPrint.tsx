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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Search, QrCode, Loader2, Library, Download } from "lucide-react";
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

interface LibraryQRCardProps {
  libraryName: string;
  librarySlug: string;
}

function LibraryQRCard({ libraryName, librarySlug }: LibraryQRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const libraryUrl = getLibraryUrl(librarySlug, "/");

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, libraryUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#1a1008", light: "#ffffff" },
    }).catch(() => {});
  }, [libraryUrl]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Create a larger version for download
    const offscreen = document.createElement("canvas");
    offscreen.width = 600;
    offscreen.height = 720;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 600, 720);

    QRCodeLib.toCanvas(offscreen, libraryUrl, {
      width: 480,
      margin: 2,
      color: { dark: "#1a1008", light: "#ffffff" },
    }).then(() => {
      // Add title text below
      ctx.fillStyle = "#1a1008";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(libraryName, 300, 520);
      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("Scan to browse our game library", 300, 555);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(libraryUrl.replace("https://", ""), 300, 585);

      const link = document.createElement("a");
      link.download = `${librarySlug}-qr-code.png`;
      link.href = offscreen.toDataURL("image/png");
      link.click();
    }).catch(() => {});
  };

  return (
    <div id="library-qr-print-area" className="flex flex-col items-center gap-6">
      {/* Print-only header */}
      <div className="hidden print:block text-center mb-2">
        <p className="text-sm text-gray-500">Scan to browse our game library</p>
      </div>

      <div className="border-2 border-gray-200 rounded-2xl p-8 bg-white flex flex-col items-center gap-4 shadow-sm">
        <canvas ref={canvasRef} width={280} height={280} className="rounded-lg" />
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">{libraryName}</p>
          <p className="text-sm text-gray-500 mt-1">Scan to browse our game library</p>
          <p className="text-xs text-gray-400 mt-1">{libraryUrl.replace("https://", "")}</p>
        </div>
      </div>

      <div className="no-print flex gap-3">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            const area = document.getElementById("library-qr-print-area");
            if (!area) return;
            window.print();
          }}
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
        <Button className="gap-2" onClick={handleDownload}>
          <Download className="h-4 w-4" />
          Download PNG
        </Button>
      </div>

      <p className="no-print text-xs text-muted-foreground text-center max-w-sm">
        Post this QR code at your physical location, on social media, or anywhere you want visitors to discover your game library.
      </p>
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
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #library-qr-print-area, #library-qr-print-area * { visibility: visible; }
          #print-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
          }
          #library-qr-print-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
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
          {/* Header */}
          <div className="no-print mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">QR Codes</h1>
                <p className="text-muted-foreground text-sm">
                  Print QR codes for your library or individual games.
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="library" className="no-print">
            <TabsList className="mb-6">
              <TabsTrigger value="library" className="gap-2">
                <Library className="h-4 w-4" />
                Library Page QR
              </TabsTrigger>
              <TabsTrigger value="catalog" className="gap-2">
                <QrCode className="h-4 w-4" />
                Full Catalog
              </TabsTrigger>
            </TabsList>

            <TabsContent value="library">
              {library && (
                <LibraryQRCard
                  libraryName={library.name || "Game Library"}
                  librarySlug={librarySlug}
                />
              )}
            </TabsContent>

            <TabsContent value="catalog">
              {/* Controls */}
              <div className="bg-muted/40 border border-border rounded-lg p-4 mb-6 space-y-4">
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

                  <div className="hidden print:block mt-6 text-center text-xs text-gray-400">
                    Generated by GameTaverns · gametaverns.app
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </>
  );
}
