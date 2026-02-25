/**
 * Wrapper around dynamic import() that retries once on failure by reloading the page.
 * This handles the common "Failed to fetch dynamically imported module" error that
 * occurs after a redeployment when the browser has a stale index.html referencing
 * old chunk hashes that no longer exist on the server.
 */
export function lazyRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): () => Promise<{ default: T }> {
  return () =>
    factory().catch((error: unknown) => {
      // Only reload once per session to avoid infinite loops
      const key = 'lazyRetry-reloaded';
      const hasReloaded = sessionStorage.getItem(key);

      if (!hasReloaded) {
        sessionStorage.setItem(key, '1');
        console.warn('[lazyRetry] Chunk load failed, reloading page...', error);
        window.location.reload();
        // Return a never-resolving promise while the page reloads
        return new Promise<{ default: T }>(() => {});
      }

      // Already tried reloading once — surface the error
      sessionStorage.removeItem(key);
      throw error;
    });
}
