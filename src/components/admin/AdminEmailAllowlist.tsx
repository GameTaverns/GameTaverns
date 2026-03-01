import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, ShieldCheck, Mail } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export function AdminEmailAllowlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [newNote, setNewNote] = useState("");

  const { data: allowlist, isLoading } = useQuery({
    queryKey: ["admin-email-allowlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_email_allowlist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ email, note }: { email: string; note: string }) => {
      const { error } = await supabase
        .from("admin_email_allowlist")
        .insert({ email: email.toLowerCase().trim(), added_by: user?.id, note: note || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-email-allowlist"] });
      toast.success("Email added to allowlist");
      setNewEmail("");
      setNewNote("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add email");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_email_allowlist")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-email-allowlist"] });
      toast.success("Email removed from allowlist");
    },
    onError: () => {
      toast.error("Failed to remove email");
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    addMutation.mutate({ email: newEmail, note: newNote });
  };

  return (
    <div className="bg-wood-medium/20 rounded-lg p-4 border border-wood-medium/30 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-secondary" />
        <h4 className="font-semibold text-cream">Admin Email Allowlist</h4>
      </div>
      <p className="text-xs text-cream/60">
        Only emails on this list can access the admin panel. Users also need an admin or staff role assigned above.
      </p>

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-cream/70">Email</label>
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            className="h-8 bg-wood-medium/30 border-wood-medium/50 text-cream placeholder:text-cream/40 text-sm"
          />
        </div>
        <div className="w-40 space-y-1">
          <label className="text-xs text-cream/70">Note (optional)</label>
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="e.g. Community manager"
            className="h-8 bg-wood-medium/30 border-wood-medium/50 text-cream placeholder:text-cream/40 text-sm"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-8 bg-secondary text-secondary-foreground"
          disabled={addMutation.isPending}
        >
          {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
          Add
        </Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-cream/50" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-wood-medium/30 hover:bg-wood-medium/40">
              <TableHead className="text-cream/70">Email</TableHead>
              <TableHead className="text-cream/70">Note</TableHead>
              <TableHead className="text-cream/70">Added</TableHead>
              <TableHead className="text-cream/70 w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(allowlist || []).map((entry) => (
              <TableRow key={entry.id} className="border-wood-medium/30 hover:bg-wood-medium/20">
                <TableCell className="text-cream text-sm">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-cream/50" />
                    {entry.email}
                  </div>
                </TableCell>
                <TableCell className="text-cream/60 text-xs">{entry.note || "—"}</TableCell>
                <TableCell className="text-cream/60 text-xs">
                  {format(new Date(entry.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/20"
                    onClick={() => removeMutation.mutate(entry.id)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!allowlist || allowlist.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-cream/50 py-6 text-sm">
                  No emails on the allowlist yet. Add your email to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
