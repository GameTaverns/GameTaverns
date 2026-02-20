import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Database,
  Image,
  Globe,
  Zap,
  Shield,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Trash2,
  Search,
  Radio,
  MessageSquare,
  Users,
  Gamepad2,
  Settings,
  ChevronDown,
  ChevronRight,
  ShieldX,
  Upload,
  Palette,
  Wrench,
  Star,
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getSupabaseConfig } from "@/config/runtime";

interface HealthCheck {
  name: string;
  group: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface ImportJob {
  id: string;
  library_id: string;
  status: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  skipped_items: number;
  import_type: string | null;
  created_at: string;
  updated_at: string;
  libraries?: { name: string } | null;
}

interface HealthData {
  status: string;
  timestamp: string;
  summary: { total: number; healthy: number; degraded: number; down: number };
  checks: HealthCheck[];
  stats: {
    totalGames: number;
    totalLibraries: number;
    totalSessions: number;
    totalUsers: number;
  };
  imports?: {
    active: ImportJob[];
    recent: ImportJob[];
  };
}

interface SystemLog {
  id: string;
  created_at: string;
  level: string;
  source: string;
  message: string;
  metadata: Record<string, unknown>;
  library_id: string | null;
  user_id: string | null;
}

interface ScraperState {
  next_bgg_id: number;
  total_processed: number;
  total_added: number;
  total_skipped: number;
  total_errors: number;
  is_enabled: boolean;
  last_run_at: string | null;
  last_error: string | null;
  catalog_count: number;
}

const statusColors: Record<string, string> = {
  healthy: "text-green-400",
  degraded: "text-yellow-400",
  down: "text-red-400",
  unknown: "text-muted-foreground",
};

const statusBgColors: Record<string, string> = {
  healthy: "bg-green-500/10 border-green-500/30",
  degraded: "bg-yellow-500/10 border-yellow-500/30",
  down: "bg-red-500/10 border-red-500/30",
  unknown: "bg-muted/10 border-muted/30",
};

const groupMeta: Record<string, { label: string; icon: typeof Database }> = {
  core: { label: "Core Infrastructure", icon: Database },
  external: { label: "External Services", icon: Globe },
  auth: { label: "Auth & Security", icon: Shield },
  games: { label: "Game Operations", icon: Gamepad2 },
  social: { label: "Social & Communication", icon: MessageSquare },
  discord: { label: "Discord Integration", icon: Radio },
  admin: { label: "Library & Admin", icon: Settings },
};

const levelColors: Record<string, string> = {
  debug: "bg-muted text-muted-foreground",
  info: "bg-blue-500/20 text-blue-400",
  warn: "bg-yellow-500/20 text-yellow-400",
  error: "bg-red-500/20 text-red-400",
};

async function fetchHealth(): Promise<HealthData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { url: supabaseUrl, anonKey } = getSupabaseConfig();
  const url = `${supabaseUrl}/functions/v1/system-health?action=health`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
  });

  if (!r.ok) throw new Error(`Health check failed: ${r.status}`);
  return r.json();
}

