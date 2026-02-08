import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/backend/client";
import { useQueryClient } from "@tanstack/react-query";

interface ReplyToInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  senderName: string;
  gameTitle: string;
}

export function ReplyToInquiryDialog({
  open,
  onOpenChange,
  messageId,
  senderName,
  gameTitle,
}: ReplyToInquiryDialogProps) {
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!replyText.trim()) {
      toast({
        title: "Reply required",
        description: "Please enter a reply message.",
        variant: "destructive",
      });
      return;
    }

    if (replyText.length > 2000) {
      toast({
        title: "Reply too long",
        description: "Reply must be less than 2000 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("reply-to-inquiry", {
        body: {
          message_id: messageId,
          reply_text: replyText.trim(),
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to send reply");
      }

      toast({
        title: "Reply sent!",
        description: "Your reply has been sent to the inquirer.",
      });

      setReplyText("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    } catch (error: any) {
      toast({
        title: "Error sending reply",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reply to {senderName}</DialogTitle>
          <DialogDescription>
            Respond to the inquiry about "{gameTitle}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reply-text">Your Reply</Label>
            <Textarea
              id="reply-text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your response..."
              rows={5}
              disabled={isSubmitting}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {replyText.length}/2000
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !replyText.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Reply
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
