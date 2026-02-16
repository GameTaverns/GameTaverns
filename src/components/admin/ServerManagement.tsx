import { useState } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

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
  },
  {
    id: "compose",
    name: "Docker Compose Shortcuts",
    description:
      "Sources helpful shell aliases for managing the Docker stack: gt_ps (status), gt_logs (logs), gt_restart (restart all), and gt_exec (exec into containers).",
    command: "source /opt/gametaverns/deploy/supabase-selfhosted/scripts/compose.sh",
    icon: <Terminal className="h-5 w-5" />,
    category: "maintenance",
    whenToRun: "Anytime you need quick access to Docker Compose commands for the stack.",
    estimatedTime: "Instant",
    requiresRoot: false,
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

function ScriptCard({ script }: { script: ScriptInfo }) {
  const [expanded, setExpanded] = useState(false);

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
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] gap-1 border-wood-medium/30">
              <Clock className="h-2.5 w-2.5" />
              {script.estimatedTime}
            </Badge>
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

export function ServerManagement() {
  const categories = ["routine", "maintenance", "danger"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-secondary/20">
          <Terminal className="h-5 w-5 text-secondary" />
        </div>
        <div>
          <h3 className="font-display text-base font-bold text-cream">Server Management</h3>
          <p className="text-xs text-cream/50">
            Reference guide for all deployment and maintenance scripts. Click a card to expand details and copy the command.
          </p>
        </div>
      </div>

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
                <ScriptCard key={script.id} script={script} />
              ))}
            </div>
          </div>
        );
      })}

      <Separator className="bg-wood-medium/20" />

      <div className="p-3 rounded-lg bg-wood-dark/40 border border-wood-medium/20">
        <p className="text-xs text-cream/50 leading-relaxed">
          <strong className="text-cream/70">Quick Reference:</strong> For most updates, just run{" "}
          <code className="text-emerald-400 bg-black/30 px-1 py-0.5 rounded text-[11px]">sudo update.sh</code> — it
          handles git pull, backup, migrations, frontend rebuild, edge function sync, and service restart all in one command.
        </p>
      </div>
    </div>
  );
}
