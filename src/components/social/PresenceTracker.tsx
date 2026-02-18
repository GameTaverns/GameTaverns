import { useOwnPresence } from "@/hooks/usePresence";

/**
 * Mounts inside AuthProvider to start presence heartbeats for the logged-in user.
 * Renders nothing.
 */
export function PresenceTracker() {
  useOwnPresence();
  return null;
}
