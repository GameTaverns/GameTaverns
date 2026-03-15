import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, Clock, Loader2 } from "lucide-react";

interface AddGameStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (status: "owned" | "coming_soon") => void;
  isPending?: boolean;
  gameTitle?: string;
}

export function AddGameStatusDialog({ open, onOpenChange, onSelect, isPending, gameTitle }: AddGameStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to Library</DialogTitle>
          <DialogDescription>
            {gameTitle ? `How do you want to add "${gameTitle}"?` : "How do you want to add this game?"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button
            variant="default"
            className="justify-start gap-3 h-auto py-3 px-4"
            disabled={isPending}
            onClick={() => onSelect("owned")}
          >
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Package className="h-5 w-5" />}
            <div className="text-left">
              <div className="font-medium">I own this</div>
              <div className="text-xs text-primary-foreground/70">Add to my collection now</div>
            </div>
          </Button>
          <Button
            variant="secondary"
            className="justify-start gap-3 h-auto py-3 px-4"
            disabled={isPending}
            onClick={() => onSelect("coming_soon")}
          >
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />}
            <div className="text-left">
              <div className="font-medium">Coming Soon</div>
              <div className="text-xs text-muted-foreground">Pledged, pre-ordered, or on the way</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
