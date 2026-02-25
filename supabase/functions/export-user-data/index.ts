import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const userId = user.id;

    // Gather all user data in parallel
    const [
      profileResult,
      librariesResult,
      rolesResult,
      achievementsResult,
      activityResult,
      loansLenderResult,
      loansBorrowerResult,
      directMessagesResult,
      forumThreadsResult,
      forumRepliesResult,
      notificationsResult,
      curatedListsResult,
      followersResult,
      followingResult,
      eloResult,
      referralsResult,
      referralBadgesResult,
      sessionsResult,
    ] = await Promise.all([
      adminClient.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      adminClient.from('libraries').select('*, games(*)').eq('owner_id', userId),
      adminClient.from('user_roles').select('*').eq('user_id', userId),
      adminClient.from('user_achievements').select('*, achievements(*)').eq('user_id', userId),
      adminClient.from('activity_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1000),
      adminClient.from('game_loans').select('*, games(title)').eq('lender_user_id', userId),
      adminClient.from('game_loans').select('*, games(title)').eq('borrower_user_id', userId),
      adminClient.from('direct_messages').select('*').or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).order('created_at', { ascending: false }).limit(1000),
      adminClient.from('forum_threads').select('*').eq('author_id', userId),
      adminClient.from('forum_replies').select('*').eq('author_id', userId),
      adminClient.from('notification_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
      adminClient.from('curated_lists').select('*, curated_list_items(*)').eq('user_id', userId),
      adminClient.from('user_follows').select('*').eq('following_id', userId),
      adminClient.from('user_follows').select('*').eq('follower_id', userId),
      adminClient.from('player_elo_ratings').select('*').eq('user_id', userId),
      adminClient.from('referrals').select('*').eq('referrer_user_id', userId),
      adminClient.from('referral_badges').select('*').eq('user_id', userId).maybeSingle(),
      adminClient.from('game_sessions').select('*, game_session_players(*)').eq('logged_by', userId),
    ]);

    // Get library member data (libraries user is a member of but doesn't own)
    const { data: memberships } = await adminClient.from('library_members').select('*, libraries(name, slug)').eq('user_id', userId);

    // Get game admin data for owned libraries
    let gameAdminData: any[] = [];
    if (librariesResult.data) {
      for (const lib of librariesResult.data) {
        const gameIds = (lib.games || []).map((g: any) => g.id);
        if (gameIds.length > 0) {
          const { data } = await adminClient.from('game_admin_data').select('*').in('game_id', gameIds);
          if (data) gameAdminData = [...gameAdminData, ...data];
        }
      }
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: userId,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      profile: profileResult.data,
      roles: rolesResult.data || [],
      libraries: (librariesResult.data || []).map((lib: any) => ({
        ...lib,
        game_count: lib.games?.length || 0,
      })),
      games: (librariesResult.data || []).flatMap((lib: any) => lib.games || []),
      game_admin_data: gameAdminData,
      memberships: memberships || [],
      achievements: achievementsResult.data || [],
      activity_feed: activityResult.data || [],
      loans_as_lender: loansLenderResult.data || [],
      loans_as_borrower: loansBorrowerResult.data || [],
      direct_messages: directMessagesResult.data || [],
      forum_threads: forumThreadsResult.data || [],
      forum_replies: forumRepliesResult.data || [],
      notifications: notificationsResult.data || [],
      curated_lists: curatedListsResult.data || [],
      followers: followersResult.data || [],
      following: followingResult.data || [],
      elo_ratings: eloResult.data || [],
      referrals: referralsResult.data || [],
      referral_badges: referralBadgesResult.data,
      game_sessions: sessionsResult.data || [],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="gametaverns-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Export user data error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
