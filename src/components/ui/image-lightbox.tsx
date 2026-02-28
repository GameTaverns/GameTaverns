import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  children: React.ReactNode;
  className?: string;
}

export function ImageLightbox({ src, alt = "Image", children, className }: ImageLightboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className || "cursor-pointer w-full h-full block"}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl p-0 bg-black/95 border-none gap-0 [&>button]:hidden">
          <div className="relative flex items-center justify-center min-h-[50vh] max-h-[90vh]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
