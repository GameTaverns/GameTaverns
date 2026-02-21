import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  ChevronDown,
  ChevronUp,
  Play,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
}

interface CronRun {
  runid: number;
  jobid: number;
  job_pid: number | null;
  database: string;
  username: string;
  command: string;
  status: string;
  return_message: string;
  start_time: string;
  end_time: string | null;
  jobname?: string;
}

// Human-friendly schedule descriptions
function describeSchedule(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;

  if (min === "*" && hour === "*") return "Every minute";
  if (min.startsWith("*/") && hour === "*") return `Every ${min.slice(2)} min`;
  if (hour.startsWith("*/") && min === "0") return `Every ${hour.slice(2)} hours`;
  if (dow === "0" && dom === "*" && mon === "*")
    return `Sundays at ${hour}:${min.padStart(2, "0")}`;
  if (dom === "*" && mon === "*" && dow === "*")
    return `Daily at ${hour}:${min.padStart(2, "0")}`;
  return cron;
}

// Check if schedule runs less frequently than every 5 minutes
function isInfrequentSchedule(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hour] = parts;
  // Runs every minute or every few minutes
  if (min === "*" && hour === "*") return false;
  if (min.startsWith("*/")) {
    const interval = parseInt(min.slice(2), 10);
    if (!isNaN(interval) && interval <= 5) return false;
  }
  return true;
}

// Extract edge function name and body from cron command
function extractFunctionInfo(command: string): { functionName: string; body: Record<string, unknown> | null } | null {
  const urlMatch = command.match(/functions\/v1\/([a-z0-9-]+)/i);
  if (!urlMatch) return null;
  const functionName = urlMatch[1];
  // Handle both `body:='...'` and `body := '...'` (with optional spaces around :=)
  const bodyMatch = command.match(/body\s*:=\s*'(\{[^']*\})'\s*::jsonb/);
  let body: Record<string, unknown> | null = null;
  if (bodyMatch) {
    try {
      body = JSON.parse(bodyMatch[1]);
    } catch { /* ignore */ }
  }
  return { functionName, body };
}


