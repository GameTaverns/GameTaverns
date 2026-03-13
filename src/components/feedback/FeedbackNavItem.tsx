import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { FeedbackFormDialog } from "./FeedbackDialog";

/**
 * Feedback item for use in the mobile nav drawer.
 * Opens the feedback dialog inline.
 */
export function FeedbackNavItem({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0" />
        <span className="flex-1">Send Feedback</span>
      </button>
      <FeedbackFormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) onClose();
        }}
      />
    </>
  );
}
