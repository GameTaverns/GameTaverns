import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import QRCodeLib from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useGameAvailability } from "@/hooks/useGameAvailability";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  MapPin,
  Globe,
  BookOpen,
  DollarSign,
  Tag,
  QrCode,
  Download,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { useTenant } from "@/contexts/TenantContext";

const CONDITIONS = ["Mint", "Like New", "Very Good", "Good", "Acceptable", "Poor"];
const ACQUISITION_SOURCES = ["Purchased", "Gift", "Trade", "Prize", "Kickstarter", "Thrift", "Other"];

interface GameCopyRow {
  id: string;
  game_id: string;
  copy_number: number;
  copy_label: string | null;
  condition: string | null;
  notes: string | null;
  edition: string | null;
  language: string | null;
  location_room: string | null;
  location_shelf: string | null;
  location_misc: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  acquisition_source: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  gameId: string;
  gameTitle: string;
  gameSlug?: string | null;
  copiesOwned: number;
  canManage: boolean;
}

export function GameCopyManager({ gameId, gameTitle, gameSlug, copiesOwned, canManage }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { tenantSlug } = useTenant();
  const [showCreate, setShowCreate] = useState(false);
  const [editCopy, setEditCopy] = useState<GameCopyRow | null>(null);
  const [expandedCopy, setExpandedCopy] = useState<string | null>(null);
  const [qrCopy, setQrCopy] = useState<GameCopyRow | null>(null);
  const librarySlug = tenantSlug || "";

  const { data: copies = [], isLoading } = useQuery({
    queryKey: ["game-copies", gameId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_copies")
        .select("*")
        .eq("game_id", gameId)
        .order("copy_number");
      if (error) throw error;
      return data as GameCopyRow[];
    },
  });

  const { data: availability } = useGameAvailability(gameId);

  const deleteCopy = useMutation({
    mutationFn: async (copyId: string) => {
      const { error } = await (supabase as any)
        .from("game_copies")
        .delete()
        .eq("id", copyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game-copies", gameId] });
      qc.invalidateQueries({ queryKey: ["game-availability", gameId] });
      toast({ title: "Copy deleted" });
    },
  });

  const untrackedCount = Math.max(0, copiesOwned - copies.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Copies & Inventory
          </h2>
          {availability && (
            <p className={cn(
              "text-sm",
              availability.available <= 0 ? "text-destructive" : "text-muted-foreground"
            )}>
              {availability.available} of {availability.copiesOwned} available
              {(availability.activePersonalLoans > 0 || availability.activeClubLoans > 0) && (
                <span className="ml-1">
                  ({availability.activePersonalLoans + availability.activeClubLoans} out on loan)
                </span>
              )}
            </p>
          )}
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Track Copy
          </Button>
        )}
      </div>

      {copies.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {copiesOwned} {copiesOwned === 1 ? "copy" : "copies"} owned — none individually tracked yet.
            </p>
            {canManage && (
              <p className="text-xs mt-1">Track individual copies to record edition, condition, and location per copy.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tracked copies */}
      <div className="space-y-2">
        {copies.map((copy) => (
          <Collapsible
            key={copy.id}
            open={expandedCopy === copy.id}
            onOpenChange={(open) => setExpandedCopy(open ? copy.id : null)}
          >
            <Card>
              <CardContent className="p-3">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="shrink-0">
                        #{copy.copy_number}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {copy.copy_label || `Copy ${copy.copy_number}`}
                      </span>
                      {copy.edition && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {copy.edition}
                        </Badge>
                      )}
                      {copy.condition && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {copy.condition}
                        </Badge>
                      )}
                      {copy.language && copy.language !== "English" && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          <Globe className="h-2.5 w-2.5 mr-0.5" />
                          {copy.language}
                        </Badge>
                      )}
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform shrink-0 ml-2",
                      expandedCopy === copy.id && "rotate-180"
                    )} />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                    {/* Location */}
                    {(copy.location_room || copy.location_shelf || copy.location_misc) && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          {[copy.location_room, copy.location_shelf, copy.location_misc]
                            .filter(Boolean)
                            .join(" › ")}
                        </span>
                      </div>
                    )}

                    {/* Acquisition */}
                    {(copy.acquisition_source || copy.purchase_date || copy.purchase_price != null) && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <Tag className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          {[
                            copy.acquisition_source,
                            copy.purchase_date,
                            copy.purchase_price != null ? `$${copy.purchase_price}` : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {copy.notes && (
                      <p className="text-muted-foreground text-xs">{copy.notes}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setQrCopy(copy); }}
                      >
                        <QrCode className="h-3 w-3 mr-1" /> QR Code
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setEditCopy(copy); }}
                          >
                            <Edit2 className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteCopy.mutate(copy.id); }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      {/* Untracked copies note */}
      {untrackedCount > 0 && copies.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          + {untrackedCount} additional {untrackedCount === 1 ? "copy" : "copies"} not individually tracked
        </p>
      )}

      {/* Create / Edit dialog */}
      {(showCreate || editCopy) && (
        <CopyFormDialog
          open={showCreate || !!editCopy}
          onOpenChange={(v) => { if (!v) { setShowCreate(false); setEditCopy(null); } }}
          gameId={gameId}
          existing={editCopy}
          nextCopyNumber={copies.length > 0 ? Math.max(...copies.map((c) => c.copy_number)) + 1 : 1}
          onSuccess={() => {
            setShowCreate(false);
            setEditCopy(null);
            qc.invalidateQueries({ queryKey: ["game-copies", gameId] });
            qc.invalidateQueries({ queryKey: ["game-availability", gameId] });
          }}
        />
      )}

      {/* QR Code dialog for individual copy */}
      {qrCopy && (
        <CopyQRDialog
          open={!!qrCopy}
          onOpenChange={(v) => { if (!v) setQrCopy(null); }}
          copy={qrCopy}
          gameTitle={gameTitle}
          gameSlug={gameSlug}
          librarySlug={librarySlug}
        />
      )}
    </div>
  );
}

