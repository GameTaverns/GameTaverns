import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { Printer, Search, QrCode, Loader2, Library, Download, Package } from "lucide-react";
import QRCodeLib from "qrcode";

interface GameForPrint {
  id: string;
  title: string;
  slug: string | null;
  image_url: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time: string | null;
  library_id: string;
  copies_owned: number | null;
}

interface GameCopyForPrint {
  id: string;
  game_id: string;
  copy_number: number;
  copy_label: string | null;
  condition: string | null;
  edition: string | null;
  location_room: string | null;
  location_shelf: string | null;
  location_misc: string | null;
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
    QRCodeLib.toCanvas(canvasRef.current, gameUrl, { width: 120, margin: 1, color: { dark: "#1a1008", light: "#ffffff" } }).catch(() => {});
  }, [gameUrl]);

  const playerRange = game.min_players && game.max_players
    ? game.min_players === game.max_players ? `${game.min_players}p` : `${game.min_players}–${game.max_players}p`
    : null;

  return (
    <div className="qr-card border border-gray-300 rounded-lg p-3 flex flex-col items-center gap-2 bg-white break-inside-avoid">
      {showImage && game.image_url && (
        <img src={game.image_url} alt={game.title} className="w-full h-20 object-cover rounded" crossOrigin="anonymous" />
      )}
      <canvas ref={canvasRef} width={120} height={120} className="rounded" aria-label={`QR code for ${game.title}`} />
      <div className="text-center w-full">
        <p className="text-xs font-bold leading-tight line-clamp-2">{game.title}</p>
        {showMeta && (
          <p className="text-[10px] text-gray-500 mt-0.5">
            {[playerRange, game.play_time ? game.play_time : null].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="text-[9px] text-gray-400 mt-0.5 truncate">{gameUrl.replace("https://", "")}</p>
      </div>
    </div>
  );
}

interface CopyQRCardProps {
  game: GameForPrint;
  copy: GameCopyForPrint;
  librarySlug: string;
}

function CopyQRCard({ game, copy, librarySlug }: CopyQRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameUrl = getLibraryUrl(librarySlug, `/game/${game.slug || game.id}?copy=${copy.id}`);
  const copyLabel = copy.copy_label || `Copy #${copy.copy_number}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, gameUrl, { width: 100, margin: 1, color: { dark: "#1a1008", light: "#ffffff" } }).catch(() => {});
  }, [gameUrl]);

  const location = [copy.location_room, copy.location_shelf, copy.location_misc].filter(Boolean).join(" › ");

  return (
    <div className="qr-card border border-gray-300 rounded-lg p-3 flex flex-col items-center gap-1.5 bg-white break-inside-avoid">
      <canvas ref={canvasRef} width={100} height={100} className="rounded" aria-label={`QR code for ${game.title} ${copyLabel}`} />
      <div className="text-center w-full">
        <p className="text-xs font-bold leading-tight line-clamp-2">{game.title}</p>
        <p className="text-[10px] font-medium text-gray-600">{copyLabel}</p>
        {copy.edition && <p className="text-[9px] text-gray-500">{copy.edition}</p>}
        {copy.condition && <p className="text-[9px] text-gray-500">{copy.condition}</p>}
        {location && <p className="text-[9px] text-gray-400 truncate">{location}</p>}
      </div>
    </div>
  );
}

interface LibraryQRCardProps {
  libraryName: string;
  librarySlug: string;
}

function LibraryQRCard({ libraryName, librarySlug }: LibraryQRCardProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const libraryUrl = getLibraryUrl(librarySlug, "/");

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, libraryUrl, { width: 280, margin: 2, color: { dark: "#1a1008", light: "#ffffff" } }).catch(() => {});
  }, [libraryUrl]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const offscreen = document.createElement("canvas");
    offscreen.width = 600;
    offscreen.height = 720;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 600, 720);
    QRCodeLib.toCanvas(offscreen, libraryUrl, { width: 480, margin: 2, color: { dark: "#1a1008", light: "#ffffff" } }).then(() => {
      ctx.fillStyle = "#1a1008";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(libraryName, 300, 520);
      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(t('catalogPrint.scanToView'), 300, 555);
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
      <div className="hidden print:block text-center mb-2">
        <p className="text-sm text-gray-500">{t('catalogPrint.scanToView')}</p>
      </div>
      <div className="border-2 border-gray-200 rounded-2xl p-8 bg-white flex flex-col items-center gap-4 shadow-sm">
        <canvas ref={canvasRef} width={280} height={280} className="rounded-lg" aria-label={`QR code for ${libraryName}`} />
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">{libraryName}</p>
          <p className="text-sm text-gray-500 mt-1">{t('catalogPrint.scanToView')}</p>
          <p className="text-xs text-gray-400 mt-1">{libraryUrl.replace("https://", "")}</p>
        </div>
      </div>
      <div className="no-print flex gap-3">
        <Button variant="outline" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t('catalogPrint.print')}
        </Button>
        <Button className="gap-2" onClick={handleDownload}>
          <Download className="h-4 w-4" />
          {t('catalogPrint.downloadPng')}
        </Button>
      </div>
      <p className="no-print text-xs text-muted-foreground text-center max-w-sm">{t('catalogPrint.postQRCode')}</p>
    </div>
  );
}

export default function CatalogPrint() {
  const { t } = useTranslation();
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
        .select("id, title, slug, image_url, min_players, max_players, play_time, library_id, copies_owned")
        .eq("library_id", library.id)
        .order("title");
      if (error) throw error;
      return data as GameForPrint[];
    },
    enabled: !!library?.id,
  });

  // Fetch all copies for games that have multiple copies
  const multiCopyGameIds = games.filter(g => (g.copies_owned ?? 1) > 1).map(g => g.id);
  const { data: allCopies = [], isLoading: copiesLoading } = useQuery({
    queryKey: ["copies-for-print", library?.id, multiCopyGameIds.join(",")],
    queryFn: async () => {
      if (multiCopyGameIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("game_copies")
        .select("id, game_id, copy_number, copy_label, condition, edition, location_room, location_shelf, location_misc")
        .in("game_id", multiCopyGameIds)
        .order("copy_number");
      if (error) throw error;
      return data as GameCopyForPrint[];
    },
    enabled: multiCopyGameIds.length > 0,
  });

  const filteredGames = search.trim()
    ? games.filter((g) => g.title.toLowerCase().includes(search.toLowerCase()))
    : games;

  const librarySlug = tenantSlug || library?.slug || "";

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => { window.print(); setIsPrinting(false); }, 300);
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #library-qr-print-area, #library-qr-print-area * { visibility: visible; }
          #print-area { position: fixed; left: 0; top: 0; width: 100%; }
          #library-qr-print-area { position: fixed; left: 0; top: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; }
          .no-print { display: none !important; }
          .qr-grid { display: grid !important; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 20px; }
          .qr-card { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>

      <Layout hideSidebar>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="no-print mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">{t('catalogPrint.title')}</h1>
                <p className="text-muted-foreground text-sm">{t('catalogPrint.subtitle')}</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="library" className="no-print">
            <TabsList className="mb-6">
              <TabsTrigger value="library" className="gap-2">
                <Library className="h-4 w-4" />
                {t('catalogPrint.libraryPageQR')}
              </TabsTrigger>
              <TabsTrigger value="catalog" className="gap-2">
                <QrCode className="h-4 w-4" />
                {t('catalogPrint.fullCatalog')}
              </TabsTrigger>
              <TabsTrigger value="copies" className="gap-2" disabled={allCopies.length === 0}>
                <Package className="h-4 w-4" />
                Per-Copy QR ({allCopies.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="library">
              {library && <LibraryQRCard libraryName={library.name || "Game Library"} librarySlug={librarySlug} />}
            </TabsContent>

            <TabsContent value="catalog">
              <div className="bg-muted/40 border border-border rounded-lg p-4 mb-6 space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-48">
                    <Label className="text-sm mb-1.5 block">{t('catalogPrint.searchGames')}</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder={t('catalogPrint.filterByTitle')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch id="show-images" checked={showImages} onCheckedChange={setShowImages} />
                      <Label htmlFor="show-images" className="text-sm cursor-pointer">{t('catalogPrint.showCoverImages')}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="show-meta" checked={showMeta} onCheckedChange={setShowMeta} />
                      <Label htmlFor="show-meta" className="text-sm cursor-pointer">{t('catalogPrint.showPlayerCountTime')}</Label>
                    </div>
                  </div>
                  <Button onClick={handlePrint} disabled={isPrinting || isLoading} className="gap-2">
                    {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    {t('catalogPrint.printSavePDF')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{
                  __html: `${t('catalogPrint.showing')} <strong>${filteredGames.length}</strong> ${t('catalogPrint.of')} ${games.length} ${t('catalogPrint.games')}. ${t('catalogPrint.layoutHint')}`
                }} />
              </div>

              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
                </div>
              ) : filteredGames.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>{search ? t('catalogPrint.noGamesMatch') : t('catalogPrint.noGamesInLibrary')}</p>
                </div>
              ) : (
                <div id="print-area">
                  <div className="hidden print:block mb-4 text-center">
                    <h1 className="text-xl font-bold">{library?.name || "Game Library"} — {t('catalogPrint.catalog')}</h1>
                    <p className="text-xs text-gray-500">{t('catalogPrint.scanQRCode')}</p>
                  </div>
                  <div className="qr-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredGames.map((game) => (
                      <QRCard key={game.id} game={game} showImage={showImages} showMeta={showMeta} librarySlug={librarySlug} />
                    ))}
                  </div>
                  <div className="hidden print:block mt-6 text-center text-xs text-gray-400">
                    {t('catalogPrint.generatedBy')}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="copies">
              <div className="bg-muted/40 border border-border rounded-lg p-4 mb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Individual Copy QR Stickers</h3>
                    <p className="text-xs text-muted-foreground">
                      Print QR codes for each tracked copy. When scanned, identifies the exact copy for checkout/return.
                    </p>
                  </div>
                  <Button onClick={handlePrint} disabled={isPrinting || copiesLoading || allCopies.length === 0} className="gap-2">
                    {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    Print All
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>{allCopies.length}</strong> tracked {allCopies.length === 1 ? "copy" : "copies"} across <strong>{multiCopyGameIds.length}</strong> {multiCopyGameIds.length === 1 ? "game" : "games"}
                </p>
              </div>

              {allCopies.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No individually tracked copies found.</p>
                  <p className="text-xs mt-1">Track copies from a game's detail page (Copies tab) to generate per-copy QR codes.</p>
                </div>
              ) : (
                <div id="print-area">
                  <div className="hidden print:block mb-4 text-center">
                    <h1 className="text-xl font-bold">{library?.name || "Game Library"} — Copy QR Stickers</h1>
                    <p className="text-xs text-gray-500">Scan to identify individual game copies</p>
                  </div>
                  <div className="qr-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {allCopies.map((copy) => {
                      const game = games.find(g => g.id === copy.game_id);
                      if (!game) return null;
                      return <CopyQRCard key={copy.id} game={game} copy={copy} librarySlug={librarySlug} />;
                    })}
                  </div>
                  <div className="hidden print:block mt-6 text-center text-xs text-gray-400">
                    Generated by Game Taverns
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
