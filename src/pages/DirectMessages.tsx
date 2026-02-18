import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DMInbox } from "@/components/social/DMInbox";
import { DMThread } from "@/components/social/DMThread";
import { SocialDiscovery } from "@/components/social/SocialDiscovery";
import { Card } from "@/components/ui/card";
import { MessageSquare, LayoutDashboard } from "lucide-react";
import type { DMConversation } from "@/hooks/useDirectMessages";
import { supabase } from "@/integrations/backend/client";

export default function DirectMessages() {
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
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold text-cream flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-secondary" />
            Direct Messages
          </h1>
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm text-cream/60 hover:text-cream transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-200px)] min-h-[500px]">
          {/* Sidebar */}
          <Card className="bg-wood-medium/30 border-wood-medium/50 overflow-hidden flex flex-col">
            <DMInbox
              selectedUserId={selectedConv?.user_id ?? null}
              onSelectConversation={handleSelectConv}
              onNewMessage={handleNewMessage}
            />
          </Card>

          {/* Main panel */}
          <Card className="bg-wood-medium/30 border-wood-medium/50 overflow-hidden flex flex-col">
            {showDiscovery ? (
              <div className="p-4 overflow-auto">
                <p className="text-sm text-cream/60 mb-4">
                  Find a user to start a conversation with:
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
                <MessageSquare className="h-12 w-12 text-cream/20 mb-4" />
                <p className="text-cream/50 text-sm">Select a conversation or start a new one</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
