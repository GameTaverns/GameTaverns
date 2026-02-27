import { AlertTriangle } from "lucide-react";

/**
 * Persistent banner indicating this is a testing environment.
 * Shows at the bottom of every page with a disclaimer.
 */
export function TestingEnvironmentBanner() {
  return (
    <div className="fixed bottom-[60px] md:bottom-0 left-0 right-0 z-50 bg-amber-500/95 text-amber-950 px-4 py-2 text-center text-sm font-medium shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>
          <strong>Testing Environment</strong> — This is a preview/staging environment. 
          Data will not be migrated to the official site.
        </span>
        <AlertTriangle className="h-4 w-4 flex-shrink-0 hidden sm:block" />
      </div>
    </div>
  );
}