async function fetchLogs(params: { source?: string; level?: string; limit?: number }): Promise<SystemLog[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const searchParams = new URLSearchParams({ action: "logs" });
  if (params.source) searchParams.set("source", params.source);
  if (params.level) searchParams.set("level", params.level);
  if (params.limit) searchParams.set("limit", String(params.limit));

  const { url: supabaseUrl, anonKey } = getSupabaseConfig();
  const url = `${supabaseUrl}/functions/v1/system-health?${searchParams}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
  });

  if (!r.ok) throw new Error(`Logs fetch failed: ${r.status}`);
  const data = await r.json();
  return data.logs;
}

// Small status dot for compact view
function StatusDot({ status }: { status: string }) {
  const color = status === "healthy" ? "bg-green-400" : status === "degraded" ? "bg-yellow-400" : status === "down" ? "bg-red-400" : "bg-muted-foreground";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function GroupCard({ group, checks }: { group: string; checks: HealthCheck[] }) {
  const [expanded, setExpanded] = useState(false);
  const meta = groupMeta[group] || { label: group, icon: Zap };
  const GroupIcon = meta.icon;

  const downCount = checks.filter(c => c.status === "down").length;
  const degradedCount = checks.filter(c => c.status === "degraded").length;
  const allHealthy = downCount === 0 && degradedCount === 0;

  const groupStatus = downCount > 0 ? "down" : degradedCount > 0 ? "degraded" : "healthy";
  const avgLatency = Math.round(checks.reduce((s, c) => s + c.latencyMs, 0) / checks.length);

  return (
    <Card className={`border ${statusBgColors[groupStatus]}`}>
      <CardContent className="p-0">
        <button
          className="w-full flex items-center justify-between p-4 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <GroupIcon className="h-5 w-5 text-cream/70" />
            <div>
              <span className="font-medium text-cream text-sm">{meta.label}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusDot status={groupStatus} />
                <span className="text-xs text-cream/50">
                  {checks.length} services · avg {avgLatency}ms
                </span>
                {!allHealthy && (
                  <span className="text-xs text-red-400">
                    {downCount > 0 && `${downCount} down`}
                    {downCount > 0 && degradedCount > 0 && ", "}
                    {degradedCount > 0 && `${degradedCount} degraded`}
                  </span>
                )}
              </div>
            </div>
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-cream/50" />
          ) : (
            <ChevronRight className="h-4 w-4 text-cream/50" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-wood-medium/20 px-4 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-2">
              {checks.map((check) => (
                <div
                  key={check.name}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-wood-medium/10"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={check.status} />
                    <span className="text-xs text-cream/80 truncate">{check.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {check.message && (
                      <span className="text-xs text-cream/40 truncate max-w-[120px]" title={check.message}>
                        {check.message}
                      </span>
                    )}
                    <span className="text-xs text-cream/40 font-mono w-12 text-right">{check.latencyMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LogEntry({ log }: { log: SystemLog }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(log.created_at);

  return (
    <div
      className="px-3 py-2 hover:bg-wood-medium/20 cursor-pointer border-b border-wood-medium/20 last:border-0"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 text-sm">
        <Badge className={`${levelColors[log.level] || levelColors.info} text-xs px-1.5 py-0`}>
          {log.level}
        </Badge>
        <span className="text-cream/50 text-xs font-mono whitespace-nowrap">
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </span>
        <Badge variant="outline" className="text-xs border-wood-medium/60 text-cream/60">
          {log.source}
        </Badge>
        <span className="text-cream/80 text-xs truncate flex-1">{log.message}</span>
      </div>
      {expanded && log.metadata && Object.keys(log.metadata).length > 0 && (
        <pre className="mt-2 text-xs text-cream/50 bg-wood-dark/50 rounded p-2 overflow-x-auto">
          {JSON.stringify(log.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Fetch Specific BGG IDs Component ──────────────────────────────────────
function FetchSpecificBggIds() {
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<{ bgg_id: number; title?: string; status: string; error?: string }[] | null>(null);

  const fetchMutation = useMutation({
    mutationFn: async (bggIds: number[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-scraper`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "fetch_ids", bgg_ids: bggIds }),
      });
      if (!r.ok) throw new Error(`Failed: ${r.status}`);
      return r.json();
    },
    onSuccess: (data) => {
      setResults(data.results || []);
      toast.success(`Done: ${data.added} added, ${data.updated} updated, ${data.errors} errors`);
    },
    onError: (e: Error) => toast.error(`Fetch failed: ${e.message}`),
  });

  const handleFetch = () => {
    const ids = inputValue
      .split(/[\s,]+/)
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n > 0);
    if (ids.length === 0) { toast.error("Enter at least one valid BGG ID"); return; }
    if (ids.length > 100) { toast.error("Max 100 IDs at once"); return; }
    setResults(null);
    fetchMutation.mutate(ids);
  };

  return (
    <div className="border border-wood-medium/30 rounded-lg p-3 space-y-2">
      <div className="text-xs font-medium text-cream/70">Fetch Specific BGG IDs</div>
      <div className="text-xs text-cream/40">
        Backfill games the scraper has already passed. Enter BGG IDs separated by commas or spaces.{" "}
        <span className="text-cream/50">e.g. <code className="bg-wood-medium/30 px-1 rounded">230802, 167355</code> for Azul &amp; Azul Mini</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleFetch()}
          placeholder="230802, 167355, 266192..."
          className="flex-1 h-8 px-3 text-xs bg-wood-medium/20 border border-wood-medium/40 rounded text-cream placeholder:text-cream/30 focus:outline-none focus:border-secondary"
        />
        <Button
          size="sm"
          className="text-xs h-8 px-3"
          onClick={handleFetch}
          disabled={fetchMutation.isPending || !inputValue.trim()}
        >
          {fetchMutation.isPending ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Fetching…</> : "Fetch"}
        </Button>
      </div>
      {results && results.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {results.map(r => (
            <div key={r.bgg_id} className="flex items-center gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.status === "added" ? "bg-green-500" : r.status === "updated" ? "bg-blue-400" : r.status === "not_found" ? "bg-yellow-500" : "bg-red-500"}`} />
              <span className="text-cream/60 font-mono w-16 flex-shrink-0">{r.bgg_id}</span>
              <span className="text-cream/80 truncate">{r.title || "—"}</span>
              <span className={`flex-shrink-0 ${r.status === "added" ? "text-green-400" : r.status === "updated" ? "text-blue-300" : r.status === "not_found" ? "text-yellow-400" : "text-red-400"}`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

export function SystemHealth() {
  const [logSource, setLogSource] = useState<string>("all");
  const [logLevel, setLogLevel] = useState<string>("all");
  const [logSearch, setLogSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const queryClient = useQueryClient();

  const healthQuery = useQuery({
    queryKey: ["system-health"],
    queryFn: fetchHealth,
    refetchInterval: autoRefresh ? 30000 : false,
    retry: 1,
  });

  const logsQuery = useQuery({
    queryKey: ["system-logs", logSource, logLevel],
    queryFn: () =>
      fetchLogs({
        source: logSource === "all" ? undefined : logSource,
        level: logLevel === "all" ? undefined : logLevel,
        limit: 200,
      }),
    refetchInterval: autoRefresh ? 15000 : false,
    retry: 1,
  });

  const cancelImportMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("import_jobs")
        .update({ status: "failed", error_message: "Manually cancelled by admin" })
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Import job cancelled");
      healthQuery.refetch();
    },
    onError: (e: Error) => toast.error(`Failed to cancel: ${e.message}`),
  });

  const cleanupMutation = useMutation({
    mutationFn: async (days: number) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const url = `${supabaseUrl}/functions/v1/system-health?action=cleanup&days=${days}`;
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
      });
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(`Cleaned up ${data.deleted || 0} old log entries`);
      logsQuery.refetch();
    },
  });

  // Backfill status query
  interface BackfillStatus {
    total_with_bgg: number;
    enriched: number;
    has_designers: number;
    has_artists: number;
    has_rating: number;
    remaining: number;
    percent: number;
  }

  const backfillStatusQuery = useQuery<BackfillStatus>({
    queryKey: ["catalog-backfill-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-backfill`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "status" }),
      });
      if (!r.ok) throw new Error(`Status check failed: ${r.status}`);
      return r.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
    retry: 1,
  });

  const backfillMutation = useMutation({
    mutationFn: async (mode: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const url = `${supabaseUrl}/functions/v1/catalog-backfill`;
      // Test mode: single request, no loop
      if (mode === "test") {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode: "test" }),
        });
        const data = await r.json();
        return { mode: "test", ...data };
      }

      // Refresh BGG ratings: loops until all entries are processed
      if (mode === "refresh-bgg-ratings") {
        const refreshUrl = `${supabaseUrl}/functions/v1/refresh-ratings`;
        let totalUpdated = 0;
        let totalFailed = 0;
        let totalProcessed = 0;
        let remaining = 1; // start truthy
        let iterations = 0;
        const maxIterations = 100; // safety cap

        while (remaining > 0 && iterations < maxIterations) {
          iterations++;
          const r = await fetch(refreshUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: anonKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ limit: 100 }),
          });
          if (!r.ok) {
            if (r.status >= 500) break; // stop on server errors, return partial
            const err = await r.json().catch(() => ({ error: r.statusText }));
            throw new Error(err.error || r.statusText);
          }
          const data = await r.json();
          totalUpdated += data.updated || 0;
          totalFailed += data.failed || 0;
          totalProcessed += data.processed || 0;
          remaining = data.remaining || 0;

          // If nothing was updated this round, stop to avoid infinite loop
          if ((data.updated || 0) === 0 && (data.processed || 0) === 0) break;

          // Brief pause between batches
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        return {
          mode: "refresh-bgg-ratings",
          updated: totalUpdated,
          failed: totalFailed,
          processed: totalProcessed,
          remaining,
          iterations,
        };
      }

      const batchSize = mode === "sync-ratings" ? 50 : 5;
      let offset = 0;
      let totalProcessed = 0;
      let totalDesigners = 0;
      let totalArtists = 0;
      let totalLinked = 0;
      let totalRatingsUpdated = 0;
      let hasMore = true;
      const allErrors: string[] = [];

      while (hasMore) {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode, batch_size: batchSize, offset }),
        });
        if (!r.ok) {
          // On timeout/520, stop looping but return partial results instead of throwing
          if (r.status >= 500) {
            console.warn(`[catalog-backfill] Server error ${r.status} at offset ${offset}, returning partial results`);
            allErrors.push(`Server ${r.status} at offset ${offset} — restart backfill to continue from here`);
            hasMore = false;
            break;
          }
          const err = await r.json().catch(() => ({ error: r.statusText }));
          throw new Error(err.error || r.statusText);
        }
        const data = await r.json();
        totalProcessed += data.processed || 0;
        totalDesigners += data.designersAdded || 0;
        totalArtists += data.artistsAdded || 0;
        totalLinked += data.linked || 0;
        totalRatingsUpdated += data.ratingsUpdated || 0;
        if (data.errors?.length) allErrors.push(...data.errors);
        hasMore = data.hasMore === true;
        offset = data.nextOffset || offset + batchSize;

        // Show progress toast every batch
        if (hasMore) {
          if (mode === "sync-ratings") {
            toast.info(`Rating sync progress: ${totalProcessed} checked, ${totalRatingsUpdated} updated...`);
          } else {
            const skipped = data.skipped || 0;
            toast.info(`Backfill progress: ${totalProcessed} enriched, ${skipped} already done, ${totalDesigners} designers, ${totalArtists} artists...`);
          }
        }
      }

      return { mode, processed: totalProcessed, designersAdded: totalDesigners, artistsAdded: totalArtists, linked: totalLinked, ratingsUpdated: totalRatingsUpdated, errors: allErrors };
    },
    onSuccess: (data) => {
      if (data.mode === "test") {
        toast.success("BGG test complete — check console for details");
        console.log("[catalog-backfill test]", data);
        return;
      }
      if (data.mode === "refresh-bgg-ratings") {
        toast.success(`BGG ratings refreshed: ${data.updated || 0} updated, ${data.remaining || 0} remaining`);
        return;
      }
      if (data.mode === "sync-ratings") {
        toast.success(`Rating sync complete: ${data.processed} checked, ${data.ratingsUpdated} ratings updated`);
      } else {
        toast.success(`Backfill complete: ${data.processed} processed, ${data.designersAdded} designers, ${data.artistsAdded} artists, ${data.linked} linked`);
      }
      if (data.errors?.length) {
        console.warn("[catalog-backfill errors]", data.errors);
        toast.warning(`Backfill warnings (${data.errors.length}): ${data.errors.slice(0, 5).join(" | ")}`, { duration: 15000 });
      }
      // Refresh status after backfill completes
      queryClient.invalidateQueries({ queryKey: ["catalog-backfill-status"] });
    },
    onError: (e: Error) => toast.error(`Backfill failed: ${e.message}`),
  });

  // Gallery Backfill
  const galleryBackfillMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-gallery-backfill`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 50 }),
      });
      if (!r.ok) throw new Error(`Gallery backfill failed: ${r.status}`);
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(`Gallery backfill: ${data.updated} updated, ${data.skipped} skipped, ${data.remaining || 0} remaining`);
      if (data.remaining > 0) {
        toast.info(`${data.remaining} catalog entries still need gallery images. Run again to continue.`);
      }
    },
    onError: (e: Error) => toast.error(`Gallery backfill failed: ${e.message}`),
  });

  // Catalog Cleanup
  interface CleanupStatus {
    total_with_bgg_id: number;
    unchecked: number;
    verified_boardgames: number;
    not_boardgame: number;
    linked_to_library: number;
  }
  interface CleanupResult {
    dry_run: boolean;
    checked: number;
    deleted: number;
    kept: number;
    errors: number;
    sample_deleted: string[];
  }

  const cleanupStatusQuery = useQuery<CleanupStatus>({
    queryKey: ["catalog-cleanup-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-cleanup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "status" }),
      });
      if (!r.ok) throw new Error(`Status failed: ${r.status}`);
      return r.json();
    },
    retry: 1,
  });

  const cleanupRunMutation = useMutation({
    mutationFn: async ({ dryRun, limit }: { dryRun: boolean; limit: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-cleanup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: dryRun ? "dry_run" : "run", limit }),
      });
      if (!r.ok) throw new Error(`Cleanup failed: ${r.status}`);
      return r.json() as Promise<CleanupResult>;
    },
    onSuccess: (data) => {
      const prefix = data.dry_run ? "[DRY RUN] " : "";
      toast.success(`${prefix}Cleanup: ${data.deleted} deleted, ${data.kept} kept out of ${data.checked} checked`);
      if (data.sample_deleted?.length) {
        console.log("[catalog-cleanup] Deleted entries:", data.sample_deleted);
      }
      queryClient.invalidateQueries({ queryKey: ["catalog-cleanup-status"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-scraper-status"] });
    },
    onError: (e: Error) => toast.error(`Cleanup failed: ${e.message}`),
  });

  // Catalog Scraper

  const scraperQuery = useQuery<ScraperState>({
    queryKey: ["catalog-scraper-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-scraper`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "status" }),
      });
      if (!r.ok) throw new Error(`Status check failed: ${r.status}`);
      return r.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
    retry: 1,
  });

  const scraperToggleMutation = useMutation({
    mutationFn: async (action: "enable" | "disable") => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-scraper`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) throw new Error(`Toggle failed: ${r.status}`);
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(data.is_enabled ? "Catalog scraper enabled" : "Catalog scraper paused");
      queryClient.invalidateQueries({ queryKey: ["catalog-scraper-status"] });
    },
    onError: (e: Error) => toast.error(`Toggle failed: ${e.message}`),
  });

  const scraperResetMutation = useMutation({
    mutationFn: async (nextBggId: number) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-scraper`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "reset", next_bgg_id: nextBggId }),
      });
      if (!r.ok) throw new Error(`Reset failed: ${r.status}`);
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(`Scraper position reset to BGG ID ${data.next_bgg_id}`);
      queryClient.invalidateQueries({ queryKey: ["catalog-scraper-status"] });
    },
    onError: (e: Error) => toast.error(`Reset failed: ${e.message}`),
  });

  const scraperRunOnceMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      // Temporarily enable, run one batch, then check status
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-scraper`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "scrape" }),
      });
      if (!r.ok) throw new Error(`Run failed: ${r.status}`);
      return r.json();
    },
    onSuccess: (data) => {
      if (data.skipped) {
        toast.info("Scraper is disabled — enable it first or use the manual run");
      } else {
        toast.success(`Scraper batch complete: ${data.added} added, ${data.skipped} skipped in range ${data.bgg_id_range}`);
      }
      queryClient.invalidateQueries({ queryKey: ["catalog-scraper-status"] });
    },
    onError: (e: Error) => toast.error(`Run failed: ${e.message}`),
  });

  // Description Formatter
  interface FormatterStatus {
    total_catalog: number;
    total_with_description: number;
    formatted: number;
    unformatted: number;
    no_description: number;
    ai_configured: boolean;
    ai_provider: string | null;
  }

  const formatterQuery = useQuery<FormatterStatus>({
    queryKey: ["catalog-formatter-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-format-descriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "status" }),
      });
      if (!r.ok) throw new Error(`Status check failed: ${r.status}`);
      return r.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
    retry: 1,
  });

  const formatterRunMutation = useMutation({
    mutationFn: async (opts: { batchSize?: number; workers?: number; totalLimit?: number; dryRun?: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url: supabaseUrl, anonKey } = getSupabaseConfig();
      const r = await fetch(`${supabaseUrl}/functions/v1/catalog-format-descriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(opts),
      });
      if (!r.ok) throw new Error(`Format run failed: ${r.status}`);
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(`Formatter: ${data.updated} updated out of ${data.processed} processed`);
      queryClient.invalidateQueries({ queryKey: ["catalog-formatter-status"] });
    },
    onError: (e: Error) => toast.error(`Format run failed: ${e.message}`),
  });

  const filteredLogs = (logsQuery.data || []).filter((log) => {
    if (!logSearch) return true;
    const search = logSearch.toLowerCase();
    return (
      log.message.toLowerCase().includes(search) ||
      log.source.toLowerCase().includes(search) ||
      JSON.stringify(log.metadata).toLowerCase().includes(search)
    );
  });

  const knownSources = ["auth", "games", "sessions", "import", "discord", "system", "achievements", "membership", "messages", "polls", "events", "lending", "bgg", "forum", "clubs"];
  const dynamicSources = (logsQuery.data || []).map((l) => l.source);
  const uniqueSources = [...new Set([...knownSources, ...dynamicSources])].sort();

  // Group checks
  const groupedChecks: Record<string, HealthCheck[]> = {};
  const groupOrder = ["core", "external", "auth", "games", "social", "discord", "admin"];
  for (const check of healthQuery.data?.checks || []) {
    if (!groupedChecks[check.group]) groupedChecks[check.group] = [];
    groupedChecks[check.group].push(check);
  }

  const overallStatus = healthQuery.data?.status || "unknown";
  const overallColor = statusColors[overallStatus] || "text-muted-foreground";
  const summary = healthQuery.data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className={`h-6 w-6 ${overallColor}`} />
          <div>
            <h2 className="text-xl font-display font-bold text-cream">System Health</h2>
            <p className="text-sm text-cream/60">
              {summary
                ? `${summary.total} services: ${summary.healthy} healthy, ${summary.degraded} degraded, ${summary.down} down`
                : "Loading..."}
              {healthQuery.data && (
                <span className="ml-2">
                  · {new Date(healthQuery.data.timestamp).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`text-xs ${autoRefresh ? "bg-green-500/20 border-green-500/50" : ""}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              healthQuery.refetch();
              logsQuery.refetch();
            }}
            disabled={healthQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${healthQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall status bar */}
      {summary && (
        <div className="flex gap-1 h-2 rounded-full overflow-hidden">
          {summary.healthy > 0 && (
            <div className="bg-green-500" style={{ flex: summary.healthy }} title={`${summary.healthy} healthy`} />
          )}
          {summary.degraded > 0 && (
            <div className="bg-yellow-500" style={{ flex: summary.degraded }} title={`${summary.degraded} degraded`} />
          )}
          {summary.down > 0 && (
            <div className="bg-red-500" style={{ flex: summary.down }} title={`${summary.down} down`} />
          )}
        </div>
      )}

      {/* Error state */}
      {healthQuery.isError && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 text-red-400 text-sm">
            Failed to fetch health data: {healthQuery.error?.message}
          </CardContent>
        </Card>
      )}

      {/* Group cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {healthQuery.isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-wood-medium/20 border-wood-medium/40 animate-pulse">
              <CardContent className="p-4 h-20" />
            </Card>
          ))}
        {groupOrder.map((group) =>
          groupedChecks[group] ? (
            <GroupCard key={group} group={group} checks={groupedChecks[group]} />
          ) : null
        )}
      </div>

      {/* Platform Stats */}
      {healthQuery.data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Games", value: healthQuery.data.stats.totalGames },
            { label: "Libraries", value: healthQuery.data.stats.totalLibraries },
            { label: "Play Sessions", value: healthQuery.data.stats.totalSessions },
            { label: "Users", value: healthQuery.data.stats.totalUsers },
          ].map((s) => (
            <Card key={s.label} className="bg-wood-medium/20 border-wood-medium/40">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-cream">{s.value.toLocaleString()}</div>
                <div className="text-xs text-cream/50">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Import Jobs */}
      {healthQuery.data?.imports && (
        <Card className="bg-wood-medium/10 border-wood-medium/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-cream text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Jobs
              {healthQuery.data.imports.active.length > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                  {healthQuery.data.imports.active.length} active
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {healthQuery.data.imports.active.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-cream/80">Active Imports</h4>
                {healthQuery.data.imports.active.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                      <div>
                        <div className="text-sm text-cream font-medium">
                          {job.import_type === "bgg_collection" ? "BGG Collection" : job.import_type === "bgg_links" ? "BGG Links" : "CSV"} Import
                          {job.libraries?.name && (
                            <span className="text-cream/50 font-normal ml-1">— {job.libraries.name}</span>
                          )}
                        </div>
                        <div className="text-xs text-cream/50">
                          {job.processed_items}/{job.total_items} items · Started {new Date(job.created_at).toLocaleDateString()}{' '}{new Date(job.created_at).toLocaleTimeString()}
                          {job.updated_at !== job.created_at && (
                            <span className="ml-1">· Updated {new Date(job.updated_at).toLocaleTimeString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <div className="text-sm font-mono text-cream">
                          {job.total_items > 0 ? Math.round((job.processed_items / job.total_items) * 100) : 0}%
                        </div>
                        <div className="text-xs text-cream/50">
                          {job.successful_items} ok
                          {job.skipped_items > 0 && ` · ${job.skipped_items} existed`}
                          {job.failed_items > 0 && ` · ${job.failed_items} failed`}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelImportMutation.mutate(job.id);
                        }}
                        disabled={cancelImportMutation.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {healthQuery.data.imports.active.length === 0 && (
              <div className="text-sm text-cream/40 text-center py-2">No active imports</div>
            )}

            {healthQuery.data.imports.recent.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-cream/80">Recent Imports</h4>
                <div className="divide-y divide-wood-medium/20">
                  {healthQuery.data.imports.recent.map((job) => (
                    <div key={job.id} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-wood-medium/60 text-cream/60">
                          {job.import_type === "bgg_collection" ? "BGG" : job.import_type === "bgg_links" ? "BGG Links" : "CSV"}
                        </Badge>
                        {job.libraries?.name && (
                          <span className="text-cream/50 truncate max-w-[120px]" title={job.libraries.name}>{job.libraries.name}</span>
                        )}
                        <span className="text-cream/60">
                          {job.successful_items}/{job.total_items} items
                        </span>
                        {job.skipped_items > 0 && (
                          <span className="text-cream/50">{job.skipped_items} existed</span>
                        )}
                        {job.failed_items > 0 && (
                          <span className="text-red-400">{job.failed_items} failed</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${job.status === "completed" ? "bg-green-500/20 text-green-400" : job.status === "processing" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                          {job.status}
                        </Badge>
                        {job.status === "processing" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 h-6 px-1.5 text-xs"
                            onClick={() => cancelImportMutation.mutate(job.id)}
                            disabled={cancelImportMutation.isPending}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        )}
                        <span className="text-cream/40 font-mono whitespace-nowrap" title={`Started: ${new Date(job.created_at).toLocaleString()}\nFinished: ${new Date(job.updated_at).toLocaleString()}`}>
                          {new Date(job.updated_at).toLocaleDateString()}{' '}{new Date(job.updated_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Catalog Scraper */}
      <Card className="bg-wood-medium/10 border-wood-medium/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-secondary" />
              <div>
                <CardTitle className="text-cream text-lg">Catalog Scraper</CardTitle>
                <CardDescription className="text-cream/50">
                  Automated BGG game discovery — adds new games to the catalog
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {scraperQuery.data && (
                <Badge className={scraperQuery.data.is_enabled ? "bg-green-500/20 text-green-400" : "bg-muted/20 text-muted-foreground"}>
                  {scraperQuery.data.is_enabled ? "Active" : "Paused"}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => scraperQuery.refetch()}
                disabled={scraperQuery.isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${scraperQuery.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {scraperQuery.isError && (
            <div className="text-sm text-red-400 p-3 rounded bg-red-500/10 border border-red-500/30">
              Failed to load scraper status: {scraperQuery.error?.message}
            </div>
          )}

          {scraperQuery.data && (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                  <div className="text-lg font-bold text-cream">{scraperQuery.data.catalog_count?.toLocaleString() || "—"}</div>
                  <div className="text-xs text-cream/50">Catalog Total</div>
                </div>
                <div className="p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                  <div className="text-lg font-bold text-cream">{scraperQuery.data.total_added.toLocaleString()}</div>
                  <div className="text-xs text-cream/50">Games Added</div>
                </div>
                <div className="p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                  <div className="text-lg font-bold text-cream">{scraperQuery.data.next_bgg_id.toLocaleString()}</div>
                  <div className="text-xs text-cream/50">Next BGG ID</div>
                </div>
                <div className="p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                  <div className="text-lg font-bold text-cream">{scraperQuery.data.total_processed.toLocaleString()}</div>
                  <div className="text-xs text-cream/50">IDs Scanned</div>
                </div>
              </div>

              {/* Progress info */}
              <div className="flex flex-wrap gap-4 text-xs text-cream/50">
                <span>Skipped: {scraperQuery.data.total_skipped.toLocaleString()}</span>
                <span>Errors: {scraperQuery.data.total_errors.toLocaleString()}</span>
                {scraperQuery.data.last_run_at && (
                  <span>Last run: {new Date(scraperQuery.data.last_run_at).toLocaleString()}</span>
                )}
              </div>

              {scraperQuery.data.last_error && (
                <div className="text-xs text-yellow-400 p-2 rounded bg-yellow-500/10 border border-yellow-500/30 truncate" title={scraperQuery.data.last_error}>
                  Last error: {scraperQuery.data.last_error}
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={scraperQuery.data.is_enabled ? "destructive" : "default"}
                  size="sm"
                  className="text-xs"
                  onClick={() => scraperToggleMutation.mutate(scraperQuery.data!.is_enabled ? "disable" : "enable")}
                  disabled={scraperToggleMutation.isPending}
                >
                  {scraperQuery.data.is_enabled ? (
                    <><Pause className="h-3.5 w-3.5 mr-1" /> Pause Scraper</>
                  ) : (
                    <><Play className="h-3.5 w-3.5 mr-1" /> Enable Scraper</>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => scraperRunOnceMutation.mutate()}
                  disabled={scraperRunOnceMutation.isPending}
                >
                  {scraperRunOnceMutation.isPending ? (
                    <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Running...</>
                  ) : (
                    <><Zap className="h-3.5 w-3.5 mr-1" /> Run Once</>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const id = prompt("Enter BGG ID to jump to:", String(scraperQuery.data!.next_bgg_id));
                    if (id && !isNaN(Number(id))) scraperResetMutation.mutate(Number(id));
                  }}
                  disabled={scraperResetMutation.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Position
                </Button>
              </div>

              {/* Fetch specific BGG IDs */}
              <FetchSpecificBggIds />

              <div className="text-xs text-cream/40">
                Runs every 2 minutes via cron. Each run fetches 10 batches of 20 BGG IDs (10 API calls with ~1.5s delays between).
                At this rate, ~144k IDs/day are scanned. Empty ID ranges are automatically skipped in jumps of 100.
              </div>
            </>
          )}

          {scraperQuery.isLoading && (
            <div className="text-sm text-cream/50 text-center py-4">Loading scraper status...</div>
          )}
        </CardContent>
      </Card>

      {/* Description Formatter */}
      <Card className="bg-wood-medium/10 border-wood-medium/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-secondary" />
              <div>
                <CardTitle className="text-cream text-lg">Description Formatter</CardTitle>
                <CardDescription className="text-cream/50">
                  AI-powered batch formatting — 50 items/call, 3 concurrent workers
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => formatterQuery.refetch()}
              disabled={formatterQuery.isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${formatterQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formatterQuery.isError && (
            <div className="text-sm text-red-400 p-3 rounded bg-red-500/10 border border-red-500/30">
              Failed to load formatter status: {formatterQuery.error?.message}
            </div>
          )}

          {formatterQuery.data && (() => {
            const { formatted, unformatted, total_catalog, total_with_description, no_description, ai_provider } = formatterQuery.data;
            const total = (formatted || 0) + (unformatted || 0);
            const pct = total > 0 ? Math.round(((formatted || 0) / total) * 100) : 0;

            return (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                    <div className="text-lg font-bold text-cream">{(total_catalog || 0).toLocaleString()}</div>
                    <div className="text-xs text-cream/50">Catalog Total</div>
                  </div>
                  <div className="p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                    <div className="text-lg font-bold text-green-400">{(formatted || 0).toLocaleString()}</div>
                    <div className="text-xs text-cream/50">Formatted</div>
                  </div>
                  <div className="p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                    <div className="text-lg font-bold text-yellow-400">{(unformatted || 0).toLocaleString()}</div>
                    <div className="text-xs text-cream/50">Needs Formatting</div>
                  </div>
                  <div className="p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                    <div className="text-lg font-bold text-cream/50">{(no_description || 0).toLocaleString()}</div>
                    <div className="text-xs text-cream/50">No Description</div>
                  </div>
                  <div className="p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                    <div className="text-lg font-bold text-cream">{pct}%</div>
                    <div className="text-xs text-cream/50">Complete</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-wood-medium/30 rounded-full h-2.5">
                  <div
                    className="bg-secondary h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Provider info */}
                <div className="flex flex-wrap gap-4 text-xs text-cream/50">
                  {ai_provider && <span>AI Provider: {ai_provider}</span>}
                  <span>Batch: 50 items/call × 3 workers = 150/min</span>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => formatterRunMutation.mutate({ batchSize: 50, workers: 3, totalLimit: 150 })}
                    disabled={formatterRunMutation.isPending}
                  >
                    {formatterRunMutation.isPending ? (
                      <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Running...</>
                    ) : (
                      <><Zap className="h-3.5 w-3.5 mr-1" /> Run Once</>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => formatterRunMutation.mutate({ batchSize: 5, workers: 1, totalLimit: 5, dryRun: true })}
                    disabled={formatterRunMutation.isPending}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" /> Dry Run (5)
                  </Button>
                </div>

                <div className="text-xs text-cream/40">
                  Runs every minute via cron. Each invocation processes 150 games (3 concurrent API calls of 50 games each).
                  Estimated cost: ~$0.01/invocation. At full speed, formats ~216k games/day.
                </div>
              </>
            );
          })()}

          {formatterQuery.isLoading && (
            <div className="text-sm text-cream/50 text-center py-4">Loading formatter status...</div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Actions */}
      <Card className="bg-wood-medium/10 border-wood-medium/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-cream text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance Actions
          </CardTitle>
          <CardDescription className="text-cream/50">
            One-time data enrichment and cleanup tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-secondary" />
              <div>
                <div className="text-sm text-cream font-medium">Test BGG Connection</div>
                <div className="text-xs text-cream/50">
                  Tests a single BGG API fetch to diagnose connectivity issues. Check browser console for full results.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs shrink-0"
              onClick={() => backfillMutation.mutate("test")}
              disabled={backfillMutation.isPending}
            >
              {backfillMutation.isPending ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Testing...</>
              ) : (
                <><Zap className="h-3.5 w-3.5 mr-1" /> Test</>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40">
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 text-secondary" />
              <div>
                <div className="text-sm text-cream font-medium">Backfill Designers & Artists</div>
                <div className="text-xs text-cream/50">
                  Re-fetches BGG data for all catalog entries to populate designer and artist metadata across all libraries.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => backfillStatusQuery.refetch()}
                disabled={backfillStatusQuery.isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${backfillStatusQuery.isFetching ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => backfillMutation.mutate("enrich")}
                disabled={backfillMutation.isPending}
              >
                {backfillMutation.isPending ? (
                  <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Running...</>
                ) : (
                  <><Palette className="h-3.5 w-3.5 mr-1" /> Run Backfill</>
                )}
              </Button>
            </div>
          </div>

          {/* Backfill Progress */}
          {backfillStatusQuery.data && (() => {
            const s = backfillStatusQuery.data;
            return (
              <div className="ml-8 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="p-2 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                    <div className="text-lg font-bold text-cream">{s.total_with_bgg.toLocaleString()}</div>
                    <div className="text-xs text-cream/50">Total (w/ BGG ID)</div>
                  </div>
                  <div className="p-2 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                    <div className="text-lg font-bold text-green-400">{s.enriched.toLocaleString()}</div>
                    <div className="text-xs text-cream/50">Fully Enriched</div>
                  </div>
                  <div className="p-2 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                    <div className="text-lg font-bold text-yellow-400">{s.remaining.toLocaleString()}</div>
                    <div className="text-xs text-cream/50">Remaining</div>
                  </div>
                  <div className="p-2 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                    <div className="text-lg font-bold text-cream">{s.has_rating.toLocaleString()}</div>
                    <div className="text-xs text-cream/50">Have Rating</div>
                  </div>
                  <div className="p-2 rounded-lg bg-wood-medium/20 border border-wood-medium/40 text-center">
                    <div className="text-lg font-bold text-cream">{s.percent}%</div>
                    <div className="text-xs text-cream/50">Complete</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-wood-medium/30 rounded-full h-2">
                  <div
                    className="bg-secondary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${s.percent}%` }}
                  />
                </div>
                <div className="flex gap-4 text-xs text-cream/50">
                  <span>Has Designers: {s.has_designers.toLocaleString()}</span>
                  <span>Has Artists: {s.has_artists.toLocaleString()}</span>
                  <span>~{Math.ceil(s.remaining / 5)} batches remaining (5/batch, 0.5s delay each)</span>
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-secondary" />
              <div>
                <div className="text-sm text-cream font-medium">Link Games to Catalog</div>
                <div className="text-xs text-cream/50">
                  Links existing games (by BGG ID) to catalog entries and backfills missing catalog data.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs shrink-0"
              onClick={() => backfillMutation.mutate("default")}
              disabled={backfillMutation.isPending}
            >
              {backfillMutation.isPending ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Running...</>
              ) : (
                <><Database className="h-3.5 w-3.5 mr-1" /> Run Link</>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-secondary" />
              <div>
                <div className="text-sm text-cream font-medium">Refresh BGG Ratings</div>
                <div className="text-xs text-cream/50">
                  Fetches BGG community average ratings for catalog entries missing them (30 per batch).
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs shrink-0"
              onClick={() => backfillMutation.mutate("refresh-bgg-ratings")}
              disabled={backfillMutation.isPending}
            >
              {backfillMutation.isPending ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Running...</>
              ) : (
                <><Star className="h-3.5 w-3.5 mr-1" /> Refresh Ratings</>
              )}
            </Button>
          </div>

          {/* Gallery Backfill */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40">
            <div className="flex items-center gap-3">
              <Image className="h-5 w-5 text-secondary" />
              <div>
                <div className="text-sm text-cream font-medium">Backfill Catalog Gallery Images</div>
                <div className="text-xs text-cream/50">
                  Fetches up to 5 gallery images per game from BGG for catalog entries missing <code className="bg-wood-medium/30 px-1 rounded">additional_images</code>.
                  Processes 50 at a time (~300ms delay per game). Run multiple times until 0 remaining.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs shrink-0"
              onClick={() => galleryBackfillMutation.mutate()}
              disabled={galleryBackfillMutation.isPending}
            >
              {galleryBackfillMutation.isPending ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Running...</>
              ) : (
                <><Image className="h-3.5 w-3.5 mr-1" /> Backfill Galleries</>
              )}
            </Button>
          </div>

          {/* Catalog Cleanup */}
          <div className="flex items-start justify-between p-3 rounded-lg bg-wood-medium/20 border border-wood-medium/40 gap-3">
            <div className="flex items-start gap-3">
              <ShieldX className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
              <div>
                <div className="text-sm text-cream font-medium">Clean Up Non-Boardgame Entries</div>
                <div className="text-xs text-cream/50 mb-2">
                  Verifies catalog entries against BGG and removes video games, RPGs, and other non-boardgame items
                  that aren't linked to any user library.
                </div>
                {cleanupStatusQuery.data && (
                  <div className="flex flex-wrap gap-3 text-xs text-cream/50">
                    <span>Total w/ BGG ID: <span className="text-cream font-medium">{(cleanupStatusQuery.data.total_with_bgg_id ?? 0).toLocaleString()}</span></span>
                    <span>Unchecked: <span className="text-amber-400 font-medium">{(cleanupStatusQuery.data.unchecked ?? 0).toLocaleString()}</span></span>
                    <span>Verified: <span className="text-green-400 font-medium">{(cleanupStatusQuery.data.verified_boardgames ?? 0).toLocaleString()}</span></span>
                    <span>Non-Boardgame: <span className="text-red-400 font-medium">{(cleanupStatusQuery.data.not_boardgame ?? 0).toLocaleString()}</span></span>
                    <span>Linked to Library: <span className="text-cream font-medium">{(cleanupStatusQuery.data.linked_to_library ?? 0).toLocaleString()}</span></span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => cleanupStatusQuery.refetch()}
                disabled={cleanupStatusQuery.isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${cleanupStatusQuery.isFetching ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => cleanupRunMutation.mutate({ dryRun: true, limit: 200 })}
                disabled={cleanupRunMutation.isPending}
              >
                {cleanupRunMutation.isPending ? (
                  <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Running...</>
                ) : (
                  <><ShieldX className="h-3.5 w-3.5 mr-1" /> Dry Run</>
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="text-xs"
                onClick={() => {
                  if (confirm("This will permanently delete non-boardgame catalog entries not linked to any user library. Continue?")) {
                    cleanupRunMutation.mutate({ dryRun: false, limit: 500 });
                  }
                }}
                disabled={cleanupRunMutation.isPending}
              >
                {cleanupRunMutation.isPending ? (
                  <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Cleaning...</>
                ) : (
                  <><Trash2 className="h-3.5 w-3.5 mr-1" /> Run Cleanup</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-wood-medium/30" />

      {/* Log Viewer */}
      <Card className="bg-wood-medium/10 border-wood-medium/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-cream text-lg">System Logs</CardTitle>
              <CardDescription className="text-cream/50">
                {filteredLogs.length} log entries
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 text-xs"
              onClick={() => cleanupMutation.mutate(30)}
              disabled={cleanupMutation.isPending}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Purge 30d+
            </Button>
          </div>

          <div className="flex gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-cream/40" />
              <Input
                placeholder="Search logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="pl-7 h-8 text-xs bg-wood-dark/50 border-wood-medium/40 text-cream"
              />
            </div>
            <Select value={logSource} onValueChange={setLogSource}>
              <SelectTrigger className="w-40 h-8 text-xs bg-wood-dark/50 border-wood-medium/40 text-cream">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={logLevel} onValueChange={setLogLevel}>
              <SelectTrigger className="w-28 h-8 text-xs bg-wood-dark/50 border-wood-medium/40 text-cream">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {logsQuery.isLoading && (
              <div className="p-4 text-center text-cream/50 text-sm">Loading logs...</div>
            )}
            {logsQuery.isError && (
              <div className="p-4 text-center text-red-400 text-sm">
                Failed to load logs: {logsQuery.error?.message}
              </div>
            )}
            {filteredLogs.length === 0 && !logsQuery.isLoading && (
              <div className="p-8 text-center text-cream/40 text-sm">
                No log entries found.
              </div>
            )}
            {filteredLogs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
