import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function CatalogPagination({ currentPage, totalPages, onPageChange }: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  // Generate visible page numbers
  const pages: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 py-6">
      <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === 1} onClick={() => onPageChange(1)}>
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {start > 1 && <span className="px-1 text-xs text-muted-foreground">…</span>}

      {pages.map((p) => (
        <Button
          key={p}
          variant={p === currentPage ? "default" : "outline"}
          size="icon"
          className="h-9 w-9 text-xs"
          onClick={() => onPageChange(p)}
        >
          {p}
        </Button>
      ))}

      {end < totalPages && <span className="px-1 text-xs text-muted-foreground">…</span>}

      <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === totalPages} onClick={() => onPageChange(totalPages)}>
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
