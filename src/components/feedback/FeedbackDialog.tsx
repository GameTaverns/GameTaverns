import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitFeedback, FeedbackType } from "@/hooks/usePlatformFeedback";
import { toast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const feedbackSchema = z.object({
  type: z.enum(["feedback", "bug", "feature_request"]),
  sender_name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  sender_email: z.string().trim().email("Please enter a valid email").max(255, "Email must be less than 255 characters"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000, "Message must be less than 2000 characters"),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

const feedbackTypeLabels: Record<FeedbackType, string> = {
  feedback: "General Feedback",
  bug: "Bug Report",
  feature_request: "Feature Request",
};

/**
 * Global floating feedback button - renders in bottom-right corner on all pages.
 * Also exported as FeedbackDialog for inline use in headers.
 */
export function GlobalFeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex h-auto items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-3 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Send feedback"
          >
            <MessageSquarePlus className="h-5 w-5" />
            <span className="text-sm font-medium">Feedback</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Send Feedback</TooltipContent>
      </Tooltip>

      <FeedbackFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Inline feedback button for use in headers/navs (kept for backwards compat).
 */
export function FeedbackDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <MessageSquarePlus className="h-4 w-4" />
        Feedback
      </Button>
      <FeedbackFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function FeedbackFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const submitFeedback = useSubmitFeedback();

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      type: "feedback",
      sender_name: "",
      sender_email: "",
      message: "",
    },
  });

  const onSubmit = async (values: FeedbackFormValues) => {
    try {
      await submitFeedback.mutateAsync({
        type: values.type,
        sender_name: values.sender_name,
        sender_email: values.sender_email,
        message: values.message,
      });
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback! We'll review it soon.",
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Share your thoughts, report a bug, or suggest a new feature.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select feedback type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(feedbackTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sender_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sender_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us what's on your mind..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitFeedback.isPending}>
                {submitFeedback.isPending ? "Sending..." : "Send Feedback"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
