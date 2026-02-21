import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Search, RefreshCw, AlertTriangle, CheckCircle, XCircle, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  login_success: "bg-green-500/20 text-green-400 border-green-500/30",
  login_failed: "bg-red-500/20 text-red-400 border-red-500/30",
  login_locked: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  signup: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  password_change: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  password_reset_request: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  totp_enabled: "bg-green-500/20 text-green-400 border-green-500/30",
  totp_disabled: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  account_deleted: "bg-red-500/20 text-red-400 border-red-500/30",
  role_changed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  login_success: <CheckCircle className="h-3.5 w-3.5" />,
  login_failed: <XCircle className="h-3.5 w-3.5" />,
  login_locked: <AlertTriangle className="h-3.5 w-3.5" />,
  signup: <User className="h-3.5 w-3.5" />,
};

export function AuditLogViewer() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (actionFilter) {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filteredLogs = search.trim()
    ? logs.filter((log: any) =>
        JSON.stringify(log).toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const actionCounts = logs.reduce((acc: Record<string, number>, log: any) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { action: "login_success", label: "Logins", icon: CheckCircle },
          { action: "login_failed", label: "Failed", icon: XCircle },
          { action: "login_locked", label: "Lockouts", icon: AlertTriangle },
          { action: "signup", label: "Signups", icon: User },
        ].map(({ action, label, icon: Icon }) => (
          <Card
            key={action}
            className={cn(
              "cursor-pointer transition-all hover:scale-[1.02]",
              actionFilter === action ? "ring-2 ring-secondary" : ""
            )}
            onClick={() => setActionFilter(actionFilter === action ? null : action)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{actionCounts[action] || 0}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Filter pills */}
      {actionFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtering:</span>
          <Badge
            variant="outline"
            className={cn("text-xs cursor-pointer", ACTION_COLORS[actionFilter])}
            onClick={() => setActionFilter(null)}
          >
            {actionFilter} ✕
          </Badge>
        </div>
      )}

      {/* Log Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4" />
            Security Audit Log
            <span className="text-muted-foreground font-normal">
              ({filteredLogs.length} entries)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b">
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Action</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Details</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log: any) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2 whitespace-nowrap text-muted-foreground">
                      {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                    </td>
                    <td className="p-2">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", ACTION_COLORS[log.action] || "")}
                      >
                        {ACTION_ICONS[log.action]}
                        <span className="ml-1">{log.action}</span>
                      </Badge>
                    </td>
                    <td className="p-2 max-w-[300px] truncate text-muted-foreground">
                      {log.details?.email || log.details?.username || JSON.stringify(log.details)}
                    </td>
                    <td className="p-2 text-muted-foreground font-mono">
                      {log.ip_address || "—"}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      {isLoading ? "Loading..." : "No audit log entries found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
