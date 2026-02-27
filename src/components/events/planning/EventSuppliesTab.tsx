import { useState } from "react";
import { Plus, Package, Trash2, Check, UtensilsCrossed, Coffee, Wrench, Gamepad2, HelpCircle, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEventSupplies, useAddEventSupply, useRemoveEventSupply, useClaimSupply, useUpdateEventSupply, type EventSupply } from "@/hooks/useEventPlanning";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  food: <UtensilsCrossed className="h-3.5 w-3.5" />,
  drinks: <Coffee className="h-3.5 w-3.5" />,
  equipment: <Wrench className="h-3.5 w-3.5" />,
  games: <Gamepad2 className="h-3.5 w-3.5" />,
  other: <HelpCircle className="h-3.5 w-3.5" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food",
  drinks: "Drinks",
  equipment: "Equipment",
  games: "Games",
  other: "Other",
};

interface EventSuppliesTabProps {
  eventId: string;
}

export function EventSuppliesTab({ eventId }: EventSuppliesTabProps) {
  const { data: supplies = [], isLoading } = useEventSupplies(eventId);
  const addSupply = useAddEventSupply();
  const removeSupply = useRemoveEventSupply();
  const claimSupply = useClaimSupply();
  const updateSupply = useUpdateEventSupply();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSupply, setEditingSupply] = useState<EventSupply | null>(null);

  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState("other");

  const resetForm = () => { setItemName(""); setQuantity("1"); setCategory("other"); };

  const handleAdd = async () => {
    if (!itemName.trim()) return;
    await addSupply.mutateAsync({
      event_id: eventId,
      item_name: itemName.trim(),
      quantity: parseInt(quantity) || 1,
      category,
      claimed_by: null,
      claimed_by_user_id: null,
      is_fulfilled: false,
    });
    resetForm();
    setShowAddDialog(false);
  };

  const openEdit = (supply: EventSupply) => {
    setItemName(supply.item_name);
    setQuantity(supply.quantity.toString());
    setCategory(supply.category);
    setEditingSupply(supply);
  };

  const handleEdit = async () => {
    if (!editingSupply || !itemName.trim()) return;
    await updateSupply.mutateAsync({
      supplyId: editingSupply.id,
      eventId,
      updates: {
        item_name: itemName.trim(),
        quantity: parseInt(quantity) || 1,
        category,
      },
    });
    resetForm();
    setEditingSupply(null);
  };

  const handleClaim = (supply: EventSupply) => {
    const name = prompt("Your name:");
    if (!name) return;
    claimSupply.mutate({ supplyId: supply.id, eventId, claimedBy: name });
  };

  // Group by category
  const grouped = supplies.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, EventSupply[]>);

  const fulfilledCount = supplies.filter(s => s.is_fulfilled).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Supply Checklist
              </CardTitle>
              <CardDescription>
                {supplies.length > 0
                  ? `${fulfilledCount}/${supplies.length} items claimed`
                  : "Track what needs to be brought"}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : supplies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No supplies listed yet</p>
              <p className="text-xs mt-1">Add snacks, drinks, equipment, or games to bring</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {CATEGORY_ICONS[cat]}
                    {CATEGORY_LABELS[cat] || cat}
                  </div>
                  <div className="space-y-1">
                    {items.map((supply) => (
                      <SupplyItem
                        key={supply.id}
                        supply={supply}
                        onClaim={() => handleClaim(supply)}
                        onEdit={() => openEdit(supply)}
                        onRemove={() => removeSupply.mutate({ supplyId: supply.id, eventId })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(o) => { if (!o) resetForm(); setShowAddDialog(o); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Supply Item</DialogTitle>
          </DialogHeader>
          <SupplyFormFields
            itemName={itemName} setItemName={setItemName}
            quantity={quantity} setQuantity={setQuantity}
            category={category} setCategory={setCategory}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!itemName.trim() || addSupply.isPending}>
              {addSupply.isPending ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingSupply} onOpenChange={(o) => { if (!o) { resetForm(); setEditingSupply(null); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Supply Item</DialogTitle>
          </DialogHeader>
          <SupplyFormFields
            itemName={itemName} setItemName={setItemName}
            quantity={quantity} setQuantity={setQuantity}
            category={category} setCategory={setCategory}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setEditingSupply(null); }}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!itemName.trim() || updateSupply.isPending}>
              {updateSupply.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupplyFormFields({
  itemName, setItemName, quantity, setQuantity, category, setCategory,
}: {
  itemName: string; setItemName: (v: string) => void;
  quantity: string; setQuantity: (v: string) => void;
  category: string; setCategory: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Item *</Label>
        <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Chips & dip" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Quantity</Label>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={1} />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="drinks">Drinks</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
              <SelectItem value="games">Games</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function SupplyItem({ supply, onClaim, onEdit, onRemove }: { supply: EventSupply; onClaim: () => void; onEdit: () => void; onRemove: () => void }) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-md border transition-colors group ${supply.is_fulfilled ? "bg-muted/50 opacity-75" : "bg-card hover:bg-muted/30"}`}>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${supply.is_fulfilled ? "line-through text-muted-foreground" : ""}`}>
          {supply.item_name}
        </span>
        {supply.quantity > 1 && (
          <Badge variant="outline" className="ml-2 text-xs">×{supply.quantity}</Badge>
        )}
        {supply.claimed_by && (
          <span className="ml-2 text-xs text-muted-foreground">— {supply.claimed_by}</span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!supply.is_fulfilled && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClaim}>
            <Check className="h-3 w-3 mr-1" /> Claim
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
