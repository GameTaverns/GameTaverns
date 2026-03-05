import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Users, Calendar, Vote, MessageSquare, Target, Globe,
  Plus, ExternalLink, Settings, ArrowRight, Ticket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary, useMyLibraries } from "@/hooks/useLibrary";
import { useMyClubs } from "@/hooks/useClubs";
import { useMyMemberships } from "@/hooks/useLibraryMembership";
import { SpokePageLayout } from "@/components/dashboard/SpokePageLayout";
import { CommunityTab } from "@/components/community/CommunityTab";
import { CommunityPollsList } from "@/components/polls/CommunityPollsList";
import { UpcomingEventsWidget } from "@/components/events/UpcomingEventsWidget";
import { CreateEventDialog } from "@/components/events/CreateEventDialog";
import { CommunityMembersCard } from "@/components/community/CommunityMembersCard";
import { ChallengesManager } from "@/components/challenges/ChallengesManager";
import { isSelfHostedSupabaseStack } from "@/config/runtime";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { InfoPopover } from "@/components/ui/InfoPopover";

const cardClass = "bg-wood-medium/30 border-wood-medium/50 text-cream";
const btnPrimary = "bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs h-7 gap-1.5";
const btnOutline = "border-secondary/50 text-cream hover:bg-wood-medium/50 text-xs h-7 gap-1.5";

