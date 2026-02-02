import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getSupabaseConfig } from "@/config/runtime";

interface TotpStatus {
  isEnabled: boolean;
  verifiedAt: string | null;
  remainingBackupCodes: number;
  requiresSetup: boolean;
}

export function useTotpStatus() {
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { url: apiUrl, anonKey } = getSupabaseConfig();

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus(null);
        return;
      }

      const response = await fetch(`${apiUrl}/functions/v1/totp-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch TOTP status");
      }

      const data = await response.json();
      setStatus(data);
    } catch (e: any) {
      setError(e.message || "Failed to fetch status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, anonKey]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, error, refetch: fetchStatus };
}
