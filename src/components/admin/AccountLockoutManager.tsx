import { useState } from "react";
import { Search, ShieldAlert, Unlock, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

interface LockoutStatus {
  email: string;
  isLocked: boolean;
  recentFailures: number;
  lastAttemptAt: string | null;
  attempts: { id: string; created_at: string; success: boolean }[];
}

export function AccountLockoutManager() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [status, setStatus] = useState<LockoutStatus | null>(null);

  const checkLockout = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    setStatus(null);

    try {
      // Get recent attempts (last 24h)
      const { data: attempts, error } = await supabase
        .from("login_attempts")
        .select("id, created_at, success")
        .eq("email", trimmed)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Count failures in last 15 minutes (matches is_account_locked logic)
      const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
      const recentFailures = (attempts || []).filter(
        (a) => !a.success && new Date(a.created_at).getTime() > fifteenMinAgo
      ).length;

      setStatus({
        email: trimmed,
        isLocked: recentFailures >= 5,
        recentFailures,
        lastAttemptAt: attempts && attempts.length > 0 ? attempts[0].created_at : null,
        attempts: attempts || [],
      });
    } catch (err: any) {
      toast.error("Failed to check lockout", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const clearLockout = async () => {
    if (!status) return;
    setClearing(true);

    try {
      const { error } = await supabase
        .from("login_attempts")
        .delete()
        .eq("email", status.email)
        .eq("success", false);

      if (error) throw error;

      toast.success(`Lockout cleared for ${status.email}`);
      setStatus((prev) =>
        prev
          ? { ...prev, isLocked: false, recentFailures: 0, attempts: prev.attempts.filter((a) => a.success) }
          : null
      );
    } catch (err: any) {
      toast.error("Failed to clear lockout", { description: err.message });
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldAlert className="h-4 w-4" />
          Account Lockout Manager v2
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Check if an account is locked (5 failed attempts in 15 min) and manually clear the lockout.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <form onSubmit={checkLockout} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative w-full min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter user email..."
              className="pl-9"
              type="email"
            />
          </div>
          <Button type="submit" size="sm" disabled={loading || !email.trim()} className="w-full sm:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
          </Button>
        </form>

        {/* Results */}
        {status && (
          <div className="space-y-3">
            {/* Status badge */}
            <div className="p-3 rounded-lg border bg-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
                <div className="flex items-start gap-3 min-w-0">
                  {status.isLocked ? (
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{status.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {status.recentFailures} failed attempt{status.recentFailures !== 1 ? "s" : ""} in last 15 min
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge variant={status.isLocked ? "destructive" : "outline"} className="w-fit text-[10px] px-2 py-0.5">
                    {status.isLocked ? "LOCKED" : "Not Locked"}
                  </Badge>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearLockout}
                    disabled={clearing || !status.attempts.some((a) => !a.success)}
                    className="gap-1.5 h-8 px-2 text-[11px] w-fit"
                  >
                    {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
                    {status.attempts.some((a) => !a.success)
                      ? status.isLocked
                        ? "Clear Lockout"
                        : "Clear Failed Attempts"
                      : "No Failed Attempts"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Recent attempts */}
            {status.attempts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Recent Attempts (24h)</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {status.attempts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between text-xs px-3 py-1.5 rounded bg-muted/30"
                    >
                      <span className="text-muted-foreground">
                        {format(new Date(a.created_at), "MMM d, h:mm:ss a")}
                      </span>
                      <Badge variant={a.success ? "outline" : "destructive"} className="text-[10px]">
                        {a.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {status.attempts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No login attempts found for this email in the last 24 hours.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
