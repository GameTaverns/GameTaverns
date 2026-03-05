import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SpokePageLayout } from "@/components/dashboard/SpokePageLayout";
import { SocialTab } from "@/components/social/SocialTab";

export default function MessagesPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) return null;

  return (
    <SpokePageLayout
      title="Messages & Social"
      description="Direct messages, game inquiries & activity feed"
      icon={Mail}
      iconColor="hsl(340, 65%, 50%)"
    >
      <SocialTab currentUserId={user?.id} />
    </SpokePageLayout>
  );
}
