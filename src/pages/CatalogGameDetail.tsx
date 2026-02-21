import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Users, Clock, Weight, PenTool, Palette, BookOpen, Calendar, Plus, Loader2, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { WhoHasThis } from "@/components/catalog/WhoHasThis";
import { GameImage } from "@/components/games/GameImage";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries } from "@/hooks/useLibrary";
import { useAddFromCatalog } from "@/hooks/useAddFromCatalog";
import { LibraryPickerDialog } from "@/components/catalog/LibraryPickerDialog";
import { useAddWant } from "@/hooks/useTrades";
import { useToast } from "@/hooks/use-toast";


interface CatalogGameFull {
  id: string;
  title: string;
  slug: string | null;
  bgg_id: string | null;
  image_url: string | null;
  additional_images: string[] | null;
  description: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time_minutes: number | null;
  weight: number | null;
  year_published: number | null;
  is_expansion: boolean;
  bgg_url: string | null;
  bgg_community_rating: number | null;
  suggested_age: string | null;
  designers: string[];
  artists: string[];
  mechanics: string[];
  publishers: string[];
  expansions: { id: string; title: string; slug: string | null; image_url: string | null }[];
  parent: { id: string; title: string; slug: string | null } | null;
  community_rating: number | null;
  community_rating_count: number;
}

