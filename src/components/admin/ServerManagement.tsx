import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Database,
  HardDrive,
  Shield,
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Wrench,
  Trash2,
  Lock,
  RotateCcw,
  Server,
  Zap,
  FileText,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
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
import { ScrollArea } from "@/components/ui/scroll-area";

interface ScriptInfo {
  id: string;
  name: string;
  description: string;
  command: string;
  icon: React.ReactNode;
  category: "routine" | "maintenance" | "danger";
  whenToRun: string;
  estimatedTime: string;
  requiresRoot: boolean;
  warning?: string;
  canRunRemotely: boolean;
}

interface CommandStatus {
  id: string;
  script_id: string;
  status: string;
  output: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const SCRIPTS: ScriptInfo[] = [
  // === ROUTINE ===
  {
    id: "update",
    name: "Update Application",
    description:
      "Pulls latest code from Git, creates a backup, rebuilds the frontend, runs database migrations, syncs edge function handlers, and restarts all services. This is your primary deployment command.",
    command: "sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/update.sh",
    icon: <RefreshCw className="h-5 w-5" />,
    category: "routine",
    whenToRun: "After pushing new code to Git, or when a new release is available.",
    estimatedTime: "3–8 minutes",
    requiresRoot: true,
    canRunRemotely: true,
  },
  {
    id: "backup",
    name: "Backup",
    description:
      "Creates compressed backups of the database, file storage, mail data, and configuration. Backups are stored in /opt/gametaverns/backups/ with automatic cleanup of files older than 7 days (configurable).",
    command: "sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/backup.sh",
    icon: <HardDrive className="h-5 w-5" />,
    category: "routine",
    whenToRun: "Before any major update or change. Also runs automatically as part of update.sh.",
    estimatedTime: "1–3 minutes",
    requiresRoot: true,
    canRunRemotely: true,
  },
  {
    id: "migrations",
    name: "Run Migrations",
    description:
      "Applies pending database migrations using the tracked migration runner. Automatically skips already-applied migrations via the schema_migrations table. Safe to run multiple times (idempotent).",
    command: "sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/run-migrations.sh",
    icon: <Database className="h-5 w-5" />,
    category: "routine",
    whenToRun: "When you need to apply database changes without a full update. Usually handled by update.sh automatically.",
    estimatedTime: "30 seconds – 2 minutes",
    requiresRoot: true,
    canRunRemotely: true,
  },

  // === MAINTENANCE ===
  {
    id: "restore",
    name: "Restore from Backup",
    description:
      "Restores the database, storage, and mail from a previous backup. Lists available backups and prompts for confirmation before overwriting current data. Stops services during restore.",
    command: "sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/restore.sh",
    icon: <RotateCcw className="h-5 w-5" />,
    category: "maintenance",
    whenToRun: "When you need to roll back to a previous state due to data corruption or a bad migration.",
    estimatedTime: "2–5 minutes",
    requiresRoot: true,
    warning: "This REPLACES your current database with the backup. All data since the backup will be lost.",
    canRunRemotely: false, // Interactive — requires SSH
  },
  {
    id: "render-kong",
    name: "Render Kong Config",
    description:
      "Re-renders the Kong API gateway configuration by substituting API key placeholders with actual keys from .env. Normally handled by install.sh, but useful after manual key rotation.",
    command: "sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/render-kong-config.sh",
    icon: <Wrench className="h-5 w-5" />,
    category: "maintenance",
    whenToRun: "After rotating ANON_KEY or SERVICE_ROLE_KEY in your .env file.",
    estimatedTime: "< 5 seconds",
    requiresRoot: true,
    canRunRemotely: true,
  },
  {
    id: "setup-ssl",
    name: "Setup SSL",
    description:
      "Configures SSL certificates using Certbot for gametaverns.com, including wildcard certificates for tenant subdomains (*.gametaverns.com).",
    command: "sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/setup-ssl.sh",
    icon: <Lock className="h-5 w-5" />,
    category: "maintenance",
    whenToRun: "During initial setup, or when SSL certificates need renewal or reconfiguration.",
    estimatedTime: "1–3 minutes",
    requiresRoot: true,
    canRunRemotely: true,
  },
  {
    id: "create-admin",
    name: "Create Admin User",
    description:
      "Creates or promotes a user to admin role. Interactively prompts for email and handles user lookup and role assignment via the user_roles table.",
    command: "sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/create-admin.sh",
    icon: <Shield className="h-5 w-5" />,
    category: "maintenance",
    whenToRun: "When you need to grant admin access to a user account.",
    estimatedTime: "< 30 seconds",
    requiresRoot: true,
    canRunRemotely: false, // Interactive
  },
  {
    id: "preflight",
    name: "Preflight Check",
    description:
      "Validates the server environment before installation or update. Checks Docker, disk space, ports, DNS, and other prerequisites.",
    command: "sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/preflight-check.sh",
    icon: <FileText className="h-5 w-5" />,
    category: "maintenance",
    whenToRun: "Before initial installation or when troubleshooting environment issues.",
    estimatedTime: "< 30 seconds",
    requiresRoot: true,
    canRunRemotely: true,
  },
  {
    id: "rebuild-frontend",
    name: "Rebuild Frontend Only",
    description:
      "Rebuilds and redeploys just the frontend app container without touching the database or other services. Useful for quick UI-only fixes.",
    command:
      'docker compose --env-file /opt/gametaverns/.env -f /opt/gametaverns/deploy/supabase-selfhosted/docker-compose.yml build --no-cache app && docker compose --env-file /opt/gametaverns/.env -f /opt/gametaverns/deploy/supabase-selfhosted/docker-compose.yml up -d app',
    icon: <Zap className="h-5 w-5" />,
    category: "maintenance",
    whenToRun: "When you've only changed frontend code and want a faster deploy than full update.sh.",
    estimatedTime: "1–3 minutes",
    requiresRoot: true,
    canRunRemotely: true,
  },
  {
    id: "rebuild-server",
    name: "Rebuild Server (Express) Only",
    description:
      "Rebuilds and redeploys just the Express API server container without touching the frontend, database, or other services. Use after backend route changes.",
    command:
      'docker compose --env-file /opt/gametaverns/.env -f /opt/gametaverns/deploy/supabase-selfhosted/docker-compose.yml build --no-cache server && docker compose --env-file /opt/gametaverns/.env -f /opt/gametaverns/deploy/supabase-selfhosted/docker-compose.yml up -d server',
    icon: <Server className="h-5 w-5" />,
    category: "maintenance",
    whenToRun: "When you've only changed Express/backend routes and want a faster deploy than full update.sh.",
    estimatedTime: "1–2 minutes",
    requiresRoot: true,
    canRunRemotely: true,
  },
  {
    id: "restart-functions",
    name: "Restart Edge Functions",
    description:
      "Force-recreates the Edge Functions container, clearing the Deno cache. Also restarts Kong to refresh DNS resolution for the new container.",
    command:
      'docker compose --env-file /opt/gametaverns/.env -f /opt/gametaverns/deploy/supabase-selfhosted/docker-compose.yml up -d --force-recreate --no-deps functions && docker compose --env-file /opt/gametaverns/.env -f /opt/gametaverns/deploy/supabase-selfhosted/docker-compose.yml up -d --force-recreate --no-deps kong',
    icon: <Server className="h-5 w-5" />,
    category: "maintenance",
    whenToRun: "After modifying edge function code, or when functions are returning stale/cached responses.",
    estimatedTime: "30 seconds",
    requiresRoot: true,
    canRunRemotely: true,
  },

  // === DANGER ===
  {
    id: "clean-install",
    name: "Clean Install Prep",
    description:
      "Prepares the server for a fresh installation by stopping conflicting containers, removing old mail containers, and cleaning up Docker networks. Run BEFORE install.sh if you have a messy environment.",
    command: "sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/clean-install.sh",
    icon: <Trash2 className="h-5 w-5" />,
    category: "danger",
    whenToRun: "Only before a fresh install when the server has leftover containers from a previous setup.",
    estimatedTime: "1–2 minutes",
    requiresRoot: true,
    warning: "Stops and removes containers. Will cause downtime.",
    canRunRemotely: true,
  },
  {
    id: "nuclear-reset",
    name: "Nuclear Reset",
    description:
      "COMPLETELY wipes the server back to a fresh Ubuntu state. Removes ALL Docker containers, images, volumes, project directories, credentials, Nginx configs, SSL certificates, cron jobs, and log files.",
    command: "sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/nuclear-reset.sh",
    icon: <AlertTriangle className="h-5 w-5" />,
    category: "danger",
    whenToRun: "Only when you want to completely start over from scratch. There is NO undo.",
    estimatedTime: "2–5 minutes",
    requiresRoot: true,
    warning: "THIS WILL DELETE EVERYTHING. All data, all backups, all configuration. This cannot be undone.",
    canRunRemotely: false, // Blocked for safety
  },
];

const categoryConfig = {
  routine: {
    label: "Routine Operations",
    description: "Common scripts you'll use regularly for deployments and maintenance.",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  maintenance: {
    label: "Maintenance & Configuration",
    description: "Less frequent operations for troubleshooting, SSL, and server management.",
    badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  danger: {
    label: "Destructive Operations",
    description: "These scripts cause data loss or downtime. Use with extreme caution.",
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied to clipboard", description: "Paste this command into your SSH terminal." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please select and copy manually.", variant: "destructive" });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-1.5 text-xs border-wood-medium/40 hover:bg-wood-medium/20"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function RunButton({ script, onRun, runningCommands }: {
  script: ScriptInfo;
  onRun: (scriptId: string) => void;
  runningCommands: Record<string, CommandStatus>;
}) {
  const cmd = runningCommands[script.id];
  const isRunning = cmd?.status === "pending" || cmd?.status === "running";
  const isDone = cmd?.status === "completed";
  const isFailed = cmd?.status === "failed";

  if (!script.canRunRemotely) {
    return (
      <Badge variant="outline" className="text-[10px] border-wood-medium/30 text-cream/40">
        SSH only
      </Badge>
    );
  }

  if (isRunning) {
    return (
      <Button size="sm" variant="outline" disabled className="gap-1.5 text-xs border-amber-500/30 text-amber-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        {cmd?.status === "running" ? "Running…" : "Queued…"}
      </Button>
    );
  }

  if (isDone) {
    return (
      <Button size="sm" variant="outline" className="gap-1.5 text-xs border-emerald-500/30 text-emerald-400" onClick={() => onRun(script.id)}>
        <CheckCircle2 className="h-3 w-3" />
        Done — Run Again
      </Button>
    );
  }

  if (isFailed) {
    return (
      <Button size="sm" variant="outline" className="gap-1.5 text-xs border-red-500/30 text-red-400" onClick={() => onRun(script.id)}>
        <XCircle className="h-3 w-3" />
        Failed — Retry
      </Button>
    );
  }

  if (script.category === "danger") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs border-red-500/30 text-red-400 hover:bg-red-500/20">
            <Play className="h-3 w-3" />
            Run
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">⚠️ Confirm: {script.name}</AlertDialogTitle>
            <AlertDialogDescription>
              {script.warning || script.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => onRun(script.id)}>
              Yes, Run It
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button size="sm" variant="outline" className="gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" onClick={() => onRun(script.id)}>
      <Play className="h-3 w-3" />
      Run
    </Button>
  );
}

