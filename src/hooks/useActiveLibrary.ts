import { useState, useEffect } from "react";
import { useMyLibrary, useMyLibraries } from "@/hooks/useLibrary";

/**
 * Shared hook for dashboard spoke pages that need a library switcher.
 * Returns the active library, all libraries, and a setter.
 */
export function useActiveLibrary() {
  const { data: defaultLibrary } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const [activeLibraryId, setActiveLibraryId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeLibraryId && defaultLibrary) setActiveLibraryId(defaultLibrary.id);
  }, [defaultLibrary, activeLibraryId]);

  const library = myLibraries.find((l) => l.id === activeLibraryId) ?? defaultLibrary ?? null;

  return {
    library,
    myLibraries,
    activeLibraryId,
    setActiveLibraryId,
    hasMultipleLibraries: myLibraries.length > 1,
  };
}
