import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWishlist } from "@/hooks/useWishlist";
import { User } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function WishlistNamePrompt() {
  const { guestName, updateGuestName } = useWishlist();
  const [localName, setLocalName] = useState(guestName);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    updateGuestName(localName);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <User className="h-4 w-4" />
          {guestName || "Set your name"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Your Name</h4>
            <p className="text-sm text-muted-foreground">
              Optionally set your name so others can see who's interested in each game.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter your name (optional)"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
            />
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
