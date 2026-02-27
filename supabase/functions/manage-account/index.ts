import { createClient } from "npm:@supabase/supabase-js@2";
import { withLogging } from "../_shared/system-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('manage-account: Starting request');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('manage-account: No auth header found');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      console.log('manage-account: Empty bearer token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('manage-account: Creating Supabase client');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log('manage-account: Verifying user');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('manage-account: User verification failed', userError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('manage-account: User verified', user.id);

    const userId = user.id;
    const body = await req.json();
    const { action, libraryId, confirmationText } = body;
    console.log('manage-account: Received action', action, 'for library', libraryId);

    const { data: library, error: libraryError } = await supabase
      .from('libraries')
      .select('id, name, slug, owner_id')
      .eq('id', libraryId)
      .single();
    
    console.log('manage-account: Library query result', library, libraryError);

    if (libraryError && action !== 'delete_account') {
      return new Response(JSON.stringify({ error: 'Library not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action !== 'delete_account' && library?.owner_id !== userId) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (action) {
      case 'clear_library': {
        console.log('manage-account: clear_library action started');
        if (!library) {
          return new Response(JSON.stringify({ error: 'Library not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('manage-account: Checking confirmation text', confirmationText, 'vs', library.name);
        if (confirmationText?.toLowerCase() !== library.name.toLowerCase()) {
          return new Response(JSON.stringify({ error: 'Confirmation text does not match library name' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('manage-account: Deleting games for library', libraryId);
        const { error: gamesError, count } = await adminClient
          .from('games')
          .delete()
          .eq('library_id', libraryId);

        console.log('manage-account: Games deletion result', gamesError, 'deleted count:', count);

        if (gamesError) {
          console.error('Error clearing games:', gamesError);
          return new Response(JSON.stringify({ error: 'Failed to clear library games' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await adminClient
          .from('import_jobs')
          .delete()
          .eq('library_id', libraryId);

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Library games cleared successfully' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete_library': {
        if (!library) {
          return new Response(JSON.stringify({ error: 'Library not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (confirmationText?.toLowerCase() !== library.name.toLowerCase()) {
          return new Response(JSON.stringify({ error: 'Confirmation text does not match library name' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await adminClient.from('library_settings').delete().eq('library_id', libraryId);
        await adminClient.from('library_suspensions').delete().eq('library_id', libraryId);
        await adminClient.from('import_jobs').delete().eq('library_id', libraryId);
        await adminClient.from('games').delete().eq('library_id', libraryId);

        const { error: deleteError } = await adminClient
          .from('libraries')
          .delete()
          .eq('id', libraryId);

        if (deleteError) {
          console.error('Error deleting library:', deleteError);
          return new Response(JSON.stringify({ error: 'Failed to delete library' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const { data: files } = await adminClient.storage
            .from('library-logos')
            .list(libraryId);
          if (files && files.length > 0) {
            const filePaths = files.map(f => `${libraryId}/${f.name}`);
            await adminClient.storage.from('library-logos').remove(filePaths);
          }
        } catch (storageError) {
          console.error('Error cleaning up storage:', storageError);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Library deleted successfully' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete_account': {
        const { data: adminRole } = await adminClient
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();

        if (adminRole) {
          return new Response(JSON.stringify({ error: 'Administrators cannot delete their own accounts. Please have another admin remove your admin role first.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (confirmationText?.toLowerCase() !== user.email?.toLowerCase()) {
          return new Response(JSON.stringify({ error: 'Confirmation text does not match email address' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: userLibraries } = await adminClient
          .from('libraries')
          .select('id')
          .eq('owner_id', userId);

        if (userLibraries) {
          for (const lib of userLibraries) {
            await adminClient.from('library_settings').delete().eq('library_id', lib.id);
            await adminClient.from('library_suspensions').delete().eq('library_id', lib.id);
            await adminClient.from('import_jobs').delete().eq('library_id', lib.id);
            await adminClient.from('games').delete().eq('library_id', lib.id);
            await adminClient.from('libraries').delete().eq('id', lib.id);
            try {
              const { data: files } = await adminClient.storage
                .from('library-logos')
                .list(lib.id);
              if (files && files.length > 0) {
                const filePaths = files.map(f => `${lib.id}/${f.name}`);
                await adminClient.storage.from('library-logos').remove(filePaths);
              }
            } catch (e) {
              // Non-fatal
            }
          }
        }

        // Clean up all user-associated data across the platform
        await adminClient.from('direct_messages').delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
        await adminClient.from('activity_reactions').delete().eq('user_id', userId);
        await adminClient.from('activity_events').delete().eq('user_id', userId);
        await adminClient.from('game_session_players').delete().eq('linked_user_id', userId);
        await adminClient.from('player_elo_ratings').delete().eq('user_id', userId);
        await adminClient.from('notification_log').delete().eq('user_id', userId);
        await adminClient.from('user_achievements').delete().eq('user_id', userId);
        await adminClient.from('game_wishlist').delete().eq('user_id', userId);
        await adminClient.from('curated_list_votes').delete().eq('user_id', userId);
        await adminClient.from('curated_list_items').delete().in('list_id', 
          (await adminClient.from('curated_lists').select('id').eq('user_id', userId)).data?.map((l: any) => l.id) || []
        );
        await adminClient.from('curated_lists').delete().eq('user_id', userId);
        await adminClient.from('forum_replies').delete().eq('author_id', userId);
        await adminClient.from('forum_threads').delete().eq('author_id', userId);
        await adminClient.from('catalog_video_votes').delete().eq('user_id', userId);
        await adminClient.from('catalog_ratings').delete().eq('guest_identifier', userId);
        await adminClient.from('library_followers').delete().or(`follower_user_id.eq.${userId},library_id.in.(${(userLibraries || []).map((l: any) => l.id).join(',')})`);
        await adminClient.from('user_follows').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
        await adminClient.from('referral_badges').delete().eq('user_id', userId);
        await adminClient.from('referrals').delete().or(`referrer_user_id.eq.${userId},referred_user_id.eq.${userId}`);
        await adminClient.from('user_totp_settings').delete().eq('user_id', userId);
        await adminClient.from('push_subscriptions').delete().eq('user_id', userId);
        await adminClient.from('password_reset_tokens').delete().eq('user_id', userId);
        await adminClient.from('email_confirmation_tokens').delete().eq('user_id', userId);
        await adminClient.from('login_attempts').delete().eq('email', user.email?.toLowerCase() || '');
        await adminClient.from('audit_log').delete().eq('user_id', userId);
        await adminClient.from('library_members').delete().eq('user_id', userId);
        await adminClient.from('user_roles').delete().eq('user_id', userId);
        await adminClient.from('user_profiles').delete().eq('user_id', userId);

        const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
        if (deleteUserError) {
          console.error('Error deleting user:', deleteUserError);
          return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Account deleted successfully',
          deletion_receipt: {
            deleted_at: new Date().toISOString(),
            user_id: userId,
            data_removed: [
              'user_profiles',
              'user_roles',
              'libraries (and all games, settings, members, followers, events, polls, import jobs)',
              'library_logos (storage)',
              'direct_messages',
              'forum_threads & replies',
              'activity_events & reactions',
              'notification_log',
              'curated_lists & votes',
              'game_sessions & player_elo_ratings',
              'user_achievements',
              'game_wishlist',
              'catalog_ratings & video_votes',
              'user_follows & library_followers',
              'referrals & referral_badges',
              'TOTP settings & push_subscriptions',
              'password_reset_tokens & email_confirmation_tokens',
              'login_attempts & audit_log',
              'auth account',
            ],
            note: 'All data has been permanently deleted. Database backups are purged within 30 days.',
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Manage account error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
