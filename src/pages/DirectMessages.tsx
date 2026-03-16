import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { DMInbox } from "@/components/social/DMInbox";
import { DMThread } from "@/components/social/DMThread";
import { SocialDiscovery } from "@/components/social/SocialDiscovery";
import { Card } from "@/components/ui/card";
import { MessageSquare, LayoutDashboard } from "lucide-react";
import type { DMConversation } from "@/hooks/useDirectMessages";
import { supabase } from "@/integrations/backend/client";

export default function DirectMessages() {
  const { t } = useTranslation();
  const { userId: urlUserId } = useParams<{ userId?: string }>();
  const [selectedConv, setSelectedConv] = useState<DMConversation | null>(null);
  const [showDiscovery, setShowDiscovery] = useState(false);

  // If navigated to /dm/:userId, try to load that user's profile and open thread
  useEffect(() => {
    if (!urlUserId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("public_user_profiles")
        .select("user_id, username, display_name, avatar_url")
        .eq("user_id", urlUserId)
        .maybeSingle();
      if (data) {
        setSelectedConv({
          user_id: data.user_id,
          display_name: data.display_name,
          username: data.username,
          avatar_url: data.avatar_url,
          last_message: "",
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        });
        setShowDiscovery(false);
      }
    })();
  }, [urlUserId]);

  const handleSelectConv = (conv: DMConversation) => {
    setSelectedConv(conv);
    setShowDiscovery(false);
  };

  const handleNewMessage = () => {
    setSelectedConv(null);
    setShowDiscovery(true);
  };

  return (
    <Layout>
      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-6 max-w-5xl">
        <div className="flex items-center justify-between mb-3 sm:mb-6 gap-2">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-secondary" />
            {t('messages.title')}
          </h1>
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">{t('messages.backToDashboard')}</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3 sm:gap-4 h-[calc(100dvh-160px)] sm:h-[calc(100dvh-200px)] md:h-[calc(100vh-200px)] min-h-[400px] sm:min-h-[500px]">
          {/* Sidebar */}
          <Card className="bg-card border-border/60 overflow-hidden flex flex-col">
            <DMInbox
              selectedUserId={selectedConv?.user_id ?? null}
              onSelectConversation={handleSelectConv}
              onNewMessage={handleNewMessage}
              onConversationDeleted={() => setSelectedConv(null)}
            />
          </Card>

          {/* Main panel */}
          <Card className="bg-card border-border/60 overflow-hidden flex flex-col">
            {showDiscovery ? (
              <div className="p-4 overflow-auto">
              <p className="text-sm text-muted-foreground mb-4">
                  {t('messages.findUser')}
                </p>
                <SocialDiscovery />
              </div>
            ) : selectedConv ? (
              <DMThread
                partnerId={selectedConv.user_id}
                partnerName={selectedConv.display_name || selectedConv.username || "Unknown"}
                partnerUsername={selectedConv.username}
                partnerAvatar={selectedConv.avatar_url}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm">{t('messages.selectConversation')}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
