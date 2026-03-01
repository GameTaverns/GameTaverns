import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Badge } from "@/components/ui/badge";
import { Library } from "lucide-react";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";

interface WhoHasThisProps {
  catalogId: string;
  gameTitle: string;
  clubId?: string;
}

interface OwnerLibrary {
  library_id: string;
  library_name: string;
  library_slug: string;
  is_private: boolean;
}

export function WhoHasThis({ catalogId, gameTitle, clubId }: WhoHasThisProps) {
  const [showAll, setShowAll] = useState(false);

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["who-has-this", catalogId, clubId],
    queryFn: async (): Promise<OwnerLibrary[]> => {
      // 1) Collect all related catalog IDs by bgg_id
      const catalogIds = new Set<string>([catalogId]);
      let bggId: string | null = null;

      const { data: currentCatalog } = await supabase
        .from("game_catalog")
        .select("bgg_id")
        .eq("id", catalogId)
        .maybeSingle();

      if (currentCatalog?.bgg_id) {
        bggId = currentCatalog.bgg_id;
        const { data: relatedCatalogRows } = await supabase
          .from("game_catalog")
          .select("id")
          .eq("bgg_id", bggId);

        for (const row of relatedCatalogRows || []) {
          catalogIds.add(row.id);
        }
      }

      // 2) Find games by catalog_id
      const { data: byCatalog } = await supabase
        .from("games")
        .select("library_id, libraries!inner(id, name, slug, is_active)")
        .in("catalog_id", Array.from(catalogIds))
        .eq("is_expansion", false)
        .eq("ownership_status", "owned");

      // 3) Also find games by bgg_id directly (catches games without catalog_id link)
      let byBggId: any[] = [];
      if (bggId) {
        const { data } = await supabase
          .from("games")
          .select("library_id, libraries!inner(id, name, slug, is_active)")
          .eq("bgg_id", bggId)
          .eq("is_expansion", false)
          .eq("ownership_status", "owned");
        byBggId = data || [];
      }

      // 4) Fetch discoverable settings to determine privacy
      const seen = new Set<string>();
      const results: OwnerLibrary[] = [];
      const allRows = [...(byCatalog || []), ...byBggId];

      // Collect unique library IDs first
      const libIds = new Set<string>();
      for (const row of allRows) {
        const lib = row.libraries as any;
        if (lib?.id) libIds.add(lib.id);
      }

      // Check which libraries are discoverable (public in directory)
      let discoverableSet = new Set<string>();
      if (libIds.size > 0) {
        const { data: dirEntries } = await supabase
          .from("library_directory")
          .select("id")
          .in("id", Array.from(libIds));
        for (const entry of dirEntries || []) {
          discoverableSet.add(entry.id);
        }
      }

      for (const row of allRows) {
        const lib = row.libraries as any;
        if (!lib || seen.has(lib.id)) continue;
        if (lib.is_active === false) continue;
        seen.add(lib.id);
        results.push({
          library_id: lib.id,
          library_name: lib.name,
          library_slug: lib.slug,
          is_private: !discoverableSet.has(lib.id),
        });
      }
      return results;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Checking libraries...</p>;
  }

  if (owners.length === 0) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Library className="h-3 w-3" /> No libraries have this game yet
      </p>
    );
  }

  const publicOwners = owners.filter((o) => !o.is_private);
  const privateCount = owners.filter((o) => o.is_private).length;
  const hiddenCount = Math.max(0, publicOwners.length - 5);
  const visibleOwners = showAll ? publicOwners : publicOwners.slice(0, 5);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium flex items-center gap-1">
        <Library className="h-3 w-3" />
        {owners.length} {owners.length === 1 ? "library has" : "libraries have"} this
      </p>
      <div className="flex flex-wrap gap-1">
        {visibleOwners.map((owner) => (
          <TenantLink
            key={owner.library_id}
            href={getLibraryUrl(owner.library_slug, "/")}
            onClick={(e) => e.stopPropagation()}
            className="inline-block"
          >
            <Badge variant="outline" className="text-[10px] hover:bg-secondary/20 cursor-pointer">
              {owner.library_name}
            </Badge>
          </TenantLink>
        ))}

        {privateCount > 0 && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            +{privateCount} private
          </Badge>
        )}

        {!showAll && hiddenCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAll(true);
            }}
            className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] hover:bg-secondary/20"
          >
            +{hiddenCount} more
          </button>
        )}

        {showAll && hiddenCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAll(false);
            }}
            className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] hover:bg-secondary/20"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

