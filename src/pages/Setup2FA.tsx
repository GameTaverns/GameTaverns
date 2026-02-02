import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { TotpSetup } from "@/components/auth/TotpSetup";
import { supabase } from "@/lib/supabase";
import { getSupabaseConfig } from "@/config/runtime";

/**
 * Page shown to users who need to set up 2FA before accessing the app.
 * Required 2FA is enforced here.
 */
export default function Setup2FA() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const { url: apiUrl, anonKey } = getSupabaseConfig();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    // Check if user already has 2FA enabled
    const checkStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          navigate("/login", { replace: true });
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

        if (response.ok) {
          const data = await response.json();
          if (data.isEnabled) {
            // Already set up, redirect to dashboard
            navigate("/dashboard", { replace: true });
            return;
          }
        }
      } catch (e) {
        console.error("Failed to check 2FA status:", e);
      } finally {
        setChecking(false);
      }
    };

    checkStatus();
  }, [user, loading, navigate, apiUrl, anonKey]);

  const handleComplete = () => {
    navigate("/dashboard", { replace: true });
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center p-4">
      <TotpSetup onComplete={handleComplete} isRequired={true} />
    </div>
  );
}
