import { useState, useEffect, useCallback } from "react";

import { Send, Loader2, LogIn } from "lucide-react";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantUrl } from "@/hooks/useTenantUrl";
import { useUserProfile } from "@/hooks/useLibrary";

const RECAPTCHA_SITE_KEY = "6LdkyXEsAAAAAK1Z9CISXvqloXriS6kGA1L4BqrY";

async function getRecaptchaToken(action: string): Promise<string> {
  try {
    if (!window.grecaptcha) {
      // Load script if not present
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector(`script[src*="recaptcha/api.js"]`);
        if (existing) { resolve(); return; }
        const s = document.createElement("script");
        s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("reCAPTCHA load failed"));
        document.head.appendChild(s);
      });
      await new Promise<void>((resolve) => {
        const iv = setInterval(() => { if (window.grecaptcha) { clearInterval(iv); resolve(); } }, 100);
      });
    }
    return await new Promise<string>((resolve) => {
      window.grecaptcha!.ready(async () => {
        try {
          const token = await window.grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch {
          resolve("RECAPTCHA_EXECUTE_FAILED");
        }
      });
    });
  } catch {
    return "RECAPTCHA_LOAD_FAILED";
  }
}

// URL/link detection regex
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
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
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; message?: string }>({});
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const { buildUrl } = useTenantUrl();
  const { data: userProfile } = useUserProfile();

  // Auto-populate name and message from user profile
  useEffect(() => {
    if (userProfile?.display_name && !name) {
      setName(userProfile.display_name);
    }
  }, [userProfile?.display_name]);

  // Pre-fill with game interest message
  useEffect(() => {
    if (!message && gameTitle) {
      setMessage(`Hi! I'm interested in "${gameTitle}". Is it still available? I'd love to discuss details.`);
    }
  }, [gameTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate input
    const result = contactSchema.safeParse({ name, message });
    if (!result.success) {
      const fieldErrors: { name?: string; message?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Get reCAPTCHA token invisibly
      const recaptcha_token = await getRecaptchaToken("send_message");

      // Use edge function for rate-limited, validated message sending
      const { data, error } = await supabase.functions.invoke("send-message", {
        body: {
          game_id: gameId,
          sender_name: result.data.name,
          message: result.data.message,
          recaptcha_token,
        },
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || "Failed to send message");
      }

      toast({
        title: "Message sent!",
        description: "Your inquiry has been sent as a direct message. Check your DMs for replies.",
      });

      // Reset form
      setName("");
      setMessage("");
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

  // Require login to send messages
  if (!isAuthenticated) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="font-display text-lg">Interested in this game?</CardTitle>
          <CardDescription>
            Sign in to send a message about "{gameTitle}"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to={buildUrl("/login")}>
            <Button className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              Sign in to Contact Seller
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

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
              placeholder="Your display name"
              disabled={isSubmitting}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
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
