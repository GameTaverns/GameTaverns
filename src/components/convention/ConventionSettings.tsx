import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ConventionStaffPanel } from "./ConventionStaffPanel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conventionSettings: any;
  event: any;
}

export function ConventionSettings({ open, onOpenChange, conventionSettings, event }: Props) {
  const queryClient = useQueryClient();
  const [lendingEnabled, setLendingEnabled] = useState(conventionSettings?.lending_enabled ?? true);
  const [reservationEnabled, setReservationEnabled] = useState(conventionSettings?.reservation_enabled ?? true);
  const [kioskMode, setKioskMode] = useState(conventionSettings?.kiosk_mode_enabled ?? false);
  const [quickSignup, setQuickSignup] = useState(conventionSettings?.quick_signup_enabled ?? true);
  const [holdMinutes, setHoldMinutes] = useState(conventionSettings?.reservation_hold_minutes ?? 30);
  const [maxLoans, setMaxLoans] = useState(conventionSettings?.max_concurrent_loans ?? 3);

  const updateSettings = useMutation({
    mutationFn: async () => {
      if (!conventionSettings?.id) throw new Error("No convention settings found");
      const { error } = await supabase
        .from("convention_events")
        .update({
          lending_enabled: lendingEnabled,
          reservation_enabled: reservationEnabled,
          kiosk_mode_enabled: kioskMode,
          quick_signup_enabled: quickSignup,
          reservation_hold_minutes: holdMinutes,
          max_concurrent_loans: maxLoans,
        })
        .eq("id", conventionSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convention settings updated");
      queryClient.invalidateQueries({ queryKey: ["convention-settings"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clubId = conventionSettings?.club_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Convention Settings</DialogTitle>
          <DialogDescription>{event?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Features</h4>
            <div className="flex items-center justify-between">
              <Label htmlFor="lending" className="text-sm">Game Lending</Label>
              <Switch id="lending" checked={lendingEnabled} onCheckedChange={setLendingEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="reservations" className="text-sm">Reservations</Label>
              <Switch id="reservations" checked={reservationEnabled} onCheckedChange={setReservationEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="kiosk" className="text-sm">Kiosk Mode</Label>
              <Switch id="kiosk" checked={kioskMode} onCheckedChange={setKioskMode} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="quicksignup" className="text-sm">Quick Signup</Label>
              <Switch id="quicksignup" checked={quickSignup} onCheckedChange={setQuickSignup} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Limits</h4>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="hold" className="text-sm whitespace-nowrap">Reservation Hold (min)</Label>
              <Input
                id="hold"
                type="number"
                min={5}
                max={120}
                value={holdMinutes}
                onChange={e => setHoldMinutes(parseInt(e.target.value) || 30)}
                className="w-20 h-8 text-sm"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="maxloans" className="text-sm whitespace-nowrap">Max Concurrent Loans</Label>
              <Input
                id="maxloans"
                type="number"
                min={1}
                max={20}
                value={maxLoans}
                onChange={e => setMaxLoans(parseInt(e.target.value) || 3)}
                className="w-20 h-8 text-sm"
              />
            </div>
          </div>

          {clubId && conventionSettings?.id && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Volunteer Staff</h4>
                <p className="text-xs text-muted-foreground">
                  Assign club members as convention staff — they'll get access to the Command Center and Lending Desk
                </p>
                <ConventionStaffPanel
                  conventionEventId={conventionSettings.id}
                  clubId={clubId}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
