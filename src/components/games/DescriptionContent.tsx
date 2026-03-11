import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DescriptionContentProps {
  content: string | null;
  /** Max height in pixels before clamping (default: 280) */
  clampHeight?: number;
  emptyMessage?: string;
}

const markdownComponents = {
  h2: ({ children }: any) => (
    <>
      <hr className="border-border my-6" />
      <h2 className="font-display text-xl font-semibold text-foreground mt-0 mb-3">
        {children}
      </h2>
    </>
  ),
  h3: ({ children }: any) => (
    <h3 className="font-display text-lg font-semibold text-foreground mt-4 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }: any) => (
    <p className="text-muted-foreground leading-relaxed mb-4">{children}</p>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4 ml-2">
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside space-y-2 text-muted-foreground mb-4 ml-2">
      {children}
    </ol>
  ),
  li: ({ children }: any) => (
    <li className="leading-relaxed">{children}</li>
  ),
};

export function DescriptionContent({
  content,
  clampHeight = 280,
  emptyMessage,
}: DescriptionContentProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setNeedsClamp(contentRef.current.scrollHeight > clampHeight + 40);
    }
  }, [content, clampHeight]);

  if (!content) {
    return (
      <p className="text-muted-foreground italic">
        {emptyMessage ?? t("game.noDescription")}
      </p>
    );
  }

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className={cn(
          "overflow-hidden transition-[max-height] duration-300 ease-in-out",
          !isExpanded && needsClamp && "max-h-[var(--clamp-h)]"
        )}
        style={{ "--clamp-h": `${clampHeight}px` } as React.CSSProperties}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>

      {/* Fade overlay when clamped */}
      {needsClamp && !isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      )}

      {/* Toggle button */}
      {needsClamp && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors mt-2 font-medium"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
