import { useState } from "react";
import { UserPlus, Clock, PartyPopper, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/backend/client";
import { RecaptchaWidget } from "@/components/games/RecaptchaWidget";
import { Link } from "react-router-dom";
import { CatalogGamePicker } from "@/components/events/CatalogGamePicker";
import type { CatalogSearchResult } from "@/hooks/useCatalogGameSearch";

const db = supabase as any;

interface GuestRsvpCardProps {
  eventId: string;
  eventTitle: string;
  maxAttendees: number | null;
  isPublic: boolean;
  registrationCount?: number;
}

export function GuestRsvpCard({ eventId, eventTitle, maxAttendees, isPublic, registrationCount = 0 }: GuestRsvpCardProps) {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resultStatus, setResultStatus] = useState<"registered" | "waitlisted" | null>(null);
  const [gamePreferences, setGamePreferences] = useState<CatalogSearchResult[]>([]);
  const [bringingText, setBringingText] = useState("");
  const [notesForHost, setNotesForHost] = useState("");
  const [guestCount, setGuestCount] = useState(0);

  if (!isPublic) return null;

  const isFull = maxAttendees ? registrationCount >= maxAttendees : false;
  const capacityPercent = maxAttendees ? Math.min(100, (registrationCount / maxAttendees) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (honeypot) {
      toast({ title: "Verification failed", variant: "destructive" });
      return;
    }

    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();
      const linkedUserId =
        isAuthenticated && user?.id && user?.email?.toLowerCase() === normalizedEmail
          ? user.id
          : null;

      let status = "registered";
      let waitlistPosition: number | null = null;

      if (maxAttendees && registrationCount >= maxAttendees) {
        status = "waitlisted";
        const { count } = await db
          .from("event_registrations")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("status", "waitlisted");
        waitlistPosition = (count || 0) + 1;
      }

      // Build notes from game preferences + host notes
      const notesParts: string[] = [];
      if (gamePreferences.length > 0) {
        notesParts.push(`Wants to play: ${gamePreferences.map(g => g.title).join(", ")}`);
      }
      if (notesForHost.trim()) {
        notesParts.push(notesForHost.trim());
      }

      const { error } = await db
        .from("event_registrations")
        .insert({
          event_id: eventId,
          attendee_name: normalizedName,
          attendee_email: normalizedEmail,
          attendee_user_id: linkedUserId,
          status,
          waitlist_position: waitlistPosition,
          notes: notesParts.length > 0 ? notesParts.join(" | ") : null,
          bringing_text: bringingText.trim() || null,
          guest_count: guestCount,
        });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already registered", description: "This name is already registered for this event.", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }

      // Auto-create supply items from "bringing" text
      if (bringingText.trim()) {
        try {
          const items = bringingText.split(/[,&]/).map(s => s.trim()).filter(Boolean);
          for (const item of items) {
            await db.from("event_supplies").insert({
              event_id: eventId,
              item_name: item,
              quantity: 1,
              category: "other",
              claimed_by: normalizedName,
              claimed_by_user_id: linkedUserId,
              is_fulfilled: true,
            });
          }
        } catch (supplyErr) {
          console.warn("Failed to auto-create supply items:", supplyErr);
        }
      }

      setResultStatus(status as "registered" | "waitlisted");
      setSubmitted(true);
      toast({
        title: status === "waitlisted" ? "Added to waitlist!" : "You're registered!",
        description: status === "waitlisted"
          ? `You're #${waitlistPosition} on the waitlist for "${eventTitle}"`
          : `You're confirmed for "${eventTitle}"`,
      });

      // Fire-and-forget: send RSVP confirmation email
      try {
        await db.functions.invoke("send-rsvp-confirmation", {
          body: {
            event_id: eventId,
            attendee_name: name.trim(),
            attendee_email: email.trim(),
            status,
            waitlist_position: waitlistPosition,
          },
        });
      } catch (_emailErr) {
        console.warn("RSVP confirmation email failed:", _emailErr);
      }
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            {resultStatus === "waitlisted" ? (
              <Clock className="h-6 w-6 text-primary" />
            ) : (
              <PartyPopper className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {resultStatus === "waitlisted" ? "You're on the waitlist!" : "You're registered!"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {resultStatus === "waitlisted"
                ? "We'll notify you if a spot opens up."
                : `See you at "${eventTitle}"!`}
            </p>
          </div>

          {!isAuthenticated && (
            <div className="bg-muted/50 rounded-lg p-4 mt-4 text-left space-y-2">
              <p className="text-sm font-medium">Want to manage your RSVPs and discover more events?</p>
              <p className="text-xs text-muted-foreground">
                Create a free GameTaverns account to track your events, get reminders, and join communities.
              </p>
              <Link to="/signup">
                <Button size="sm" className="mt-2 gap-1.5">
                  Create Account <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          RSVP for this Event
        </CardTitle>
        <CardDescription>
          {isFull
            ? "This event is full — join the waitlist to be notified if a spot opens."
            : maxAttendees
              ? `${maxAttendees - registrationCount} of ${maxAttendees} spots remaining`
              : "Free registration — all are welcome!"}
        </CardDescription>
        {maxAttendees && (
          <Progress value={capacityPercent} className="h-1.5 mt-2" />
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Core fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rsvp-name" className="text-sm">Name *</Label>
              <Input
                id="rsvp-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rsvp-email" className="text-sm">Email *</Label>
              <Input
                id="rsvp-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="For event updates"
                required
                maxLength={255}
              />
            </div>
          </div>

          {/* Game Preferences */}
          <div className="space-y-1.5">
            <Label className="text-sm">Games You Want to Play (optional)</Label>
            <CatalogGamePicker
              selected={gamePreferences}
              onSelect={(game) => setGamePreferences(prev => [...prev, game])}
              onRemove={(id) => setGamePreferences(prev => prev.filter(g => g.id !== id))}
              maxSelections={2}
              placeholder="Search for a game..."
            />
          </div>

          {/* Bringing + Guest Count row */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rsvp-bringing" className="text-sm">Bringing (optional)</Label>
              <Input
                id="rsvp-bringing"
                value={bringingText}
                onChange={e => setBringingText(e.target.value)}
                placeholder="Snacks, drinks, a game, etc."
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rsvp-guests" className="text-sm">Plus-ones</Label>
              <Input
                id="rsvp-guests"
                type="number"
                min={0}
                max={10}
                value={guestCount}
                onChange={e => setGuestCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20"
              />
            </div>
          </div>

          {/* Notes for host */}
          <div className="space-y-1.5">
            <Label htmlFor="rsvp-notes" className="text-sm">Note for Host (optional)</Label>
            <Textarea
              id="rsvp-notes"
              value={notesForHost}
              onChange={e => setNotesForHost(e.target.value)}
              placeholder="Running late, need directions, dietary restrictions, etc."
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Honeypot — invisible to humans */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
            <input
              type="text"
              name="website_url"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={e => setHoneypot(e.target.value)}
            />
          </div>

          <RecaptchaWidget action="event_rsvp" onVerify={setCaptchaToken} />

          {isFull && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Event is full — you'll be added to the waitlist
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting || !name.trim() || !email.trim()}>
            {isSubmitting ? "Registering..." : isFull ? "Join Waitlist" : "RSVP — I'm Going!"}
          </Button>

          {!isAuthenticated && (
            <p className="text-[11px] text-muted-foreground text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">Sign in</Link>
              {" "}to link this RSVP to your profile.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