function StatusBadge({ status }: { status: string }) {
  if (status === "succeeded")
    return (
      <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Succeeded
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
        <XCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  if (status === "running")
    return (
      <Badge className="bg-amber-600/20 text-amber-400 border-amber-500/30 gap-1">
        <Timer className="h-3 w-3 animate-spin" /> Running
      </Badge>
    );
  return (
    <Badge className="bg-muted/40 text-muted-foreground gap-1">
      <AlertTriangle className="h-3 w-3" /> {status}
    </Badge>
  );
}

export function CronJobsMonitor() {
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [runningJobs, setRunningJobs] = useState<Set<number>>(new Set());

  const handleRunNow = async (job: CronJob) => {
    const info = extractFunctionInfo(job.command);
    if (!info) {
      toast.error("Cannot parse function from this cron command");
      return;
    }
    setRunningJobs((prev) => new Set(prev).add(job.jobid));
    try {
      const { error } = await supabase.functions.invoke(info.functionName, {
        ...(info.body ? { body: info.body } : {}),
      });
      if (error) throw error;
      toast.success(`Triggered ${info.functionName}`);
      // Refresh after a short delay to show new run
      setTimeout(() => refetch(), 3000);
    } catch (err: any) {
      toast.error(`Failed: ${err?.message || "Unknown error"}`);
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(job.jobid);
        return next;
      });
    }
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-cron-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("cron-status", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      return res.data as { jobs: CronJob[]; runs: CronRun[] };
    },
    refetchInterval: 30000,
  });

  const jobs = data?.jobs ?? [];
  const runs = data?.runs ?? [];

  // Map jobid → latest run
  const latestRunByJob = new Map<number, CronRun>();
  const runsByJob = new Map<number, CronRun[]>();

  for (const run of runs) {
    if (!runsByJob.has(run.jobid)) runsByJob.set(run.jobid, []);
    runsByJob.get(run.jobid)!.push(run);
    const existing = latestRunByJob.get(run.jobid);
    if (!existing || run.start_time > existing.start_time) {
      latestRunByJob.set(run.jobid, run);
    }
  }

  // Sort: active first, then alphabetically
  const sortedJobs = [...jobs].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.jobname.localeCompare(b.jobname);
  });

  const totalJobs = jobs.length;
  const activeJobs = jobs.filter((j) => j.active).length;
  const failedRecent = jobs.filter((j) => {
    const latest = latestRunByJob.get(j.jobid);
    return latest?.status === "failed";
  }).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-secondary" />
          <div>
            <h3 className="font-display text-lg font-bold text-cream">
              Cron Jobs Monitor
            </h3>
            <p className="text-xs text-cream/50">
              {activeJobs}/{totalJobs} active
              {failedRecent > 0 && (
                <span className="text-destructive ml-2">
                  · {failedRecent} failing
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1 text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-cream">{activeJobs}</div>
            <div className="text-xs text-cream/50">Active</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-cream">
              {totalJobs - activeJobs}
            </div>
            <div className="text-xs text-cream/50">Inactive</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/40">
          <CardContent className="p-3 text-center">
            <div
              className={`text-2xl font-bold ${failedRecent > 0 ? "text-destructive" : "text-emerald-400"}`}
            >
              {failedRecent}
            </div>
            <div className="text-xs text-cream/50">Failing</div>
          </CardContent>
        </Card>
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="text-center text-cream/50 py-8 text-sm">
          Loading cron jobs…
        </div>
      ) : sortedJobs.length === 0 ? (
        <div className="text-center text-cream/50 py-8 text-sm">
          No cron jobs found
        </div>
      ) : (
        <div className="space-y-2">
          {sortedJobs.map((job) => {
            const latestRun = latestRunByJob.get(job.jobid);
            const jobRuns = runsByJob.get(job.jobid) ?? [];
            const isExpanded = expandedJob === job.jobid;

            return (
              <Card
                key={job.jobid}
                className={`bg-card/60 border-border/40 transition-colors ${
                  !job.active ? "opacity-50" : ""
                }`}
              >
                <CardHeader
                  className="p-3 cursor-pointer"
                  onClick={() =>
                    setExpandedJob(isExpanded ? null : job.jobid)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`h-2 w-2 rounded-full flex-shrink-0 ${
                          !job.active
                            ? "bg-muted-foreground"
                            : latestRun?.status === "failed"
                              ? "bg-destructive animate-pulse"
                              : latestRun?.status === "running"
                                ? "bg-amber-400 animate-pulse"
                                : "bg-emerald-400"
                        }`}
                      />
                      <CardTitle className="text-sm font-mono text-cream truncate">
                        {job.jobname}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono text-cream/60 border-border/40"
                      >
                        {describeSchedule(job.schedule)}
                      </Badge>
                      {latestRun && <StatusBadge status={latestRun.status} />}
                      {!job.active && (
                        <Badge variant="secondary" className="text-[10px]">
                          Disabled
                        </Badge>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3 text-cream/40" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-cream/40" />
                      )}
                    </div>
                  </div>
                  {latestRun && (
                    <p className="text-[10px] text-cream/40 ml-4 mt-1">
                      Last ran{" "}
                      {formatDistanceToNow(new Date(latestRun.start_time), {
                        addSuffix: true,
                      })}
                    </p>
                  )}
                </CardHeader>

                {isExpanded && (
                  <CardContent className="px-3 pb-3 pt-0 space-y-3">
                    {/* Run Now button for infrequent jobs */}
                    {isInfrequentSchedule(job.schedule) && extractFunctionInfo(job.command) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs"
                        disabled={runningJobs.has(job.jobid)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunNow(job);
                        }}
                      >
                        <Play className={`h-3 w-3 ${runningJobs.has(job.jobid) ? "animate-spin" : ""}`} />
                        {runningJobs.has(job.jobid) ? "Running…" : "Run Now"}
                      </Button>
                    )}

                    {/* Command preview */}
                    <div className="bg-background/40 rounded p-2 border border-border/20">
                      <p className="text-[10px] text-cream/40 mb-1">Command</p>
                      <pre className="text-[10px] text-cream/70 font-mono whitespace-pre-wrap break-all max-h-24 overflow-auto">
                        {job.command.length > 500
                          ? job.command.slice(0, 500) + "…"
                          : job.command}
                      </pre>
                    </div>

                    {/* Recent runs */}
                    <div>
                      <p className="text-xs text-cream/50 mb-2 font-semibold">
                        Recent Runs ({jobRuns.length})
                      </p>
                      {jobRuns.length === 0 ? (
                        <p className="text-[10px] text-cream/40">
                          No recent runs recorded
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {jobRuns.slice(0, 20).map((run) => (
                            <div
                              key={run.runid}
                              className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-background/20 border border-border/10"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <StatusBadge status={run.status} />
                                <span className="text-cream/50 truncate">
                                  {format(
                                    new Date(run.start_time),
                                    "MMM d, HH:mm:ss"
                                  )}
                                </span>
                              </div>
                              <div className="text-cream/40 flex-shrink-0">
                                {run.end_time
                                  ? `${(
                                      (new Date(run.end_time).getTime() -
                                        new Date(run.start_time).getTime()) /
                                      1000
                                    ).toFixed(1)}s`
                                  : "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Last error message if failed */}
                    {latestRun?.status === "failed" &&
                      latestRun.return_message && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded p-2">
                          <p className="text-[10px] text-cream/40 mb-1">
                            Error
                          </p>
                          <pre className="text-[10px] text-destructive font-mono whitespace-pre-wrap break-all max-h-20 overflow-auto">
                            {latestRun.return_message}
                          </pre>
                        </div>
                      )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
