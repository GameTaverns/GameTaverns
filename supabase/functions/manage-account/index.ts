import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    console.log('manage-account: Creating Supabase client');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    console.log('manage-account: Verifying user');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
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

    // Get user's library to verify ownership
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

    // Verify ownership (except for account deletion which uses different verification)
    if (action !== 'delete_account' && library?.owner_id !== userId) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client for privileged operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (action) {
      case 'clear_library': {
        console.log('manage-account: clear_library action started');
        // Library must exist for this action
        if (!library) {
          console.log('manage-account: Library not found');
          return new Response(JSON.stringify({ error: 'Library not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Verify confirmation text matches library name
        console.log('manage-account: Checking confirmation text', confirmationText, 'vs', library.name);
        if (confirmationText?.toLowerCase() !== library.name.toLowerCase()) {
          console.log('manage-account: Confirmation text mismatch');
          return new Response(JSON.stringify({ error: 'Confirmation text does not match library name' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Delete all games for this library (cascades to related tables)
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

        // Delete import jobs
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
        // Library must exist for this action
        if (!library) {
          return new Response(JSON.stringify({ error: 'Library not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Verify confirmation text matches library name
        if (confirmationText?.toLowerCase() !== library.name.toLowerCase()) {
          return new Response(JSON.stringify({ error: 'Confirmation text does not match library name' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Delete library settings first
        await adminClient
          .from('library_settings')
          .delete()
          .eq('library_id', libraryId);

        // Delete library suspensions
        await adminClient
          .from('library_suspensions')
          .delete()
          .eq('library_id', libraryId);

        // Delete import jobs
        await adminClient
          .from('import_jobs')
          .delete()
          .eq('library_id', libraryId);

        // Delete all games (cascades to game-related tables)
        await adminClient
          .from('games')
          .delete()
          .eq('library_id', libraryId);

        // Delete the library itself
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

        // Delete storage files for this library
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
          // Non-fatal - continue
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Library deleted successfully' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete_account': {
        // Get user email for confirmation
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          return new Response(JSON.stringify({ error: 'Failed to verify user' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Verify confirmation text matches email
        if (confirmationText?.toLowerCase() !== user.email?.toLowerCase()) {
          return new Response(JSON.stringify({ error: 'Confirmation text does not match email address' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get all user's libraries
        const { data: userLibraries } = await adminClient
          .from('libraries')
          .select('id')
          .eq('owner_id', userId);

        // Delete all user's libraries and their data
        if (userLibraries) {
          for (const lib of userLibraries) {
            // Delete library settings
            await adminClient.from('library_settings').delete().eq('library_id', lib.id);
            // Delete library suspensions
            await adminClient.from('library_suspensions').delete().eq('library_id', lib.id);
            // Delete import jobs
            await adminClient.from('import_jobs').delete().eq('library_id', lib.id);
            // Delete games
            await adminClient.from('games').delete().eq('library_id', lib.id);
            // Delete library
            await adminClient.from('libraries').delete().eq('id', lib.id);
            
            // Clean up storage
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

        // Delete user roles
        await adminClient.from('user_roles').delete().eq('user_id', userId);

        // Delete user profile
        await adminClient.from('user_profiles').delete().eq('user_id', userId);

        // Finally, delete the auth user
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
          message: 'Account deleted successfully' 
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
});
