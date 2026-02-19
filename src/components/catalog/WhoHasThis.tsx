import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Badge } from "@/components/ui/badge";
import { Library } from "lucide-react";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";

interface WhoHasThisProps {
  catalogId: string;
  gameTitle: string;
  clubId?: string; // If provided, scope to club libraries first
}

interface OwnerLibrary {
  library_id: string;
  library_name: string;
  library_slug: string;
}

export function WhoHasThis({ catalogId, gameTitle, clubId }: WhoHasThisProps) {
  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["who-has-this", catalogId, clubId],
    queryFn: async (): Promise<OwnerLibrary[]> => {
      // Find all games linked to this catalog entry, join with libraries
      let query = supabase
        .from("games")
        .select("library_id, libraries!inner(id, name, slug, is_active)")
        .eq("catalog_id", catalogId)
        .eq("is_expansion", false);

      const { data, error } = await query;
      if (error) throw error;

      // Deduplicate by library_id
      const seen = new Set<string>();
      const results: OwnerLibrary[] = [];
      for (const row of data || []) {
        const lib = row.libraries as any;
        if (!lib || seen.has(lib.id)) continue;
        // Only show active (public) libraries
        if (lib.is_active === false) continue;
        seen.add(lib.id);
        results.push({
          library_id: lib.id,
          library_name: lib.name,
          library_slug: lib.slug,
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

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium flex items-center gap-1">
        <Library className="h-3 w-3" /> 
        {owners.length} {owners.length === 1 ? "library has" : "libraries have"} this
      </p>
      <div className="flex flex-wrap gap-1">
        {owners.slice(0, 5).map((owner) => (
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
        {owners.length > 5 && (
          <Badge variant="outline" className="text-[10px]">
            +{owners.length - 5} more
          </Badge>
        )}
      </div>
    </div>
  );
}
