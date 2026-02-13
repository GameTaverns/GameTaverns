import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  useBulkEditGames,
  isBooleanField,
  type BulkEditField,
  type BulkEditMode,
} from "@/hooks/useBulkEditGames";
import {
  DIFFICULTY_OPTIONS,
  GAME_TYPE_OPTIONS,
  SALE_CONDITION_OPTIONS,
} from "@/types/game";
import { Loader2 } from "lucide-react";

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedGameIds: string[];
  onComplete: () => void;
}

const FIELD_OPTIONS: { value: BulkEditField; label: string; group: string }[] = [
  { value: "is_unplayed", label: "Unplayed", group: "Flags" },
  { value: "crowdfunded", label: "Crowdfunded", group: "Flags" },
  { value: "sleeved", label: "Sleeved", group: "Flags" },
  { value: "upgraded_components", label: "Upgraded Components", group: "Flags" },
  { value: "inserts", label: "Inserts", group: "Flags" },
  { value: "is_for_sale", label: "For Sale", group: "Flags" },
  { value: "is_coming_soon", label: "Coming Soon", group: "Flags" },
  { value: "game_type", label: "Game Type", group: "Metadata" },
  { value: "difficulty", label: "Difficulty", group: "Metadata" },
  { value: "location_room", label: "Location (Room)", group: "Metadata" },
  { value: "location_shelf", label: "Location (Shelf)", group: "Metadata" },
  { value: "location_misc", label: "Location (Other)", group: "Metadata" },
  { value: "sale_price", label: "Sale Price", group: "Sale Info" },
  { value: "sale_condition", label: "Sale Condition", group: "Sale Info" },
];

export function BulkEditDialog({
  open,
  onOpenChange,
  selectedGameIds,
  onComplete,
}: BulkEditDialogProps) {
  const { toast } = useToast();
  const bulkEdit = useBulkEditGames();

  const [field, setField] = useState<BulkEditField>("is_unplayed");
  const [mode, setMode] = useState<BulkEditMode>("set");
  const [boolValue, setBoolValue] = useState(true);
  const [textValue, setTextValue] = useState("");
  const [selectValue, setSelectValue] = useState("");
  const [numberValue, setNumberValue] = useState("");

  const isBoolean = isBooleanField(field);
  const canToggle = isBoolean;

  const handleApply = async () => {
    let value: any;

    if (mode === "toggle") {
      // No value needed for toggle
      value = undefined;
    } else if (isBoolean) {
      value = boolValue;
    } else if (field === "sale_price") {
      value = numberValue ? parseFloat(numberValue) : null;
    } else if (field === "game_type" || field === "difficulty" || field === "sale_condition") {
      value = selectValue || null;
    } else {
      value = textValue || null;
    }

    try {
      await bulkEdit.mutateAsync({
        gameIds: selectedGameIds,
        field,
        mode,
        value,
      });
      toast({
        title: "Bulk edit complete",
        description: `Updated ${selectedGameIds.length} games.`,
      });
      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Bulk edit failed",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const renderValueInput = () => {
    if (mode === "toggle") {
      return (
        <p className="text-sm text-muted-foreground py-2">
          Each game's current value will be flipped (true → false, false → true).
        </p>
      );
    }

    if (isBoolean) {
      return (
        <div className="flex items-center gap-3 py-2">
          <Switch checked={boolValue} onCheckedChange={setBoolValue} />
          <Label>{boolValue ? "Yes / True" : "No / False"}</Label>
        </div>
      );
    }

    if (field === "game_type") {
      return (
        <Select value={selectValue} onValueChange={setSelectValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select type..." />
          </SelectTrigger>
          <SelectContent>
            {GAME_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field === "difficulty") {
      return (
        <Select value={selectValue} onValueChange={setSelectValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select difficulty..." />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field === "sale_condition") {
      return (
        <Select value={selectValue} onValueChange={setSelectValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select condition..." />
          </SelectTrigger>
          <SelectContent>
            {SALE_CONDITION_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field === "sale_price") {
      return (
        <Input
          type="number"
          step="0.01"
          placeholder="Enter price..."
          value={numberValue}
          onChange={(e) => setNumberValue(e.target.value)}
        />
      );
    }

    // Text fields (location_room, location_shelf, location_misc)
    return (
      <Input
        placeholder="Enter value..."
        value={textValue}
        onChange={(e) => setTextValue(e.target.value)}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Quick Edit</DialogTitle>
          <DialogDescription>
            Apply changes to {selectedGameIds.length} selected game{selectedGameIds.length !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Field Selection */}
          <div className="space-y-2">
            <Label>Field to update</Label>
            <Select value={field} onValueChange={(v) => { setField(v as BulkEditField); setMode("set"); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Flags", "Metadata", "Sale Info"].map((group) => (
                  <div key={group}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
                    {FIELD_OPTIONS.filter((f) => f.group === group).map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <Label>Apply mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as BulkEditMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="set">Set all to a value</SelectItem>
                {canToggle && <SelectItem value="toggle">Toggle each</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Value Input */}
          <div className="space-y-2">
            <Label>{mode === "toggle" ? "Preview" : "Value"}</Label>
            {renderValueInput()}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={bulkEdit.isPending}>
            {bulkEdit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply to {selectedGameIds.length} game{selectedGameIds.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
