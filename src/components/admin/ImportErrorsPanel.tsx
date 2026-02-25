import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Trash2, Search, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ImportItemError {
  id: string;
  job_id: string;
  item_title: string | null;
  bgg_id: string | null;
  error_reason: string;
  error_category: string;
  raw_input: Record<string, unknown> | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  not_found: { label: "Not Found", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  missing_title: { label: "Missing Title", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  create_failed: { label: "Create Failed", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  already_exists: { label: "Already Exists", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  exception: { label: "Exception", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  unknown: { label: "Unknown", color: "bg-muted text-muted-foreground border-muted" },
};

export function ImportErrorsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: errors, isLoading, refetch } = useQuery({
    queryKey: ["import-item-errors", categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("import_item_errors" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("error_category", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ImportItemError[];
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("import_item_errors" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-item-errors"] });
      toast({ title: "All import errors cleared" });
    },
    onError: (err) => {
      toast({ title: "Failed to clear errors", description: String(err), variant: "destructive" });
    },
  });

  const deleteOneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("import_item_errors" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-item-errors"] });
    },
  });

  const filtered = (errors || []).filter((e) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (e.item_title && e.item_title.toLowerCase().includes(term)) ||
      (e.bgg_id && e.bgg_id.includes(term)) ||
      e.error_reason.toLowerCase().includes(term)
    );
  });

  const categoryCounts = (errors || []).reduce<Record<string, number>>((acc, e) => {
    acc[e.error_category] = (acc[e.error_category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card className="border-wood-medium/30 bg-wood-dark/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-cream">Import Item Errors</CardTitle>
                <CardDescription className="text-cream/50">
                  Individual games that failed during bulk imports
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5 text-xs border-wood-medium/40">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
              {(errors?.length || 0) > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs border-red-500/30 text-red-400">
                      <Trash2 className="h-3 w-3" />
                      Clear All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all import errors?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete {errors?.length} error records. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive" onClick={() => deleteAllMutation.mutate()}>
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Summary badges */}
          {Object.keys(categoryCounts).length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={`text-xs cursor-pointer ${categoryFilter === "all" ? "bg-secondary/20 text-secondary border-secondary/40" : "border-wood-medium/30 text-cream/50"}`}
                onClick={() => setCategoryFilter("all")}
              >
                All ({errors?.length || 0})
              </Badge>
              {Object.entries(categoryCounts).map(([cat, count]) => {
                const config = CATEGORY_LABELS[cat] || CATEGORY_LABELS.unknown;
                return (
                  <Badge
                    key={cat}
                    variant="outline"
                    className={`text-xs cursor-pointer ${categoryFilter === cat ? config.color : "border-wood-medium/30 text-cream/50"}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {config.label} ({count})
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream/40" />
            <Input
              placeholder="Search by title, BGG ID, or error..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs bg-wood-dark/60 border-wood-medium/30"
            />
          </div>

          {/* Error list */}
          {isLoading ? (
            <div className="text-sm text-cream/50 py-8 text-center">Loading errors...</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-cream/50 py-8 text-center">
              {errors?.length === 0 ? "No import errors recorded yet. Errors from future imports will appear here." : "No matches for your search."}
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                {filtered.map((err) => {
                  const catConfig = CATEGORY_LABELS[err.error_category] || CATEGORY_LABELS.unknown;
                  const isExpanded = expandedId === err.id;
                  return (
                    <div
                      key={err.id}
                      className="p-3 rounded-lg bg-wood-medium/10 border border-wood-medium/20 hover:border-wood-medium/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : err.id)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-cream">
                              {err.item_title || "Unknown Game"}
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${catConfig.color}`}>
                              {catConfig.label}
                            </Badge>
                            {err.bgg_id && (
                              <a
                                href={`https://boardgamegeek.com/boardgame/${err.bgg_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-secondary/70 hover:text-secondary flex items-center gap-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                BGG #{err.bgg_id}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-cream/50 line-clamp-1">{err.error_reason}</p>
                          <p className="text-[10px] text-cream/30 mt-1">
                            {new Date(err.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-cream/30 hover:text-cream"
                            onClick={() => setExpandedId(isExpanded ? null : err.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-cream/30 hover:text-destructive"
                            onClick={() => deleteOneMutation.mutate(err.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-wood-medium/20 space-y-2">
                          <div>
                            <p className="text-[11px] font-medium text-cream/50 uppercase tracking-wider mb-1">Full Error</p>
                            <p className="text-xs text-cream/70">{err.error_reason}</p>
                          </div>
                          {err.raw_input && (
                            <div>
                              <p className="text-[11px] font-medium text-cream/50 uppercase tracking-wider mb-1">Raw Input</p>
                              <pre className="text-[10px] text-cream/50 bg-black/30 p-2 rounded-lg overflow-x-auto max-h-40 font-mono">
                                {JSON.stringify(err.raw_input, null, 2)}
                              </pre>
                            </div>
                          )}
                          <div className="text-[10px] text-cream/30">
                            Job ID: {err.job_id}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
