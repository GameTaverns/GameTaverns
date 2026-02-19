import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useCuratedList, useVoteList, useAddListItem, useRemoveListItem, type CuratedListItem } from "@/hooks/useCuratedLists";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Heart, ArrowLeft, Trash2, Medal, Crown } from "lucide-react";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { GameImage } from "@/components/games/GameImage";
import { supabase as sb } from "@/integrations/backend/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function CuratedListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const { data: list, isLoading } = useCuratedList(listId);
  const { user } = useAuth();
  const { tenantSlug } = useTenant();
  const voteList = useVoteList();
  const { toast } = useToast();

  const isOwner = user?.id === list?.user_id;
  const backUrl = tenantSlug ? getLibraryUrl(tenantSlug, "/lists") : "/lists";

  const handleVote = async () => {
    if (!user) { toast({ title: "Sign in to vote", variant: "destructive" }); return; }
    try {
      await voteList.mutateAsync({ listId: listId!, hasVoted: !!list?.user_has_voted });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <Layout><div className="max-w-2xl mx-auto space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div></Layout>;
  }

  if (!list) return <Layout><p className="text-center py-20 text-muted-foreground">List not found.</p></Layout>;

  const authorName = list.author?.display_name ?? list.author?.username ?? "Anonymous";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to={backUrl} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> All Lists
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground">{list.title}</h1>
            {list.description && <p className="text-muted-foreground mt-1 text-sm">{list.description}</p>}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px]">{authorName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span>{authorName}</span>
              <span>· {format(new Date(list.created_at), "MMM d, yyyy")}</span>
            </div>
          </div>
          <Button
            variant={list.user_has_voted ? "default" : "outline"}
            size="sm"
            className="flex-shrink-0"
            onClick={handleVote}
            disabled={voteList.isPending}
          >
            <Heart className={cn("h-4 w-4 mr-1.5", list.user_has_voted && "fill-current")} />
            {list.vote_count}
          </Button>
        </div>

        <div className="space-y-2">
          {(list.items || []).map((item, idx) => (
            <ListItemRow key={item.id} item={item} rank={idx + 1} isOwner={isOwner} listId={list.id} listLibrarySlug={list.library?.slug ?? null} />
          ))}
          {(list.items || []).length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">No games added yet.</p>
          )}
        </div>

        {isOwner && <AddGameRow listId={list.id} nextRank={(list.items?.length ?? 0) + 1} />}
      </div>
    </Layout>
  );
}

function ListItemRow({ item, rank, isOwner, listId, listLibrarySlug }: {
  item: CuratedListItem; rank: number; isOwner: boolean; listId: string; listLibrarySlug?: string | null;
}) {
  const removeItem = useRemoveListItem();
  const { toast } = useToast();
  const gameUrl = item.game?.slug
    ? (listLibrarySlug ? getLibraryUrl(listLibrarySlug, `/game/${item.game.slug}`) : `/game/${item.game.slug}`)
    : "#";

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border transition-colors", rank === 1 ? "bg-secondary/10 border-secondary/30" : "bg-card border-border")}>
      <div className="w-7 flex-shrink-0 text-center">
        {rank === 1 ? <Crown className="h-4 w-4 text-secondary mx-auto" /> :
         rank === 2 ? <Medal className="h-4 w-4 text-muted-foreground mx-auto" /> :
         rank === 3 ? <Medal className="h-4 w-4 text-muted-foreground/60 mx-auto" /> :
         <span className="text-xs text-muted-foreground font-mono">#{rank}</span>}
      </div>
      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-muted">
        {item.game?.image_url && <GameImage imageUrl={item.game.image_url} alt={item.game.title ?? ""} className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <Link to={gameUrl} className="font-medium text-sm hover:text-primary transition-colors truncate block">{item.game?.title ?? "Unknown"}</Link>
        {item.notes && <p className="text-xs text-muted-foreground line-clamp-1">{item.notes}</p>}
      </div>
      {isOwner && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
          onClick={() => removeItem.mutate({ itemId: item.id, listId }, { onError: (e: any) => console.error(e) })}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function AddGameRow({ listId, nextRank }: { listId: string; nextRank: number }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const addItem = useAddListItem();
  const { toast } = useToast();
  const { library } = useTenant();
  const [results, setResults] = useState<{ id: string; title: string; image_url: string | null }[]>([]);
  

  // Simple game search within library
  const search = async (q: string) => {
    setTitle(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await (sb as any).from("games").select("id,title,image_url")
      .ilike("title", `%${q}%`).eq("library_id", library?.id).eq("is_expansion", false).limit(8);
    setResults(data || []);
  };

  const pick = async (game: { id: string; title: string }) => {
    setTitle(game.title);
    setResults([]);
    try {
      await addItem.mutateAsync({ list_id: listId, game_id: game.id, rank: nextRank, notes: notes.trim() || undefined });
      setTitle(""); setNotes("");
      toast({ title: "Game added!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="border border-dashed rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Add a game to this list</p>
      <div className="relative">
        <Input value={title} onChange={(e) => search(e.target.value)} placeholder="Search your library…" />
        {results.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-popover border rounded-lg shadow-lg overflow-hidden">
            {results.map((g) => (
              <button key={g.id} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left text-sm" onClick={() => pick(g)}>
                <div className="w-7 h-7 rounded overflow-hidden bg-muted flex-shrink-0">
                  {g.image_url && <GameImage imageUrl={g.image_url} alt={g.title} className="w-full h-full object-cover" />}
                </div>
                {g.title}
              </button>
            ))}
          </div>
        )}
      </div>
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note about this game…" />
    </div>
  );
}
