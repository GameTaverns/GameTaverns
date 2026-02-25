import { useState } from "react";
import { UserPlus, Check, Clock, Mail, PartyPopper, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/backend/client";
import { RecaptchaWidget } from "@/components/games/RecaptchaWidget";
import { Link } from "react-router-dom";

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

  if (!isPublic) return null;

  const isFull = maxAttendees ? registrationCount >= maxAttendees : false;
  const capacityPercent = maxAttendees ? Math.min(100, (registrationCount / maxAttendees) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check
    if (honeypot) {
      toast({ title: "Verification failed", variant: "destructive" });
      return;
    }

    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Determine status
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

      const { error } = await db
        .from("event_registrations")
        .insert({
          event_id: eventId,
          attendee_name: name.trim(),
          attendee_email: email.trim(),
          attendee_user_id: isAuthenticated ? user?.id : null,
          status,
          waitlist_position: waitlistPosition,
        });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already registered", description: "This name is already registered for this event.", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }

      setResultStatus(status as "registered" | "waitlisted");
      setSubmitted(true);
      toast({
        title: status === "waitlisted" ? "Added to waitlist!" : "You're registered!",
        description: status === "waitlisted"
          ? `You're #${waitlistPosition} on the waitlist for "${eventTitle}"`
          : `You're confirmed for "${eventTitle}"`,
      });
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

          {/* Prompt to create account */}
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
              placeholder="For event updates and reminders"
              required
              maxLength={255}
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
