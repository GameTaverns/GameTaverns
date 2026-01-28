import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, ExternalLink, Crown, Library } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface LibraryWithOwner {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
  owner_display_name: string | null;
}

export function LibraryManagement() {
  const queryClient = useQueryClient();

  // Fetch all libraries with owner info
  const { data: libraries, isLoading } = useQuery({
    queryKey: ["admin-libraries"],
    queryFn: async () => {
      // Get all libraries
      const { data: libs, error: libsError } = await supabase
        .from("libraries")
        .select("*")
        .order("created_at", { ascending: false });

      if (libsError) throw libsError;

      // Get owner profiles
      const ownerIds = [...new Set(libs?.map((l) => l.owner_id) || [])];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, display_name")
        .in("user_id", ownerIds);

      // Combine data
      const librariesWithOwners: LibraryWithOwner[] = (libs || []).map((lib) => {
        const owner = profiles?.find((p) => p.user_id === lib.owner_id);
        return {
          id: lib.id,
          name: lib.name,
          slug: lib.slug,
          description: lib.description,
          is_active: lib.is_active,
          is_premium: lib.is_premium,
          created_at: lib.created_at,
          owner_display_name: owner?.display_name || "Unknown",
        };
      });

      return librariesWithOwners;
    },
  });

  // Toggle library active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("libraries")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
      toast.success("Library status updated");
    },
    onError: () => {
      toast.error("Failed to update library status");
    },
  });

  // Toggle library premium status
  const togglePremiumMutation = useMutation({
    mutationFn: async ({ id, is_premium }: { id: string; is_premium: boolean }) => {
      const { error } = await supabase
        .from("libraries")
        .update({ is_premium })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
      toast.success("Premium status updated");
    },
    onError: () => {
      toast.error("Failed to update premium status");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-cream">All Libraries ({libraries?.length || 0})</h3>
      </div>

      <div className="rounded-lg border border-wood-medium/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-wood-medium/30 hover:bg-wood-medium/40">
              <TableHead className="text-cream/70">Library</TableHead>
              <TableHead className="text-cream/70">Owner</TableHead>
              <TableHead className="text-cream/70">Created</TableHead>
              <TableHead className="text-cream/70">Status</TableHead>
              <TableHead className="text-cream/70">Premium</TableHead>
              <TableHead className="text-cream/70">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {libraries?.map((library) => (
              <TableRow key={library.id} className="border-wood-medium/30 hover:bg-wood-medium/20">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-wood-medium flex items-center justify-center">
                      <Library className="w-4 h-4 text-secondary" />
                    </div>
                    <div>
                      <div className="text-cream font-medium">{library.name}</div>
                      <div className="text-cream/50 text-sm">/{library.slug}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-cream/70">{library.owner_display_name}</TableCell>
                <TableCell className="text-cream/70">
                  {format(new Date(library.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={library.is_active}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: library.id, is_active: checked })
                      }
                    />
                    <Badge variant={library.is_active ? "default" : "secondary"} className={library.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                      {library.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={library.is_premium}
                      onCheckedChange={(checked) =>
                        togglePremiumMutation.mutate({ id: library.id, is_premium: checked })
                      }
                    />
                    {library.is_premium && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-cream/70 hover:text-cream"
                    asChild
                  >
                    <a href={`/?tenant=${library.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!libraries || libraries.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-cream/50 py-8">
                  No libraries found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
