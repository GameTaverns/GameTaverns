import { useState, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/backend/client";
import { TurnstileWidget } from "./TurnstileWidget";

// Enhanced email regex for stricter validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// URL/link detection regex
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim()
    .min(1, "Email is required")
    .max(255, "Email must be less than 255 characters")
    .refine((val) => EMAIL_REGEX.test(val), { message: "Please enter a valid email address" }),
  message: z.string().trim()
    .min(1, "Message is required")
    .max(2000, "Message must be less than 2000 characters")
    .refine((val) => !URL_REGEX.test(val), { message: "Links are not allowed in messages" }),
});

interface ContactSellerFormProps {
  gameId: string;
  gameTitle: string;
}

export function ContactSellerForm({ gameId, gameTitle }: ContactSellerFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const { toast } = useToast();

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate input
    const result = contactSchema.safeParse({ name, email, message });
    if (!result.success) {
      const fieldErrors: { name?: string; email?: string; message?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Check CAPTCHA
    if (!turnstileToken) {
      toast({
        title: "Please complete the CAPTCHA",
        description: "Verify you're human before sending.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use edge function for rate-limited, validated message sending
      const { data, error } = await supabase.functions.invoke("send-message", {
        body: {
          game_id: gameId,
          sender_name: result.data.name,
          sender_email: result.data.email,
          message: result.data.message,
          turnstile_token: turnstileToken,
        },
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || "Failed to send message");
      }

      toast({
        title: "Message sent!",
        description: "Your inquiry has been sent to the seller.",
      });

      // Reset form and CAPTCHA
      setName("");
      setEmail("");
      setMessage("");
      setTurnstileToken(null);
      setTurnstileKey(prev => prev + 1);
    } catch (error: any) {
      toast({
        title: "Error sending message",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="font-display text-lg">Interested in this game?</CardTitle>
        <CardDescription>
          Send a message about "{gameTitle}"
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Your Name *</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              disabled={isSubmitting}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email">Your Email *</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              disabled={isSubmitting}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-message">Message *</Label>
            <Textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="I'm interested in purchasing this game..."
              rows={4}
              disabled={isSubmitting}
              className={errors.message ? "border-destructive" : ""}
            />
            {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Verification *</Label>
            <TurnstileWidget
              key={turnstileKey}
              onVerify={handleTurnstileVerify}
              onExpire={handleTurnstileExpire}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || !turnstileToken}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
