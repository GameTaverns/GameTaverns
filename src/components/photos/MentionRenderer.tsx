import React from "react";
import { Link } from "react-router-dom";

interface MentionRendererProps {
  caption: string;
  className?: string;
}

/**
 * Renders a caption string with @username mentions as clickable links.
 */
export function MentionRenderer({ caption, className }: MentionRendererProps) {
  if (!caption) return null;

  // Split on @username pattern, keeping the matches
  const parts = caption.split(/((?:^|\s)@\w+)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const mentionMatch = part.match(/^(\s?)@(\w+)$/);
        if (mentionMatch) {
          const whitespace = mentionMatch[1];
          const username = mentionMatch[2];
          return (
            <React.Fragment key={i}>
              {whitespace}
              <Link
                to={`/u/${username}`}
                className="text-primary hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                @{username}
              </Link>
            </React.Fragment>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}
