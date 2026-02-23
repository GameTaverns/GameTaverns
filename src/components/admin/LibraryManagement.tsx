import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink, Crown, Library, Ban, CheckCircle, History, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { getLibraryUrl } from "@/hooks/useTenantUrl";

interface LibraryWithOwner {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
  owner_display_name: string | null;
}

interface SuspensionRecord {
  id: string;
  library_id: string;
  action: "suspended" | "unsuspended";
  reason: string | null;
  performed_by: string;
  created_at: string;
  performer_name?: string;
}

export function LibraryManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState<LibraryWithOwner | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");

  // Fetch all libraries with owner info
  const { data: libraries, isLoading } = useQuery({
    queryKey: ["admin-libraries"],
    queryFn: async (): Promise<LibraryWithOwner[]> => {
      // In self-hosted mode, use API endpoint
      if (isSelfHostedMode()) {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/admin/libraries', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error('Failed to fetch libraries');
        return res.json();
      }
      
      // Cloud mode: use Supabase client
      const { data: libs, error: libsError } = await supabase
        .from("libraries")
        .select("*")
        .order("created_at", { ascending: false });

      if (libsError) throw libsError;

      // Get owner profiles
      const ownerIds = [...new Set(libs?.map((l) => l.owner_id) || [])];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, display_name")
        .in("user_id", ownerIds);

      // Get co-owners for all libraries
      const libIds = libs?.map((l) => l.id) || [];
      const { data: coOwners } = await supabase
        .from("library_members")
        .select("library_id, user_id")
        .in("library_id", libIds)
        .eq("role", "co_owner");

      // Fetch co-owner profiles
      const coOwnerUserIds = [...new Set(coOwners?.map((c) => c.user_id) || [])].filter(id => !ownerIds.includes(id));
      let coOwnerProfiles: { user_id: string; display_name: string | null }[] = [];
      if (coOwnerUserIds.length > 0) {
        const { data } = await supabase
          .from("user_profiles")
          .select("user_id, display_name")
          .in("user_id", coOwnerUserIds);
        coOwnerProfiles = data || [];
      }
      const allProfiles = [...(profiles || []), ...coOwnerProfiles];

      // Combine data
      const librariesWithOwners: LibraryWithOwner[] = (libs || []).map((lib) => {
        const owner = allProfiles.find((p) => p.user_id === lib.owner_id);
        const libCoOwners = coOwners?.filter((c) => c.library_id === lib.id) || [];
        const coOwnerNames = libCoOwners
          .map((c) => allProfiles.find((p) => p.user_id === c.user_id)?.display_name || "Unknown")
          .filter(Boolean);
        
        let ownerLabel = owner?.display_name || "Unknown";
        if (coOwnerNames.length > 0) {
          ownerLabel += ` + ${coOwnerNames.join(", ")}`;
        }

        return {
          id: lib.id,
          name: lib.name,
          slug: lib.slug,
          description: lib.description,
          is_active: lib.is_active,
          is_premium: lib.is_premium,
          created_at: lib.created_at,
          owner_display_name: ownerLabel,
        };
      });

      return librariesWithOwners;
    },
  });

  // Fetch suspension history for selected library
  const { data: suspensionHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["library-suspensions", selectedLibrary?.id],
    queryFn: async (): Promise<SuspensionRecord[]> => {
      if (!selectedLibrary) return [];

      // Self-hosted mode
      if (isSelfHostedMode()) {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/admin/libraries/${selectedLibrary.id}/suspensions`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch suspension history');
        return res.json();
      }

      // Cloud mode
      const { data, error } = await supabase
        .from("library_suspensions")
        .select("*")
        .eq("library_id", selectedLibrary.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get performer names
      const performerIds = [...new Set(data?.map((s) => s.performed_by) || [])];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, display_name")
        .in("user_id", performerIds);

      return (data || []).map((record) => ({
        ...record,
        performer_name: profiles?.find((p) => p.user_id === record.performed_by)?.display_name || "Unknown",
      })) as SuspensionRecord[];
    },
    enabled: !!selectedLibrary && historyDialogOpen,
  });

  // Suspend library mutation
  const suspendMutation = useMutation({
    mutationFn: async ({ libraryId, reason }: { libraryId: string; reason: string }) => {
      if (isSelfHostedMode()) {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/admin/libraries/${libraryId}/suspend`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) throw new Error('Failed to suspend library');
        return;
      }

      // Cloud mode
      const { error: updateError } = await supabase
        .from("libraries")
        .update({ is_active: false })
        .eq("id", libraryId);

      if (updateError) throw updateError;

      const { error: recordError } = await supabase
        .from("library_suspensions")
        .insert({
          library_id: libraryId,
          action: "suspended",
          reason,
          performed_by: user?.id,
        });

      if (recordError) throw recordError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
      queryClient.invalidateQueries({ queryKey: ["library-suspensions"] });
      toast.success("Library suspended");
      setSuspendDialogOpen(false);
      setSuspensionReason("");
      setSelectedLibrary(null);
    },
    onError: () => {
      toast.error("Failed to suspend library");
    },
  });

  // Unsuspend library mutation
  const unsuspendMutation = useMutation({
    mutationFn: async (libraryId: string) => {
      if (isSelfHostedMode()) {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/admin/libraries/${libraryId}/unsuspend`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to unsuspend library');
        return;
      }

      // Cloud mode
      const { error: updateError } = await supabase
        .from("libraries")
        .update({ is_active: true })
        .eq("id", libraryId);

      if (updateError) throw updateError;

      const { error: recordError } = await supabase
        .from("library_suspensions")
        .insert({
          library_id: libraryId,
          action: "unsuspended",
          reason: null,
          performed_by: user?.id,
        });

      if (recordError) throw recordError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
      queryClient.invalidateQueries({ queryKey: ["library-suspensions"] });
      toast.success("Library unsuspended");
    },
    onError: () => {
      toast.error("Failed to unsuspend library");
    },
  });

  // Toggle library premium status
  const togglePremiumMutation = useMutation({
    mutationFn: async ({ id, is_premium }: { id: string; is_premium: boolean }) => {
      if (isSelfHostedMode()) {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/admin/libraries/${id}/premium`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_premium }),
        });
        if (!res.ok) throw new Error('Failed to update premium status');
        return;
      }

      // Cloud mode
      const { error } = await supabase
        .from("libraries")
        .update({ is_premium })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-libraries"] });
      toast.success("Premium status updated");
    },
    onError: () => {
      toast.error("Failed to update premium status");
    },
  });

  const handleSuspendClick = (library: LibraryWithOwner) => {
    setSelectedLibrary(library);
    setSuspendDialogOpen(true);
  };

  const handleHistoryClick = (library: LibraryWithOwner) => {
    setSelectedLibrary(library);
    setHistoryDialogOpen(true);
  };

  const handleSuspendConfirm = () => {
    if (!selectedLibrary || !suspensionReason.trim()) {
      toast.error("Please provide a reason for suspension");
      return;
    }
    suspendMutation.mutate({ libraryId: selectedLibrary.id, reason: suspensionReason });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-cream">All Libraries ({libraries?.length || 0})</h3>
      </div>

      <div className="rounded-lg border border-wood-medium/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-wood-medium/30 hover:bg-wood-medium/40">
              <TableHead className="text-cream/70">Library</TableHead>
              <TableHead className="text-cream/70">Owner</TableHead>
              <TableHead className="text-cream/70">Created</TableHead>
              <TableHead className="text-cream/70">Status</TableHead>
              <TableHead className="text-cream/70">Premium</TableHead>
              <TableHead className="text-cream/70">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {libraries?.map((library) => (
              <TableRow key={library.id} className="border-wood-medium/30 hover:bg-wood-medium/20">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-wood-medium flex items-center justify-center">
                      <Library className="w-4 h-4 text-secondary" />
                    </div>
                    <div>
                      <div className="text-cream font-medium">{library.name}</div>
                      <div className="text-cream/50 text-sm">/{library.slug}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-cream/70">{library.owner_display_name}</TableCell>
                <TableCell className="text-cream/70">
                  {format(new Date(library.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {library.is_active ? (
                      <>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => handleSuspendClick(library)}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Suspend
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Suspended
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          onClick={() => unsuspendMutation.mutate(library.id)}
                          disabled={unsuspendMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Unsuspend
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={library.is_premium}
                      onCheckedChange={(checked) =>
                        togglePremiumMutation.mutate({ id: library.id, is_premium: checked })
                      }
                    />
                    {library.is_premium && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-cream/70 hover:text-cream"
                      onClick={() => handleHistoryClick(library)}
                    >
                      <History className="w-4 h-4 mr-1" />
                      History
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-cream/70 hover:text-cream"
                      asChild
                    >
                      <a href={getLibraryUrl(library.slug, "/")} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View
                      </a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!libraries || libraries.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-cream/50 py-8">
                  No libraries found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="bg-wood-dark border-wood-medium">
          <DialogHeader>
            <DialogTitle className="text-cream flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-400" />
              Suspend Library
            </DialogTitle>
            <DialogDescription className="text-cream/70">
              Suspending "{selectedLibrary?.name}" will make it inaccessible to visitors.
              This action will be recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-cream">Reason for Suspension *</Label>
              <Textarea
                id="reason"
                placeholder="Describe why this library is being suspended..."
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                className="bg-wood-medium/30 border-wood-medium text-cream placeholder:text-cream/50"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setSuspendDialogOpen(false);
                setSuspensionReason("");
              }}
              className="text-cream"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspendConfirm}
              disabled={suspendMutation.isPending || !suspensionReason.trim()}
            >
              {suspendMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              Suspend Library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="bg-wood-dark border-wood-medium sm:max-w-2xl max-h-[100dvh] sm:max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-cream flex items-center gap-2">
              <History className="w-5 h-5 text-secondary" />
              Suspension History - {selectedLibrary?.name}
            </DialogTitle>
            <DialogDescription className="text-cream/70">
              Complete audit trail of suspension and unsuspension actions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-y-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-secondary" />
              </div>
            ) : suspensionHistory && suspensionHistory.length > 0 ? (
              <div className="space-y-3">
                {suspensionHistory.map((record) => (
                  <div
                    key={record.id}
                    className={`p-3 rounded-lg border ${
                      record.action === "suspended"
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-green-500/10 border-green-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        className={
                          record.action === "suspended"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-green-500/20 text-green-400"
                        }
                      >
                        {record.action === "suspended" ? (
                          <Ban className="w-3 h-3 mr-1" />
                        ) : (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        )}
                        {record.action === "suspended" ? "Suspended" : "Unsuspended"}
                      </Badge>
                      <span className="text-cream/50 text-sm">
                        {format(new Date(record.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    <div className="text-cream/70 text-sm">
                      <span className="text-cream/50">By:</span> {record.performer_name}
                    </div>
                    {record.reason && (
                      <div className="mt-2 text-cream/80 text-sm">
                        <span className="text-cream/50">Reason:</span> {record.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-cream/50 py-8">
                No suspension history for this library
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setHistoryDialogOpen(false)}
              className="text-cream"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
