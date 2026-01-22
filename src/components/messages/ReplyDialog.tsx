import { useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/backend/client";

interface ReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientName: string;
  recipientEmail: string;
  gameTitle?: string;
}

const DEFAULT_TEMPLATE = `Hi {{name}},

Thank you for your interest in {{game}}.



Sincerely,
Ethan Sommerfeld`;

export function ReplyDialog({
  open,
  onOpenChange,
  recipientName,
  recipientEmail,
  gameTitle,
}: ReplyDialogProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Escape HTML to prevent XSS in emails
  const escapeHtml = (text: string): string => {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
  };

  // Process template variables
  const processTemplate = (template: string) => {
    return template
      .replace(/\{\{name\}\}/g, recipientName)
      .replace(/\{\{game\}\}/g, gameTitle || "the game")
      .replace(/\{\{email\}\}/g, recipientEmail);
  };

  // Initialize message when dialog opens
  useEffect(() => {
    if (open) {
      setMessage(processTemplate(DEFAULT_TEMPLATE));
      setSubject(`Re: ${gameTitle || "Your inquiry"}`);
    } else {
      setMessage("");
      setSubject("");
    }
  }, [open, recipientName, gameTitle, recipientEmail]);

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message to send.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      // Process any remaining variables in the message
      const processedMessage = processTemplate(message);
      // Escape HTML to prevent XSS, then convert newlines to <br>
      const safeHtml = escapeHtml(processedMessage).replace(/\n/g, "<br>");
      
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: recipientEmail,
          subject: subject,
          html: `<div style="font-family: sans-serif; line-height: 1.6;">${safeHtml}</div>`,
          text: processedMessage,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send email");

      toast({
        title: "Email sent",
        description: `Your reply has been sent to ${recipientName}.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Send email error:", error);
      toast({
        title: "Failed to send email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Reply to {recipientName}</DialogTitle>
          <DialogDescription>
            Send an email reply to {recipientEmail}. Use <code className="bg-muted px-1 rounded text-xs">{`{{name}}`}</code>, <code className="bg-muted px-1 rounded text-xs">{`{{game}}`}</code>, <code className="bg-muted px-1 rounded text-xs">{`{{email}}`}</code> as variables.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your reply..."
              className="min-h-[200px] resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
