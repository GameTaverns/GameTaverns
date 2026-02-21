import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Check, X, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface PurchaseLink {
  id: string;
  retailer_name: string;
  url: string;
  retailer_logo_url: string | null;
  is_affiliate: boolean;
  source: string;
  status: string;
}

interface ManagePurchaseLinksProps {
  catalogId: string;
  gameTitle: string;
}

export function ManagePurchaseLinks({ catalogId, gameTitle }: ManagePurchaseLinksProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ retailer_name: "", url: "", retailer_logo_url: "", is_affiliate: false });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["admin-purchase-links", catalogId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_purchase_links" as any)
        .select("*")
        .eq("catalog_id", catalogId)
        .order("retailer_name");
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseLink[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-purchase-links", catalogId] });
    queryClient.invalidateQueries({ queryKey: ["purchase-links", catalogId] });
  };

  const addLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("catalog_purchase_links" as any).insert({
        catalog_id: catalogId,
        retailer_name: form.retailer_name,
        url: form.url,
        retailer_logo_url: form.retailer_logo_url || null,
        is_affiliate: form.is_affiliate,
        source: "manual",
        status: "approved",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase link added");
      setForm({ retailer_name: "", url: "", retailer_logo_url: "", is_affiliate: false });
      setShowForm(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to add link"),
  });

  const updateLink = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase
        .from("catalog_purchase_links" as any)
        .update({
          retailer_name: form.retailer_name,
          url: form.url,
          retailer_logo_url: form.retailer_logo_url || null,
          is_affiliate: form.is_affiliate,
        } as any)
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link updated");
      setEditingId(null);
      setForm({ retailer_name: "", url: "", retailer_logo_url: "", is_affiliate: false });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update"),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("catalog_purchase_links" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link removed");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("catalog_purchase_links" as any)
        .update({ status } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update status"),
  });

  const startEdit = (link: PurchaseLink) => {
    setEditingId(link.id);
    setForm({
      retailer_name: link.retailer_name,
      url: link.url,
      retailer_logo_url: link.retailer_logo_url || "",
      is_affiliate: link.is_affiliate,
    });
    setShowForm(false);
  };

  const scanGame = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { url: apiUrl, anonKey } = getSupabaseConfig();
      const res = await fetch(`${apiUrl}/functions/v1/purchase-link-scanner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ action: "scan-single", catalog_id: catalogId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Scan complete: ${data.links_found} links found`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Scan failed"),
  });

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>🛒 Purchase Links (Admin)</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => scanGame.mutate()} disabled={scanGame.isPending}>
              {scanGame.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
              Auto-Scan
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(!showForm); setEditingId(null); }}>
              <Plus className="h-3 w-3 mr-1" /> Add Link
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(showForm || editingId) && (
          <div className="grid gap-2 p-3 rounded-md bg-background border border-border">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Retailer Name</Label>
                <Input
                  value={form.retailer_name}
                  onChange={(e) => setForm({ ...form, retailer_name: e.target.value })}
                  placeholder="e.g. Allplay, Amazon"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">URL</Label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Logo URL (optional)</Label>
                <Input
                  value={form.retailer_logo_url}
                  onChange={(e) => setForm({ ...form, retailer_logo_url: e.target.value })}
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_affiliate}
                    onChange={(e) => setForm({ ...form, is_affiliate: e.target.checked })}
                  />
                  Affiliate link
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!form.retailer_name || !form.url || addLink.isPending || updateLink.isPending}
                onClick={() => editingId ? updateLink.mutate() : addLink.mutate()}
              >
                {(addLink.isPending || updateLink.isPending) && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {editingId ? "Update" : "Add"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : links.length === 0 ? (
          <p className="text-xs text-muted-foreground">No purchase links yet.</p>
        ) : (
          <div className="space-y-1.5">
            {links.map((link) => (
              <div key={link.id} className="flex items-center gap-2 text-sm p-2 rounded bg-background border border-border">
                <span className="flex-1 truncate font-medium">{link.retailer_name}</span>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">
                  {new URL(link.url).hostname}
                </a>
                {link.source !== "manual" && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{link.source}</span>
                )}
                {link.status === "pending" && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500" onClick={() => updateStatus.mutate({ id: link.id, status: "approved" })}>
                    <Check className="h-3 w-3" />
                  </Button>
                )}
                {link.status === "pending" && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => updateStatus.mutate({ id: link.id, status: "rejected" })}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(link)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteLink.mutate(link.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
