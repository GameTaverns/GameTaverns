import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";

interface DescriptionContentProps {
  content: string | null;
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
  emptyMessage,
}: DescriptionContentProps) {
  const { t } = useTranslation();

  if (!content) {
    return (
      <p className="text-muted-foreground italic">
        {emptyMessage ?? t("game.noDescription")}
      </p>
    );
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}
