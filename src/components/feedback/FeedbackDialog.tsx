import { useState, useRef } from "react";
import { MessageSquarePlus, ImagePlus, X } from "lucide-react";
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
  type: z.enum(["feedback", "bug", "feature_request", "badge_request"]),
  sender_name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  sender_email: z.string().trim().email("Please enter a valid email").max(255, "Email must be less than 255 characters"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000, "Message must be less than 2000 characters"),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

const feedbackTypeLabels: Record<FeedbackType, string> = {
  feedback: "General Feedback",
  bug: "Bug Report",
  feature_request: "Feature Request",
  badge_request: "Badge Request",
};

const MAX_SCREENSHOTS = 4;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function GlobalFeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Discord link */}
      <a
        href="https://discord.gg/jTqgCPX8DD"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-[150px] z-50 hidden md:flex h-auto items-center gap-2 rounded-full bg-[#5865F2] text-white shadow-lg px-4 py-3 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Join our Discord"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        <span className="text-sm font-medium">Discord</span>
      </a>

      {/* Feedback button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-6 left-6 z-50 hidden md:flex h-auto items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-3 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Send feedback"
          >
            <MessageSquarePlus className="h-5 w-5" />
            <span className="text-sm font-medium">Feedback</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Send Feedback</TooltipContent>
      </Tooltip>
      <FeedbackFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

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

function ScreenshotUpload({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const newFiles = Array.from(selected).filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast({ title: "Invalid file type", description: "Only PNG, JPG, WebP, and GIF are allowed.", variant: "destructive" });
        return false;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: "File too large", description: `${f.name} exceeds the 5MB limit.`, variant: "destructive" });
        return false;
      }
      return true;
    });
    const combined = [...files, ...newFiles].slice(0, MAX_SCREENSHOTS);
    onChange(combined);
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Screenshots (optional, max {MAX_SCREENSHOTS})</label>
      <div className="flex flex-wrap gap-2">
        {files.map((file, i) => (
          <div key={i} className="relative group h-16 w-16 rounded-md overflow-hidden border border-border">
            <img
              src={URL.createObjectURL(file)}
              alt={`Screenshot ${i + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeFile(i)}
              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove screenshot ${i + 1}`}
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        ))}
        {files.length < MAX_SCREENSHOTS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-16 w-16 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            aria-label="Add screenshot"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

export function FeedbackFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const submitFeedback = useSubmitFeedback();
  const [screenshots, setScreenshots] = useState<File[]>([]);

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
        screenshots: screenshots.length > 0 ? screenshots : undefined,
      });
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback! We'll review it soon.",
      });
      form.reset();
      setScreenshots([]);
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
            <ScreenshotUpload files={screenshots} onChange={setScreenshots} />
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