// URL sanitizer: strip corrupted BGG artifact junk from scraped URLs
function sanitizeBggImageUrl(url: string): string | null {
  if (!url) return null;
  let clean = url
    .replace(/&quot;.*$/i, "")
    .replace(/["');}\s]+$/g, "")
    .trim();
  if (!clean) return null;
  try {
    const p = new URL(clean);
    if (p.protocol !== "https:" && p.protocol !== "http:") return null;
    const path = p.pathname.toLowerCase();
    if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(path) && !path.includes("/pic")) return null;
    return p.toString();
  } catch {
    return null;
  }
}

// Filter out known low-quality tiny BGG image variants
const LOW_QUALITY_BGG_VARIANTS = /__(geeklistimagebar|geeklistimage|square|mt|geeklistimagebar@2x|geeklistimage@2x)|__square@2x/i;

export default function CatalogGameDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: myLibrary } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const addFromCatalog = useAddFromCatalog();
  const addWant = useAddWant();
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [brokenImageUrls, setBrokenImageUrls] = useState<string[]>([]);

  const { data: game, isLoading } = useQuery({
    queryKey: ["catalog-game", slug],
    queryFn: async (): Promise<CatalogGameFull | null> => {
      // Try slug first, then id
      let query = supabase
        .from("game_catalog")
        .select("id, title, slug, bgg_id, image_url, additional_images, description, min_players, max_players, play_time_minutes, weight, year_published, is_expansion, bgg_url, bgg_community_rating, suggested_age, parent_catalog_id")
        .eq("slug", slug!)
        .maybeSingle();

      let { data } = await query;

      if (!data) {
        const byId = await supabase
          .from("game_catalog")
          .select("id, title, slug, bgg_id, image_url, additional_images, description, min_players, max_players, play_time_minutes, weight, year_published, is_expansion, bgg_url, bgg_community_rating, suggested_age, parent_catalog_id")
          .eq("id", slug!)
          .maybeSingle();
        data = byId.data;
      }

      if (!data) return null;

      // Fetch related data in parallel
      const [designersRes, artistsRes, mechanicsRes, publishersRes, expansionsRes, parentRes, ratingsRes] = await Promise.all([
        supabase.from("catalog_designers").select("designer:designers(name)").eq("catalog_id", data.id),
        supabase.from("catalog_artists").select("artist:artists(name)").eq("catalog_id", data.id),
        supabase.from("catalog_mechanics").select("mechanic:mechanics(name)").eq("catalog_id", data.id),
        supabase.from("catalog_publishers").select("publisher:publishers(name)").eq("catalog_id", data.id),
        supabase.from("game_catalog").select("id, title, slug, image_url").eq("parent_catalog_id", data.id).eq("is_expansion", true).order("title"),
        data.parent_catalog_id
          ? supabase.from("game_catalog").select("id, title, slug").eq("id", data.parent_catalog_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("catalog_ratings_summary").select("visitor_average, visitor_count").eq("catalog_id", data.id).maybeSingle(),
      ]);

      const ratingRow = ratingsRes.data;

      return {
        ...data,
        designers: (designersRes.data || []).map((r: any) => r.designer?.name).filter(Boolean),
        artists: (artistsRes.data || []).map((r: any) => r.artist?.name).filter(Boolean),
        mechanics: (mechanicsRes.data || []).map((r: any) => r.mechanic?.name).filter(Boolean),
        publishers: (publishersRes.data || []).map((r: any) => r.publisher?.name).filter(Boolean),
        expansions: expansionsRes.data || [],
        parent: parentRes.data || null,
        community_rating: ratingRow?.visitor_count && ratingRow.visitor_count > 0 ? Number(ratingRow.visitor_average) : null,
        community_rating_count: ratingRow?.visitor_count || 0,
      };
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!game) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-6xl mb-4">🎲</span>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-2">Game not found</h2>
          <p className="text-muted-foreground mb-4">This game doesn't exist in the catalog.</p>
          <Button onClick={() => navigate("/catalog")}>Back to Catalog</Button>
        </div>
      </Layout>
    );
  }

  const playerRange = game.min_players != null && game.max_players != null
    ? game.min_players === game.max_players
      ? `${game.min_players} player${game.min_players !== 1 ? "s" : ""}`
      : `${game.min_players}–${game.max_players} players`
    : null;

  const weightLabel = game.weight != null
    ? game.weight <= 1.5 ? "Light" : game.weight <= 2.5 ? "Medium Light" : game.weight <= 3.5 ? "Medium" : game.weight <= 4.25 ? "Medium Heavy" : "Heavy"
    : null;

  const allCategories = [
    ...(game.mechanics.map(m => ({ label: m, type: "mechanic" }))),
    ...(game.publishers.map(p => ({ label: p, type: "publisher" }))),
  ];

  const DescriptionContent = ({ content }: { content: string | null }) => {
    if (!content) return <p className="text-muted-foreground italic">No description available.</p>;
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (<><hr className="border-border my-6" /><h2 className="font-display text-xl font-semibold text-foreground mt-0 mb-3">{children}</h2></>),
          h3: ({ children }) => (<h3 className="font-display text-lg font-semibold text-foreground mt-4 mb-2">{children}</h3>),
          p: ({ children }) => (<p className="text-muted-foreground leading-relaxed mb-4">{children}</p>),
          strong: ({ children }) => (<strong className="font-semibold text-foreground">{children}</strong>),
          ul: ({ children }) => (<ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4 ml-2">{children}</ul>),
          ol: ({ children }) => (<ol className="list-decimal list-inside space-y-2 text-muted-foreground mb-4 ml-2">{children}</ol>),
          li: ({ children }) => (<li className="leading-relaxed">{children}</li>),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb nav */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ArrowLeft className="h-3 w-3 rotate-180" />
          <Link to="/catalog" className="hover:text-foreground">Catalog</Link>
          {game.mechanics.length > 0 && (
            <>
              <ArrowLeft className="h-3 w-3 rotate-180" />
              <Link
                to={`/catalog/mechanic/${game.mechanics[0].toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="hover:text-foreground"
              >
                {game.mechanics[0]}
              </Link>
            </>
          )}
          <ArrowLeft className="h-3 w-3 rotate-180" />
          <span className="text-foreground line-clamp-1 max-w-[200px]">{game.title}</span>
        </nav>

        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        {/* Parent game link for expansions */}
        {game.is_expansion && game.parent && (
          <div className="mb-4">
            <Link to={`/catalog/${game.parent.slug || game.parent.id}`} className="text-sm text-primary hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Expansion of: {game.parent.title}
            </Link>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          {(() => {
            // Build gallery: primary image + additional, sanitized and deduplicated
            const allImages = Array.from(new Set(
              [game.image_url, ...(game.additional_images || [])]
                .map(u => u ? sanitizeBggImageUrl(u) : null)
                .filter((u): u is string => !!u)
                .filter(u => !LOW_QUALITY_BGG_VARIANTS.test(u))
                .filter(u => !brokenImageUrls.includes(u))
            )).slice(0, 10);

            const safeIndex = Math.min(selectedImageIndex, Math.max(0, allImages.length - 1));

            return (
              <div className="space-y-3">
                {/* Main image */}
                <div className="aspect-[3/2] max-h-[40vh] sm:aspect-[4/3] sm:max-h-[50vh] lg:aspect-square lg:max-h-none overflow-hidden rounded-lg bg-muted card-elevated w-full max-w-md mx-auto lg:max-w-none relative group">
                  {allImages.length > 0 ? (
                    <>
                      <GameImage
                        imageUrl={allImages[safeIndex]}
                        alt={game.title}
                        loading="eager"
                        priority={true}
                        className="h-full w-full object-cover"
                        fallback={
                          <div className="flex h-full items-center justify-center bg-muted">
                            <span className="text-8xl text-muted-foreground/50">🎲</span>
                          </div>
                        }
                      />
                      {allImages.length > 1 && (
                        <>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setSelectedImageIndex(p => p === 0 ? allImages.length - 1 : p - 1)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setSelectedImageIndex(p => p === allImages.length - 1 ? 0 : p + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted">
                      <span className="text-8xl text-muted-foreground/50">🎲</span>
                    </div>
                  )}
                </div>

                {/* Thumbnail strip */}
                {allImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`flex-shrink-0 w-20 h-20 overflow-hidden rounded-lg border-2 transition-all ${
                          safeIndex === idx
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <GameImage
                          imageUrl={img}
                          alt={`${game.title} - Image ${idx + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover bg-muted"
                          fallback={
                            <div className="flex h-full items-center justify-center bg-muted">
                              <span className="text-2xl text-muted-foreground/50">🎲</span>
                            </div>
                          }
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Details */}
          <div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
              {game.title}
            </h1>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-2 mb-4">
              {playerRange && (
                <Badge variant="outline"><Users className="h-3.5 w-3.5 mr-1" />{playerRange}</Badge>
              )}
              {game.play_time_minutes != null && (
                <Badge variant="outline"><Clock className="h-3.5 w-3.5 mr-1" />{game.play_time_minutes} min</Badge>
              )}
              {game.weight != null && (
                <Badge variant="outline"><Weight className="h-3.5 w-3.5 mr-1" />{game.weight.toFixed(1)} – {weightLabel}</Badge>
              )}
              {game.year_published != null && (
                <Badge variant="outline"><Calendar className="h-3.5 w-3.5 mr-1" />{game.year_published}</Badge>
              )}
              {game.bgg_community_rating != null && game.bgg_community_rating > 0 && (
                <Badge variant="secondary">BGG ★ {game.bgg_community_rating.toFixed(1)}</Badge>
              )}
              {game.community_rating != null && (
                <Badge className="bg-primary/20 text-primary border-primary/30">GT ★ {game.community_rating.toFixed(1)} ({game.community_rating_count})</Badge>
              )}
              {game.is_expansion && <Badge variant="default">Expansion</Badge>}
            </div>

            {/* Categories as clickable badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              {allCategories.map((cat, idx) => (
                <Link key={idx} to={`/catalog?filter=${cat.type}&value=${encodeURIComponent(cat.label)}`}>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-sm">
                    {cat.label}
                  </Badge>
                </Link>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {/* Add to Library */}
              {isAuthenticated && (myLibrary || myLibraries.length > 0) && (
                <Button
                  onClick={() => {
                    if (myLibraries.length > 1) {
                      setPickerOpen(true);
                    } else {
                      addFromCatalog.mutate({ catalogId: game.id, libraryId: myLibrary?.id });
                    }
                  }}
                  disabled={addFromCatalog.isPending}
                  className="gap-2"
                >
                  {addFromCatalog.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add to My Library
                </Button>
              )}

              {/* Add to Want List */}
              {isAuthenticated && game.bgg_id && (
                <Button
                  variant="outline"
                  onClick={() => {
                    addWant.mutate(
                      { bgg_id: game.bgg_id!, game_title: game.title },
                      {
                        onSuccess: () => toast({ title: "Added to want list", description: `"${game.title}" added to your trade want list.` }),
                        onError: (err: any) => {
                          const isDuplicate = err?.code === "23505" || err?.message?.includes("duplicate");
                          toast({
                            title: isDuplicate ? "Already on want list" : "Error",
                            description: isDuplicate ? `"${game.title}" is already on your want list.` : "Failed to add to want list.",
                            variant: isDuplicate ? "default" : "destructive",
                          });
                        },
                      }
                    );
                  }}
                  disabled={addWant.isPending}
                  className="gap-2"
                >
                  {addWant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
                  Add to Want List
                </Button>
              )}

              {game.bgg_url && (
                <a href={game.bgg_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                  <ExternalLink className="h-4 w-4" /> View on BoardGameGeek
                </a>
              )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full h-auto flex-wrap gap-1 p-1 mb-4">
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="videos">Videos</TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-0">
                <div className="prose prose-sm max-w-none">
                  <h2 className="font-display text-xl font-semibold mb-4 text-foreground">Description</h2>
                  <DescriptionContent content={game.description} />
                </div>
              </TabsContent>

              <TabsContent value="info" className="mt-0">
                <h2 className="font-display text-xl font-semibold mb-4 text-foreground">Additional Information</h2>
                <Table>
                  <TableBody>
                    {game.play_time_minutes != null && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Play Time</TableCell>
                        <TableCell className="text-foreground">{game.play_time_minutes} minutes</TableCell>
                      </TableRow>
                    )}
                    {playerRange && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Players</TableCell>
                        <TableCell className="text-foreground">{playerRange}</TableCell>
                      </TableRow>
                    )}
                    {game.suggested_age && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Suggested Age</TableCell>
                        <TableCell className="text-foreground">{game.suggested_age}</TableCell>
                      </TableRow>
                    )}
                    {game.weight != null && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Weight</TableCell>
                        <TableCell className="text-foreground">{game.weight.toFixed(2)} / 5 – {weightLabel}</TableCell>
                      </TableRow>
                    )}
                    {game.publishers.length > 0 && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Publisher{game.publishers.length > 1 ? "s" : ""}</TableCell>
                        <TableCell className="text-foreground">{game.publishers.join(", ")}</TableCell>
                      </TableRow>
                    )}
                    {game.designers.length > 0 && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          <span className="flex items-center gap-1"><PenTool className="h-3.5 w-3.5" /> Designer{game.designers.length > 1 ? "s" : ""}</span>
                        </TableCell>
                        <TableCell className="text-foreground">
                          <div className="flex flex-wrap gap-1">
                            {game.designers.map(d => (
                              <Link key={d} to={`/catalog?filter=designer&value=${encodeURIComponent(d)}`}>
                                <Badge variant="outline" className="cursor-pointer hover:bg-accent">{d}</Badge>
                              </Link>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {game.artists.length > 0 && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          <span className="flex items-center gap-1"><Palette className="h-3.5 w-3.5" /> Artist{game.artists.length > 1 ? "s" : ""}</span>
                        </TableCell>
                        <TableCell className="text-foreground">
                          <div className="flex flex-wrap gap-1">
                            {game.artists.map(a => (
                              <Link key={a} to={`/catalog?filter=artist&value=${encodeURIComponent(a)}`}>
                                <Badge variant="outline" className="cursor-pointer hover:bg-accent">{a}</Badge>
                              </Link>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {game.mechanics.length > 0 && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Mechanics</TableCell>
                        <TableCell className="text-foreground">
                          <div className="flex flex-wrap gap-1">
                            {game.mechanics.map(m => (
                              <Link key={m} to={`/catalog?filter=mechanic&value=${encodeURIComponent(m)}`}>
                                <Badge variant="outline" className="cursor-pointer hover:bg-accent">{m}</Badge>
                              </Link>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {game.bgg_community_rating != null && game.bgg_community_rating > 0 && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">BGG Rating</TableCell>
                        <TableCell className="text-foreground">★ {game.bgg_community_rating.toFixed(1)} / 10</TableCell>
                      </TableRow>
                    )}
                    {game.community_rating != null && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">GameTaverns Rating</TableCell>
                        <TableCell className="text-foreground">★ {game.community_rating.toFixed(1)} / 5 ({game.community_rating_count} ratings)</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="videos" className="mt-0">
                <p className="text-muted-foreground text-sm">Community videos coming soon.</p>
              </TabsContent>
            </Tabs>

            {/* Expansions */}
            {game.expansions.length > 0 && (
              <div className="mt-8">
                <h2 className="font-display text-xl font-semibold mb-4 text-foreground">
                  Expansions ({game.expansions.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {game.expansions.map(exp => (
                    <Link key={exp.id} to={`/catalog/${exp.slug || exp.id}`} className="group">
                      <Card className="overflow-hidden card-hover">
                        {exp.image_url ? (
                          <img src={exp.image_url} alt={exp.title} className="w-full h-24 object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-24 bg-muted flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <CardContent className="p-2">
                          <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{exp.title}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Who Has This */}
            <div className="mt-8">
              <WhoHasThis catalogId={game.id} gameTitle={game.title} />
            </div>
          </div>
        </div>
      </div>
      {game && (
        <LibraryPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          libraries={myLibraries}
          onSelect={(libraryId) => {
            addFromCatalog.mutate({ catalogId: game.id, libraryId }, {
              onSettled: () => setPickerOpen(false),
            });
          }}
          isPending={addFromCatalog.isPending}
          gameTitle={game.title}
        />
      )}
    </Layout>
  );
}