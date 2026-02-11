import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface HealthData {
  status: string;
  timestamp: string;
  checks: HealthCheck[];
  stats: {
    totalGames: number;
    totalLibraries: number;
    totalSessions: number;
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

const statusIcons: Record<string, typeof CheckCircle> = {
  healthy: CheckCircle,
  degraded: AlertTriangle,
  down: XCircle,
  unknown: Clock,
};

const statusColors: Record<string, string> = {
  healthy: "text-green-400",
  degraded: "text-yellow-400",
  down: "text-red-400",
  unknown: "text-muted-foreground",
};

const serviceIcons: Record<string, typeof Database> = {
  Database: Database,
  "Image Proxy": Image,
  "BGG API": Globe,
  "Edge Functions": Zap,
  "Auth Service": Shield,
  Storage: HardDrive,
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

  const resp = await supabase.functions.invoke("system-health", {
    body: null,
    headers: {},
    method: "GET",
  });

  // supabase.functions.invoke doesn't support query params easily, use fetch directly
  const url = `${(supabase as any).supabaseUrl}/functions/v1/system-health?action=health`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: (supabase as any).supabaseKey,
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

  const url = `${(supabase as any).supabaseUrl}/functions/v1/system-health?${searchParams}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: (supabase as any).supabaseKey,
    },
  });

  if (!r.ok) throw new Error(`Logs fetch failed: ${r.status}`);
  const data = await r.json();
  return data.logs;
}

function HealthCard({ check }: { check: HealthCheck }) {
  const StatusIcon = statusIcons[check.status] || Clock;
  const ServiceIcon = serviceIcons[check.name] || Activity;
  const color = statusColors[check.status] || "text-muted-foreground";

  return (
    <Card className="bg-wood-medium/20 border-wood-medium/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ServiceIcon className="h-5 w-5 text-cream/70" />
            <span className="font-medium text-cream text-sm">{check.name}</span>
          </div>
          <StatusIcon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={`${color} border-current text-xs`}>
            {check.status}
          </Badge>
          <span className="text-xs text-cream/50">{check.latencyMs}ms</span>
        </div>
        {check.message && (
          <p className="text-xs text-cream/50 mt-2 truncate">{check.message}</p>
        )}
        {check.details && Object.keys(check.details).length > 0 && (
          <div className="mt-2 text-xs text-cream/40">
            {Object.entries(check.details).map(([k, v]) => (
              <span key={k} className="mr-3">
                {k}: {String(v)}
              </span>
            ))}
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

export function SystemHealth() {
  const [logSource, setLogSource] = useState<string>("all");
  const [logLevel, setLogLevel] = useState<string>("all");
  const [logSearch, setLogSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

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

  const cleanupMutation = useMutation({
    mutationFn: async (days: number) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const url = `${(supabase as any).supabaseUrl}/functions/v1/system-health?action=cleanup&days=${days}`;
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: (supabase as any).supabaseKey,
        },
      });
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(`Cleaned up ${data.deleted || 0} old log entries`);
      logsQuery.refetch();
    },
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

  // Get unique sources from logs for filter dropdown
  const uniqueSources = [...new Set((logsQuery.data || []).map((l) => l.source))].sort();

  const overallStatus = healthQuery.data?.status || "unknown";
  const overallColor = statusColors[overallStatus] || "text-muted-foreground";

  return (
    <div className="space-y-6">
      {/* Header with overall status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className={`h-6 w-6 ${overallColor}`} />
          <div>
            <h2 className="text-xl font-display font-bold text-cream">System Health</h2>
            <p className="text-sm text-cream/60">
              {healthQuery.data
                ? `Last checked: ${new Date(healthQuery.data.timestamp).toLocaleTimeString()}`
                : "Loading..."}
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

      {/* Health Check Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {healthQuery.data?.checks.map((check) => (
          <HealthCard key={check.name} check={check} />
        ))}
        {healthQuery.isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-wood-medium/20 border-wood-medium/40 animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        {healthQuery.isError && (
          <Card className="bg-red-500/10 border-red-500/30 col-span-full">
            <CardContent className="p-4 text-red-400 text-sm">
              Failed to fetch health data: {healthQuery.error?.message}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Platform Stats */}
      {healthQuery.data?.stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-wood-medium/20 border-wood-medium/40">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cream">{healthQuery.data.stats.totalGames.toLocaleString()}</div>
              <div className="text-xs text-cream/50">Total Games</div>
            </CardContent>
          </Card>
          <Card className="bg-wood-medium/20 border-wood-medium/40">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cream">{healthQuery.data.stats.totalLibraries}</div>
              <div className="text-xs text-cream/50">Libraries</div>
            </CardContent>
          </Card>
          <Card className="bg-wood-medium/20 border-wood-medium/40">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cream">{healthQuery.data.stats.totalSessions.toLocaleString()}</div>
              <div className="text-xs text-cream/50">Play Sessions</div>
            </CardContent>
          </Card>
        </div>
      )}

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

          {/* Filters */}
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
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
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
                No log entries found. Logs will appear here as system operations occur
                (imports, syncs, errors, etc.).
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
