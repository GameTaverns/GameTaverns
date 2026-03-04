import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Library, Dice6, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLibraryUrl } from "@/hooks/useTenantUrl";

function useFeaturedLibrary() {
  return useQuery({
    queryKey: ["featured-library"],
    queryFn: async () => {
      const { data: pinned } = await supabase
        .from("library_directory")
        .select("*")
        .eq("slug", "tzolaks-tavern")
        .maybeSingle();

      const library = pinned ?? (await supabase
        .from("library_directory")
        .select("*")
        .eq("is_discoverable", true)
        .order("game_count", { ascending: false })
        .limit(1)
        .maybeSingle()).data;

      if (!library?.id || !library?.slug) return null;

      return { library };
    },
    staleTime: 1000 * 60 * 10,
  });
}

function useEmbeddedLibraryHtml(slug: string | undefined) {
  return useQuery({
    queryKey: ["featured-library-embed", slug],
    queryFn: async () => {
      if (!slug) return "";

      const response = await fetch(`/functions/v1/embed-widget?slug=${encodeURIComponent(slug)}&format=html`);
      if (!response.ok) throw new Error("Failed to load embedded library preview");
      return response.text();
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });
}

export function FeaturedLibrary() {
  const { data, isLoading } = useFeaturedLibrary();
  const slug = data?.library?.slug;
  const { data: embedHtml, isLoading: isEmbedLoading } = useEmbeddedLibraryHtml(slug);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/30 bg-muted/30 p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-[500px] w-full rounded-lg" />
      </div>
    );
  }

  if (!data) return null;

  const { library } = data;
  const libraryUrl = getLibraryUrl(library.slug!, "/");

  return (
    <div className="rounded-2xl border border-secondary/20 bg-gradient-to-br from-secondary/5 to-transparent overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 sm:p-6 border-b border-border/20">
        <div className="flex items-center gap-3 min-w-0">
          {library.logo_url ? (
            <img
              src={library.logo_url}
              alt={library.name || "Library"}
              className="h-10 w-10 rounded-lg object-cover border border-border/30 shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0">
              <Library className="h-5 w-5 text-secondary" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold text-foreground truncate">{library.name}</h3>
              <Badge variant="outline" className="text-[10px] text-secondary border-secondary/30 shrink-0 hidden sm:inline-flex">
                Live Preview
              </Badge>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Dice6 className="h-3 w-3 text-secondary" />
                <strong className="text-foreground">{library.game_count}</strong> games
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 text-secondary" />
                <strong className="text-foreground">{library.member_count}</strong> members
              </span>
            </div>
          </div>
        </div>
        <a href={libraryUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-1.5">
            Open Library
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </a>
      </div>

      <div className="bg-background p-3 sm:p-4">
        {isEmbedLoading ? (
          <Skeleton className="h-[520px] w-full rounded-xl" />
        ) : (
          <div
            className="w-full overflow-hidden rounded-xl border border-border/20"
            dangerouslySetInnerHTML={{ __html: embedHtml || "" }}
          />
        )}
      </div>

      <div className="px-4 sm:px-6 py-3 border-t border-border/20 text-center">
        <p className="text-xs text-muted-foreground">
          Live widget from the real library, embedded directly on this page.
        </p>
      </div>
    </div>
  );
}