function CommandOutput({ command }: { command: CommandStatus }) {
  const [showOutput, setShowOutput] = useState(false);

  if (!command.output) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setShowOutput(!showOutput)}
        className="flex items-center gap-1 text-[11px] text-cream/50 hover:text-cream/70 transition-colors"
      >
        {showOutput ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {showOutput ? "Hide output" : "Show output"}
      </button>
      {showOutput && (
        <ScrollArea className="mt-1.5 max-h-48 rounded-lg bg-black/40 border border-wood-medium/20 p-2.5">
          <pre className="text-[11px] text-cream/60 whitespace-pre-wrap font-mono">{command.output}</pre>
        </ScrollArea>
      )}
    </div>
  );
}

function ScriptCard({ script, onRun, runningCommands }: {
  script: ScriptInfo;
  onRun: (scriptId: string) => void;
  runningCommands: Record<string, CommandStatus>;
}) {
  const [expanded, setExpanded] = useState(false);
  const cmd = runningCommands[script.id];

  return (
    <Card
      className={`border transition-colors cursor-pointer ${
        script.category === "danger"
          ? "border-red-500/30 bg-red-950/10 hover:border-red-500/50"
          : "border-wood-medium/30 bg-wood-dark/40 hover:border-wood-medium/50"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                script.category === "danger"
                  ? "bg-red-500/20 text-red-400"
                  : script.category === "routine"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {script.icon}
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-cream">{script.name}</CardTitle>
              <CardDescription className="text-xs text-cream/50 mt-0.5 line-clamp-1">
                {script.description.split(".")[0]}.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Badge variant="outline" className="text-[10px] gap-1 border-wood-medium/30 hidden sm:flex">
              <Clock className="h-2.5 w-2.5" />
              {script.estimatedTime}
            </Badge>
            <RunButton script={script} onRun={onRun} runningCommands={runningCommands} />
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3" onClick={(e) => e.stopPropagation()}>
          <Separator className="bg-wood-medium/20" />

          <p className="text-xs text-cream/70 leading-relaxed">{script.description}</p>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-cream/50 uppercase tracking-wider">When to run</p>
            <p className="text-xs text-cream/70">{script.whenToRun}</p>
          </div>

          {script.warning && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{script.warning}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-cream/50 uppercase tracking-wider">Command</p>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/30 border border-wood-medium/20 font-mono">
              <code className="text-xs text-emerald-400 flex-1 break-all select-all">{script.command}</code>
              <CopyButton text={script.command} />
            </div>
          </div>

          {cmd && (cmd.status === "completed" || cmd.status === "failed") && (
            <CommandOutput command={cmd} />
          )}

          {script.requiresRoot && (
            <p className="text-[10px] text-cream/40 flex items-center gap-1">
              <Shield className="h-3 w-3" /> Requires root (sudo)
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

const DC = "docker compose --env-file /opt/gametaverns/.env -f /opt/gametaverns/deploy/supabase-selfhosted/docker-compose.yml";
const PSQL = `${DC} exec -T db psql -U postgres -d postgres -c`;

interface DiagCmd {
  label: string;
  description: string;
  command: string;
}

const DIAGNOSTIC_COMMANDS: { category: string; icon: React.ReactNode; commands: DiagCmd[] }[] = [
  {
    category: "Import Jobs",
    icon: <RefreshCw className="h-4 w-4" />,
    commands: [
      {
        label: "Check stuck/paused imports",
        description: "Shows import jobs that are stuck in processing, paused, or pending status.",
        command: `${PSQL} "SELECT id, status, total_items, processed_items, import_metadata->>'bgg_username' as bgg_user, created_at, updated_at FROM import_jobs WHERE status IN ('paused','processing','pending') ORDER BY created_at DESC LIMIT 10;"`,
      },
      {
        label: "Force-resume paused imports",
        description: "Sets paused import jobs back to processing so the worker picks them up.",
        command: `${PSQL} "UPDATE import_jobs SET status = 'processing' WHERE status = 'paused' RETURNING id, status;"`,
      },
      {
        label: "Cancel all stuck imports",
        description: "Marks all non-completed imports as failed. Use when jobs are stuck and won't resume.",
        command: `${PSQL} "UPDATE import_jobs SET status = 'failed', error_message = 'Manually cancelled by admin' WHERE status IN ('processing','pending','paused') RETURNING id, status;"`,
      },
      {
        label: "Recent import history",
        description: "Shows the 15 most recent import jobs with their final status.",
        command: `${PSQL} "SELECT id, status, total_items, processed_items, error_message, created_at FROM import_jobs ORDER BY created_at DESC LIMIT 15;"`,
      },
      {
        label: "View failed import items",
        description: "Shows individual games that failed during imports with error reasons.",
        command: `${PSQL} "SELECT item_title, bgg_id, error_category, error_reason, created_at FROM import_item_errors ORDER BY created_at DESC LIMIT 25;"`,
      },
    ],
  },
  {
    category: "Logs",
    icon: <FileText className="h-4 w-4" />,
    commands: [
      {
        label: "Server (Express) logs",
        description: "Tail the last 100 lines of the Express API server logs.",
        command: `${DC} logs --tail=100 server`,
      },
      {
        label: "Edge Functions logs",
        description: "Tail the last 100 lines from the Edge Functions container.",
        command: `${DC} logs --tail=100 functions`,
      },
      {
        label: "Database logs",
        description: "Tail the last 100 lines from the PostgreSQL container.",
        command: `${DC} logs --tail=100 db`,
      },
      {
        label: "All services (follow)",
        description: "Live-follow all container logs. Press Ctrl+C to stop.",
        command: `${DC} logs -f --tail=50`,
      },
    ],
  },
  {
    category: "Database",
    icon: <Database className="h-4 w-4" />,
    commands: [
      {
        label: "Active connections",
        description: "Shows current active database connections and their state.",
        command: `${PSQL} "SELECT pid, state, query_start, left(query, 80) as query FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"`,
      },
      {
        label: "Table sizes",
        description: "Shows the largest tables in the database by total size.",
        command: `${PSQL} "SELECT relname as table, pg_size_pretty(pg_total_relation_size(relid)) as size FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 15;"`,
      },
      {
        label: "Catalog count",
        description: "Quick count of games in the catalog.",
        command: `${PSQL} "SELECT count(*) as catalog_total FROM game_catalog;"`,
      },
      {
        label: "User count",
        description: "Total registered users.",
        command: `${PSQL} "SELECT count(*) as total_users FROM auth.users;"`,
      },
    ],
  },
  {
    category: "Docker",
    icon: <Server className="h-4 w-4" />,
    commands: [
      {
        label: "Container status",
        description: "Shows running/stopped status of all GameTaverns containers.",
        command: `${DC} ps`,
      },
      {
        label: "Disk usage",
        description: "Shows Docker disk usage including images, containers, and volumes.",
        command: `docker system df`,
      },
      {
        label: "Restart all services",
        description: "Restarts all containers without rebuilding.",
        command: `${DC} restart`,
      },
    ],
  },
];

function DiagnosticCommands() {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
          Diagnostic Commands
        </Badge>
        <span className="text-xs text-cream/40">Copy & paste these into your SSH terminal for quick diagnostics.</span>
      </div>

      <div className="grid gap-2">
        {DIAGNOSTIC_COMMANDS.map((group) => {
          const isExpanded = expandedCat === group.category;
          return (
            <Card
              key={group.category}
              className="border border-wood-medium/30 bg-wood-dark/40 hover:border-wood-medium/50 transition-colors"
            >
              <CardHeader
                className="pb-2 cursor-pointer"
                onClick={() => setExpandedCat(isExpanded ? null : group.category)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">{group.icon}</div>
                    <CardTitle className="text-sm font-semibold text-cream">{group.category}</CardTitle>
                    <Badge variant="outline" className="text-[10px] border-wood-medium/30 text-cream/40">
                      {group.commands.length} commands
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-cream/40" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-cream/40" />
                  )}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-3">
                  <Separator className="bg-wood-medium/20" />
                  {group.commands.map((cmd) => (
                    <div key={cmd.label} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-cream">{cmd.label}</p>
                          <p className="text-[11px] text-cream/50">{cmd.description}</p>
                        </div>
                        <CopyButton text={cmd.command} />
                      </div>
                      <div className="p-2 rounded-lg bg-black/30 border border-wood-medium/20 font-mono">
                        <code className="text-[11px] text-emerald-400 break-all select-all block">{cmd.command}</code>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function ServerManagement() {
  const categories = ["routine", "maintenance", "danger"] as const;
  const { toast } = useToast();
  const [runningCommands, setRunningCommands] = useState<Record<string, CommandStatus>>({});
  const [agentConnected, setAgentConnected] = useState<boolean | null>(null);

  // Check agent status by looking for recent completed commands
  useEffect(() => {
    const checkAgent = async () => {
      try {
        const { data } = await supabase.functions.invoke("server-command", {
          body: { action: "list" },
        });
        // If we can reach the function, agent connectivity is checked via recent commands
        if (data?.commands) {
          const hasRecent = data.commands.some((c: CommandStatus) =>
            c.status === "completed" || c.status === "running"
          );
          setAgentConnected(hasRecent ? true : null); // null = unknown
        }
      } catch {
        setAgentConnected(null);
      }
    };
    checkAgent();
  }, []);

  // Poll for running command updates
  useEffect(() => {
    const activeCommands = Object.values(runningCommands).filter(
      (c) => c.status === "pending" || c.status === "running"
    );

    if (activeCommands.length === 0) return;

    const interval = setInterval(async () => {
      for (const cmd of activeCommands) {
        try {
          const response = await supabase.functions.invoke("server-command", {
            body: { action: "list" },
          });

          // Parse the response to find our command
          if (response.data?.commands) {
            const updated = response.data.commands.find((c: CommandStatus) => c.id === cmd.id);
            if (updated && updated.status !== cmd.status) {
              setRunningCommands((prev) => ({
                ...prev,
                [updated.script_id]: updated,
              }));

              if (updated.status === "completed") {
                setAgentConnected(true);
                toast({ title: `✓ ${SCRIPTS.find(s => s.id === updated.script_id)?.name} completed` });
              } else if (updated.status === "failed") {
                toast({
                  title: `✗ ${SCRIPTS.find(s => s.id === updated.script_id)?.name} failed`,
                  variant: "destructive",
                });
              }
            }
          }
        } catch {
          // Silently retry
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [runningCommands, toast]);

  const handleRun = useCallback(async (scriptId: string) => {
    try {
      const response = await supabase.functions.invoke("server-command", {
        body: { action: "run", script_id: scriptId },
      });

      if (response.error) {
        toast({ title: "Failed to queue command", description: String(response.error), variant: "destructive" });
        return;
      }

      if (response.data?.error) {
        toast({ title: "Error", description: response.data.error, variant: "destructive" });
        return;
      }

      if (response.data?.command) {
        setRunningCommands((prev) => ({
          ...prev,
          [scriptId]: response.data.command,
        }));
        toast({ title: `Queued: ${SCRIPTS.find(s => s.id === scriptId)?.name}`, description: "Waiting for server agent to pick it up…" });
      }
    } catch (err) {
      toast({ title: "Network error", description: String(err), variant: "destructive" });
    }
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary/20">
            <Terminal className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-cream">Server Management</h3>
            <p className="text-xs text-cream/50">
              Run scripts remotely or copy commands for SSH. Click a card to expand details.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            agentConnected === true ? "bg-emerald-400" :
            agentConnected === false ? "bg-red-400" :
            "bg-amber-400 animate-pulse"
          }`} />
          <span className="text-[11px] text-cream/50">
            {agentConnected === true ? "Agent connected" :
             agentConnected === false ? "Agent offline" :
             "Agent status unknown"}
          </span>
        </div>
      </div>

      {agentConnected === null && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-300 leading-relaxed">
            <strong>Setup required:</strong> To use the Run buttons, install the webhook agent on your server:
          </p>
          <code className="block mt-1.5 text-[11px] text-emerald-400 bg-black/30 p-2 rounded font-mono">
            sudo cp /opt/gametaverns/deploy/supabase-selfhosted/scripts/webhook-agent.service /etc/systemd/system/gametaverns-agent.service && sudo systemctl daemon-reload && sudo systemctl enable --now gametaverns-agent
          </code>
        </div>
      )}

      {categories.map((cat) => {
        const config = categoryConfig[cat];
        const scripts = SCRIPTS.filter((s) => s.category === cat);

        return (
          <div key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${config.badgeClass}`}>
                {config.label}
              </Badge>
              <span className="text-xs text-cream/40">{config.description}</span>
            </div>

            <div className="grid gap-2">
              {scripts.map((script) => (
                <ScriptCard
                  key={script.id}
                  script={script}
                  onRun={handleRun}
                  runningCommands={runningCommands}
                />
              ))}
            </div>
          </div>
        );
      })}

      <Separator className="bg-wood-medium/20" />

      <DiagnosticCommands />

      <div className="p-3 rounded-lg bg-wood-dark/40 border border-wood-medium/20">
        <p className="text-xs text-cream/50 leading-relaxed">
          <strong className="text-cream/70">Quick Reference:</strong> For most updates, just click{" "}
          <span className="text-emerald-400 font-medium">Run</span> on "Update Application" — it
          handles git pull, backup, migrations, frontend rebuild, edge function sync, and service restart all in one command.
        </p>
      </div>
    </div>
  );
}