export default function CommunityEventsPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();
  const { data: library } = useMyLibrary();
  const { data: myLibraries = [] } = useMyLibraries();
  const { data: myClubs = [] } = useMyClubs();
  const { data: myMemberships = [] } = useMyMemberships();
  const navigate = useNavigate();

  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) return null;

  return (
    <SpokePageLayout
      title="Community & Events"
      description="Forums, clubs, events, polls & challenges"
      icon={Users}
      iconColor="hsl(200, 70%, 50%)"
    >
      <div className="space-y-6">
        {/* Forums */}
        <Card className={`${cardClass} overflow-hidden`}>
          <CardHeader className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-secondary" />
                  {t('dashboard.forums')}
                </CardTitle>
                <InfoPopover title="Community Forums" description="Engage with the broader GameTaverns community. Library and club forums are accessible from their respective pages." className="text-cream/40 hover:text-cream/70" />
              </div>
              <Link to="/community">
                <Button variant="ghost" size="sm" className="text-cream/70 hover:text-cream hover:bg-wood-medium/40 text-xs h-7 gap-1">
                  {t('common.viewAll')} <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4"><CommunityTab /></CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Events */}
          {library && (
            <Card className={cardClass}>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-secondary" />
                    {t('dashboard.events')}
                  </span>
                  <Button size="sm" className={btnPrimary} onClick={() => setShowCreateEvent(true)}>
                    <Plus className="h-3 w-3" /> {t('common.create')}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <UpcomingEventsWidget
                  libraryId={library.id}
                  isOwner={true}
                  onCreateEvent={() => setShowCreateEvent(true)}
                  onEditEvent={(event) => setEditEvent(event)}
                />
              </CardContent>
            </Card>
          )}

          {/* Polls */}
          <Card className={`${cardClass} overflow-hidden`}>
            <CardHeader className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Vote className="h-4 w-4 text-secondary" />
                  {t('dashboard.polls')}
                </CardTitle>
                <Link to="/community?tab=polls">
                  <Button variant="ghost" size="sm" className="text-cream/70 hover:text-cream hover:bg-wood-medium/40 text-xs h-7 gap-1">
                    {t('common.viewAll')} <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <CommunityPollsList />
            </CardContent>
          </Card>
        </div>

        {/* Clubs */}
        <Card className={cardClass}>
          <CardHeader className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-secondary" />
                {t('dashboard.myClubs')}
                {myClubs.length > 0 && <Badge variant="secondary" className="text-[10px]">{myClubs.length}</Badge>}
              </CardTitle>
              <div className="flex gap-1.5">
                <Link to="/join-club">
                  <Button variant="outline" size="sm" className={`text-cream ${btnOutline}`}>
                    <Ticket className="h-3 w-3" /> {t('dashboard.join')}
                  </Button>
                </Link>
                <Link to="/request-club">
                  <Button size="sm" className={btnPrimary}>
                    <Plus className="h-3 w-3" /> {t('dashboard.request')}
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {myClubs.length === 0 ? (
              <div className="text-center py-4">
                <Users className="h-8 w-8 mx-auto text-cream/30 mb-2" />
                <p className="text-cream/60 text-xs">{t('dashboard.noClubs')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myClubs.map((club) => (
                  <div key={club.id} className="flex items-center justify-between p-2 rounded-lg bg-wood-medium/20">
                    <div className="min-w-0 mr-2">
                      <div className="text-xs font-medium truncate">{club.name}</div>
                      <Badge variant={club.status === 'approved' ? 'secondary' : 'outline'} className="text-[10px] mt-0.5">{club.status}</Badge>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Link to={`/club/${club.slug}`}>
                        <Button variant="secondary" size="sm" className="gap-1 h-6 text-[10px] px-2">
                          <ExternalLink className="h-2.5 w-2.5" /> View
                        </Button>
                      </Link>
                      {club.owner_id === user?.id && (
                        <Link to={`/club/${club.slug}/manage`}>
                          <Button variant="outline" size="sm" className="gap-1 h-6 text-cream border-wood-medium/50 px-2">
                            <Settings className="h-2.5 w-2.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Communities / Memberships */}
          <Card className={cardClass}>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-secondary" />
                {t('dashboard.myCommunities')}
              </CardTitle>
              <CardDescription className="text-cream/60 text-xs">{t('dashboard.myCommunitiesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {(() => {
                const ownedEntries = myLibraries.map((lib) => ({
                  key: `owned-${lib.id}`, name: lib.name, slug: lib.slug, role: 'owner' as const,
                }));
                const memberEntries = myMemberships
                  .filter((m) => !myLibraries.some((lib) => lib.id === m.library?.id))
                  .map((m) => ({
                    key: `member-${m.id}`, name: m.library?.name ?? 'Unknown', slug: m.library?.slug, role: m.role as string,
                  }));
                const allEntries = [...ownedEntries, ...memberEntries];
                if (allEntries.length === 0) {
                  return (
                    <Link to="/directory">
                      <Button size="sm" className={`w-full ${btnPrimary}`}>
                        <Users className="h-3.5 w-3.5" /> {t('dashboard.browseCommunities')}
                      </Button>
                    </Link>
                  );
                }
                return (
                  <div className="space-y-1.5">
                    {allEntries.map((entry) => (
                      <a key={entry.key} href={entry.slug ? getLibraryUrl(entry.slug, "/") : "#"} className="flex items-center justify-between p-2 rounded-lg bg-wood-medium/20 hover:bg-wood-medium/40 transition-colors">
                        <span className="text-xs font-medium truncate">{entry.name}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {entry.role === 'owner' && <Badge variant="secondary" className="text-[10px]">{t('dashboard.owner')}</Badge>}
                          {entry.role === 'admin' && <Badge className="text-[10px] bg-blue-600">{t('dashboard.admin')}</Badge>}
                          {entry.role === 'moderator' && <Badge variant="outline" className="text-[10px]">{t('dashboard.moderator')}</Badge>}
                          {entry.role === 'member' && <Badge variant="outline" className="text-[10px]">{t('dashboard.member')}</Badge>}
                          <ArrowRight className="h-3 w-3 text-cream/60" />
                        </div>
                      </a>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Community Members */}
          <CommunityMembersCard />
        </div>

        {/* Challenges */}
        {library && isSelfHostedSupabaseStack() && (
          <Card className={cardClass}>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-secondary" />
                {t('dashboard.challenges')}
              </CardTitle>
              <CardDescription className="text-cream/60 text-xs">{t('dashboard.challengesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ChallengesManager libraryId={library.id} canManage={true} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Event Dialog */}
      {library && (
        <CreateEventDialog
          open={showCreateEvent || !!editEvent}
          onOpenChange={(open) => {
            if (open) return;
            setShowCreateEvent(false);
            setEditEvent(null);
          }}
          libraryId={library.id}
          editEvent={editEvent}
        />
      )}
    </SpokePageLayout>
  );
}