function CopyFormDialog({
  open,
  onOpenChange,
  gameId,
  existing,
  nextCopyNumber,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gameId: string;
  existing: GameCopyRow | null;
  nextCopyNumber: number;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [copyLabel, setCopyLabel] = useState(existing?.copy_label || "");
  const [condition, setCondition] = useState(existing?.condition || "");
  const [edition, setEdition] = useState(existing?.edition || "");
  const [language, setLanguage] = useState(existing?.language || "English");
  const [locationRoom, setLocationRoom] = useState(existing?.location_room || "");
  const [locationShelf, setLocationShelf] = useState(existing?.location_shelf || "");
  const [locationMisc, setLocationMisc] = useState(existing?.location_misc || "");
  const [purchaseDate, setPurchaseDate] = useState(existing?.purchase_date || "");
  const [purchasePrice, setPurchasePrice] = useState(existing?.purchase_price?.toString() || "");
  const [acquisitionSource, setAcquisitionSource] = useState(existing?.acquisition_source || "");
  const [notes, setNotes] = useState(existing?.notes || "");

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        copy_label: copyLabel.trim() || null,
        condition: condition || null,
        edition: edition.trim() || null,
        language: language.trim() || null,
        location_room: locationRoom.trim() || null,
        location_shelf: locationShelf.trim() || null,
        location_misc: locationMisc.trim() || null,
        purchase_date: purchaseDate || null,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        acquisition_source: acquisitionSource || null,
        notes: notes.trim() || null,
      };

      if (existing) {
        const { error } = await (supabase as any)
          .from("game_copies")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
        toast({ title: "Copy updated" });
      } else {
        const { error } = await (supabase as any)
          .from("game_copies")
          .insert({
            ...payload,
            game_id: gameId,
            copy_number: nextCopyNumber,
          });
        if (error) throw error;
        toast({ title: "Copy tracked" });
      }
      onSuccess();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Copy" : "Track New Copy"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Copy Label</Label>
              <Input
                value={copyLabel}
                onChange={(e) => setCopyLabel(e.target.value)}
                placeholder="e.g. Deluxe Edition"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Edition / Version</Label>
              <Input
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                placeholder="e.g. 2nd Edition"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Language</Label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="English"
                className="mt-1"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <MapPin className="h-3.5 w-3.5" /> Location
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={locationRoom}
                onChange={(e) => setLocationRoom(e.target.value)}
                placeholder="Room"
              />
              <Input
                value={locationShelf}
                onChange={(e) => setLocationShelf(e.target.value)}
                placeholder="Shelf"
              />
              <Input
                value={locationMisc}
                onChange={(e) => setLocationMisc(e.target.value)}
                placeholder="Other"
              />
            </div>
          </div>

          {/* Acquisition */}
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Acquisition
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Select value={acquisitionSource} onValueChange={setAcquisitionSource}>
                <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  {ACQUISITION_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="Price"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details about this specific copy..."
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : existing ? "Save Changes" : "Track Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
