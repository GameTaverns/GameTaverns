export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      email_confirmation_tokens: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      game_admin_data: {
        Row: {
          created_at: string
          game_id: string
          id: string
          purchase_date: string | null
          purchase_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_admin_data_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_admin_data_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_mechanics: {
        Row: {
          game_id: string
          id: string
          mechanic_id: string
        }
        Insert: {
          game_id: string
          id?: string
          mechanic_id: string
        }
        Update: {
          game_id?: string
          id?: string
          mechanic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_mechanics_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_mechanics_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_mechanics_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "mechanics"
            referencedColumns: ["id"]
          },
        ]
      }
      game_messages: {
        Row: {
          created_at: string
          game_id: string
          id: string
          is_read: boolean
          message_encrypted: string | null
          sender_email_encrypted: string | null
          sender_ip_encrypted: string | null
          sender_name_encrypted: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          is_read?: boolean
          message_encrypted?: string | null
          sender_email_encrypted?: string | null
          sender_ip_encrypted?: string | null
          sender_name_encrypted?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          is_read?: boolean
          message_encrypted?: string | null
          sender_email_encrypted?: string | null
          sender_ip_encrypted?: string | null
          sender_name_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_night_rsvps: {
        Row: {
          created_at: string
          guest_identifier: string
          guest_name: string | null
          id: string
          poll_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          guest_identifier: string
          guest_name?: string | null
          id?: string
          poll_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          guest_identifier?: string
          guest_name?: string | null
          id?: string
          poll_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_night_rsvps_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "game_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      game_polls: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string | null
          event_location: string | null
          id: string
          library_id: string
          max_votes_per_user: number | null
          poll_type: string
          share_token: string | null
          show_results_before_close: boolean | null
          status: string
          title: string
          updated_at: string
          voting_ends_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          event_location?: string | null
          id?: string
          library_id: string
          max_votes_per_user?: number | null
          poll_type?: string
          share_token?: string | null
          show_results_before_close?: boolean | null
          status?: string
          title: string
          updated_at?: string
          voting_ends_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          event_location?: string | null
          id?: string
          library_id?: string
          max_votes_per_user?: number | null
          poll_type?: string
          share_token?: string | null
          show_results_before_close?: boolean | null
          status?: string
          title?: string
          updated_at?: string
          voting_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_polls_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_polls_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_ratings: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          game_id: string
          guest_identifier: string
          id: string
          ip_address: string | null
          rating: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          game_id: string
          guest_identifier: string
          id?: string
          ip_address?: string | null
          rating: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          game_id?: string
          guest_identifier?: string
          id?: string
          ip_address?: string | null
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_session_players: {
        Row: {
          created_at: string
          id: string
          is_first_play: boolean
          is_winner: boolean
          player_name: string
          score: number | null
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_first_play?: boolean
          is_winner?: boolean
          player_name: string
          score?: number | null
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_first_play?: boolean
          is_winner?: boolean
          player_name?: string
          score?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          created_at: string
          duration_minutes: number | null
          game_id: string
          id: string
          notes: string | null
          played_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          game_id: string
          id?: string
          notes?: string | null
          played_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          game_id?: string
          id?: string
          notes?: string | null
          played_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_wishlist: {
        Row: {
          created_at: string
          game_id: string
          guest_identifier: string
          guest_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          guest_identifier: string
          guest_name?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          guest_identifier?: string
          guest_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_wishlist_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_wishlist_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          additional_images: string[] | null
          bgg_id: string | null
          bgg_url: string | null
          created_at: string | null
          crowdfunded: boolean | null
          description: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          game_type: Database["public"]["Enums"]["game_type"] | null
          id: string
          image_url: string | null
          in_base_game_box: boolean | null
          inserts: boolean | null
          is_coming_soon: boolean
          is_expansion: boolean
          is_favorite: boolean
          is_for_sale: boolean
          library_id: string | null
          location_misc: string | null
          location_room: string | null
          location_shelf: string | null
          max_players: number | null
          min_players: number | null
          parent_game_id: string | null
          play_time: Database["public"]["Enums"]["play_time"] | null
          publisher_id: string | null
          sale_condition: Database["public"]["Enums"]["sale_condition"] | null
          sale_price: number | null
          sleeved: boolean | null
          slug: string | null
          suggested_age: string | null
          title: string
          updated_at: string | null
          upgraded_components: boolean | null
          youtube_videos: string[] | null
        }
        Insert: {
          additional_images?: string[] | null
          bgg_id?: string | null
          bgg_url?: string | null
          created_at?: string | null
          crowdfunded?: boolean | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          game_type?: Database["public"]["Enums"]["game_type"] | null
          id?: string
          image_url?: string | null
          in_base_game_box?: boolean | null
          inserts?: boolean | null
          is_coming_soon?: boolean
          is_expansion?: boolean
          is_favorite?: boolean
          is_for_sale?: boolean
          library_id?: string | null
          location_misc?: string | null
          location_room?: string | null
          location_shelf?: string | null
          max_players?: number | null
          min_players?: number | null
          parent_game_id?: string | null
          play_time?: Database["public"]["Enums"]["play_time"] | null
          publisher_id?: string | null
          sale_condition?: Database["public"]["Enums"]["sale_condition"] | null
          sale_price?: number | null
          sleeved?: boolean | null
          slug?: string | null
          suggested_age?: string | null
          title: string
          updated_at?: string | null
          upgraded_components?: boolean | null
          youtube_videos?: string[] | null
        }
        Update: {
          additional_images?: string[] | null
          bgg_id?: string | null
          bgg_url?: string | null
          created_at?: string | null
          crowdfunded?: boolean | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          game_type?: Database["public"]["Enums"]["game_type"] | null
          id?: string
          image_url?: string | null
          in_base_game_box?: boolean | null
          inserts?: boolean | null
          is_coming_soon?: boolean
          is_expansion?: boolean
          is_favorite?: boolean
          is_for_sale?: boolean
          library_id?: string | null
          location_misc?: string | null
          location_room?: string | null
          location_shelf?: string | null
          max_players?: number | null
          min_players?: number | null
          parent_game_id?: string | null
          play_time?: Database["public"]["Enums"]["play_time"] | null
          publisher_id?: string | null
          sale_condition?: Database["public"]["Enums"]["sale_condition"] | null
          sale_price?: number | null
          sleeved?: boolean | null
          slug?: string | null
          suggested_age?: string | null
          title?: string
          updated_at?: string | null
          upgraded_components?: boolean | null
          youtube_videos?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "games_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_parent_game_id_fkey"
            columns: ["parent_game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_parent_game_id_fkey"
            columns: ["parent_game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          failed_items: number
          id: string
          library_id: string
          processed_items: number
          status: string
          successful_items: number
          total_items: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          failed_items?: number
          id?: string
          library_id: string
          processed_items?: number
          status?: string
          successful_items?: number
          total_items?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          failed_items?: number
          id?: string
          library_id?: string
          processed_items?: number
          status?: string
          successful_items?: number
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
        ]
      }
      libraries: {
        Row: {
          created_at: string
          custom_domain: string | null
          description: string | null
          id: string
          is_active: boolean
          is_premium: boolean
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_premium?: boolean
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_premium?: boolean
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          event_location: string | null
          id: string
          library_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          event_location?: string | null
          id?: string
          library_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_location?: string | null
          id?: string
          library_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_events_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_events_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
        ]
      }
      library_settings: {
        Row: {
          background_image_url: string | null
          background_overlay_opacity: string | null
          contact_email: string | null
          created_at: string
          discord_notifications: Json | null
          discord_url: string | null
          discord_webhook_url: string | null
          facebook_url: string | null
          feature_coming_soon: boolean | null
          feature_for_sale: boolean | null
          feature_messaging: boolean | null
          feature_play_logs: boolean | null
          feature_ratings: boolean | null
          feature_wishlist: boolean | null
          footer_text: string | null
          id: string
          instagram_url: string | null
          library_id: string
          logo_url: string | null
          theme_accent_h: string | null
          theme_accent_l: string | null
          theme_accent_s: string | null
          theme_background_h: string | null
          theme_background_l: string | null
          theme_background_s: string | null
          theme_card_h: string | null
          theme_card_l: string | null
          theme_card_s: string | null
          theme_dark_accent_h: string | null
          theme_dark_accent_l: string | null
          theme_dark_accent_s: string | null
          theme_dark_background_h: string | null
          theme_dark_background_l: string | null
          theme_dark_background_s: string | null
          theme_dark_card_h: string | null
          theme_dark_card_l: string | null
          theme_dark_card_s: string | null
          theme_dark_primary_h: string | null
          theme_dark_primary_l: string | null
          theme_dark_primary_s: string | null
          theme_dark_sidebar_h: string | null
          theme_dark_sidebar_l: string | null
          theme_dark_sidebar_s: string | null
          theme_font_body: string | null
          theme_font_display: string | null
          theme_primary_h: string | null
          theme_primary_l: string | null
          theme_primary_s: string | null
          theme_sidebar_h: string | null
          theme_sidebar_l: string | null
          theme_sidebar_s: string | null
          turnstile_site_key: string | null
          twitter_handle: string | null
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          background_overlay_opacity?: string | null
          contact_email?: string | null
          created_at?: string
          discord_notifications?: Json | null
          discord_url?: string | null
          discord_webhook_url?: string | null
          facebook_url?: string | null
          feature_coming_soon?: boolean | null
          feature_for_sale?: boolean | null
          feature_messaging?: boolean | null
          feature_play_logs?: boolean | null
          feature_ratings?: boolean | null
          feature_wishlist?: boolean | null
          footer_text?: string | null
          id?: string
          instagram_url?: string | null
          library_id: string
          logo_url?: string | null
          theme_accent_h?: string | null
          theme_accent_l?: string | null
          theme_accent_s?: string | null
          theme_background_h?: string | null
          theme_background_l?: string | null
          theme_background_s?: string | null
          theme_card_h?: string | null
          theme_card_l?: string | null
          theme_card_s?: string | null
          theme_dark_accent_h?: string | null
          theme_dark_accent_l?: string | null
          theme_dark_accent_s?: string | null
          theme_dark_background_h?: string | null
          theme_dark_background_l?: string | null
          theme_dark_background_s?: string | null
          theme_dark_card_h?: string | null
          theme_dark_card_l?: string | null
          theme_dark_card_s?: string | null
          theme_dark_primary_h?: string | null
          theme_dark_primary_l?: string | null
          theme_dark_primary_s?: string | null
          theme_dark_sidebar_h?: string | null
          theme_dark_sidebar_l?: string | null
          theme_dark_sidebar_s?: string | null
          theme_font_body?: string | null
          theme_font_display?: string | null
          theme_primary_h?: string | null
          theme_primary_l?: string | null
          theme_primary_s?: string | null
          theme_sidebar_h?: string | null
          theme_sidebar_l?: string | null
          theme_sidebar_s?: string | null
          turnstile_site_key?: string | null
          twitter_handle?: string | null
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          background_overlay_opacity?: string | null
          contact_email?: string | null
          created_at?: string
          discord_notifications?: Json | null
          discord_url?: string | null
          discord_webhook_url?: string | null
          facebook_url?: string | null
          feature_coming_soon?: boolean | null
          feature_for_sale?: boolean | null
          feature_messaging?: boolean | null
          feature_play_logs?: boolean | null
          feature_ratings?: boolean | null
          feature_wishlist?: boolean | null
          footer_text?: string | null
          id?: string
          instagram_url?: string | null
          library_id?: string
          logo_url?: string | null
          theme_accent_h?: string | null
          theme_accent_l?: string | null
          theme_accent_s?: string | null
          theme_background_h?: string | null
          theme_background_l?: string | null
          theme_background_s?: string | null
          theme_card_h?: string | null
          theme_card_l?: string | null
          theme_card_s?: string | null
          theme_dark_accent_h?: string | null
          theme_dark_accent_l?: string | null
          theme_dark_accent_s?: string | null
          theme_dark_background_h?: string | null
          theme_dark_background_l?: string | null
          theme_dark_background_s?: string | null
          theme_dark_card_h?: string | null
          theme_dark_card_l?: string | null
          theme_dark_card_s?: string | null
          theme_dark_primary_h?: string | null
          theme_dark_primary_l?: string | null
          theme_dark_primary_s?: string | null
          theme_dark_sidebar_h?: string | null
          theme_dark_sidebar_l?: string | null
          theme_dark_sidebar_s?: string | null
          theme_font_body?: string | null
          theme_font_display?: string | null
          theme_primary_h?: string | null
          theme_primary_l?: string | null
          theme_primary_s?: string | null
          theme_sidebar_h?: string | null
          theme_sidebar_l?: string | null
          theme_sidebar_s?: string | null
          turnstile_site_key?: string | null
          twitter_handle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_settings_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: true
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_settings_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: true
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
        ]
      }
      library_suspensions: {
        Row: {
          action: Database["public"]["Enums"]["suspension_action"]
          created_at: string
          id: string
          library_id: string
          performed_by: string
          reason: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["suspension_action"]
          created_at?: string
          id?: string
          library_id: string
          performed_by: string
          reason?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["suspension_action"]
          created_at?: string
          id?: string
          library_id?: string
          performed_by?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_suspensions_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_suspensions_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanics: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_feedback: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_email: string
          sender_name: string
          type: Database["public"]["Enums"]["feedback_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_email: string
          sender_name: string
          type: Database["public"]["Enums"]["feedback_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_email?: string
          sender_name?: string
          type?: Database["public"]["Enums"]["feedback_type"]
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          created_at: string
          display_order: number | null
          game_id: string
          id: string
          poll_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          game_id: string
          id?: string
          poll_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          game_id?: string
          id?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "game_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          voter_identifier: string
          voter_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          voter_identifier: string
          voter_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          voter_identifier?: string
          voter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_results"
            referencedColumns: ["option_id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "game_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      publishers: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          discord_user_id: string | null
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          discord_user_id?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          discord_user_id?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      game_ratings_library_view: {
        Row: {
          created_at: string | null
          game_id: string | null
          guest_identifier: string | null
          id: string | null
          rating: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          game_id?: string | null
          guest_identifier?: string | null
          id?: string | null
          rating?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          game_id?: string | null
          guest_identifier?: string | null
          id?: string | null
          rating?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_ratings_summary: {
        Row: {
          average_rating: number | null
          game_id: string | null
          rating_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_wishlist_summary: {
        Row: {
          game_id: string | null
          named_votes: number | null
          vote_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_wishlist_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_wishlist_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      games_public: {
        Row: {
          additional_images: string[] | null
          bgg_id: string | null
          bgg_url: string | null
          created_at: string | null
          crowdfunded: boolean | null
          description: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          game_type: Database["public"]["Enums"]["game_type"] | null
          id: string | null
          image_url: string | null
          in_base_game_box: boolean | null
          inserts: boolean | null
          is_coming_soon: boolean | null
          is_expansion: boolean | null
          is_for_sale: boolean | null
          library_id: string | null
          location_misc: string | null
          location_room: string | null
          location_shelf: string | null
          max_players: number | null
          min_players: number | null
          parent_game_id: string | null
          play_time: Database["public"]["Enums"]["play_time"] | null
          publisher_id: string | null
          sale_condition: Database["public"]["Enums"]["sale_condition"] | null
          sale_price: number | null
          sleeved: boolean | null
          slug: string | null
          suggested_age: string | null
          title: string | null
          updated_at: string | null
          upgraded_components: boolean | null
          youtube_videos: string[] | null
        }
        Insert: {
          additional_images?: string[] | null
          bgg_id?: string | null
          bgg_url?: string | null
          created_at?: string | null
          crowdfunded?: boolean | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          game_type?: Database["public"]["Enums"]["game_type"] | null
          id?: string | null
          image_url?: string | null
          in_base_game_box?: boolean | null
          inserts?: boolean | null
          is_coming_soon?: boolean | null
          is_expansion?: boolean | null
          is_for_sale?: boolean | null
          library_id?: string | null
          location_misc?: string | null
          location_room?: string | null
          location_shelf?: string | null
          max_players?: number | null
          min_players?: number | null
          parent_game_id?: string | null
          play_time?: Database["public"]["Enums"]["play_time"] | null
          publisher_id?: string | null
          sale_condition?: Database["public"]["Enums"]["sale_condition"] | null
          sale_price?: number | null
          sleeved?: boolean | null
          slug?: string | null
          suggested_age?: string | null
          title?: string | null
          updated_at?: string | null
          upgraded_components?: boolean | null
          youtube_videos?: string[] | null
        }
        Update: {
          additional_images?: string[] | null
          bgg_id?: string | null
          bgg_url?: string | null
          created_at?: string | null
          crowdfunded?: boolean | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          game_type?: Database["public"]["Enums"]["game_type"] | null
          id?: string | null
          image_url?: string | null
          in_base_game_box?: boolean | null
          inserts?: boolean | null
          is_coming_soon?: boolean | null
          is_expansion?: boolean | null
          is_for_sale?: boolean | null
          library_id?: string | null
          location_misc?: string | null
          location_room?: string | null
          location_shelf?: string | null
          max_players?: number | null
          min_players?: number | null
          parent_game_id?: string | null
          play_time?: Database["public"]["Enums"]["play_time"] | null
          publisher_id?: string | null
          sale_condition?: Database["public"]["Enums"]["sale_condition"] | null
          sale_price?: number | null
          sleeved?: boolean | null
          slug?: string | null
          suggested_age?: string | null
          title?: string | null
          updated_at?: string | null
          upgraded_components?: boolean | null
          youtube_videos?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "games_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_parent_game_id_fkey"
            columns: ["parent_game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_parent_game_id_fkey"
            columns: ["parent_game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      libraries_public: {
        Row: {
          created_at: string | null
          custom_domain: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          is_premium: boolean | null
          name: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_domain?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          is_premium?: boolean | null
          name?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_domain?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          is_premium?: boolean | null
          name?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      library_calendar_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string | null
          event_location: string | null
          event_type: string | null
          id: string | null
          library_id: string | null
          poll_status: string | null
          share_token: string | null
          title: string | null
        }
        Relationships: []
      }
      poll_results: {
        Row: {
          game_id: string | null
          game_title: string | null
          image_url: string | null
          option_id: string | null
          poll_id: string | null
          vote_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "game_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings_public: {
        Row: {
          created_at: string | null
          id: string | null
          key: string | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          key?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          key?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      user_profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_email_tokens: { Args: never; Returns: undefined }
      cleanup_expired_tokens: { Args: never; Returns: undefined }
      generate_slug: { Args: { title: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_slug_available: { Args: { check_slug: string }; Returns: boolean }
      set_timezone: { Args: never; Returns: undefined }
      slugify: { Args: { input: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      difficulty_level:
        | "1 - Light"
        | "2 - Medium Light"
        | "3 - Medium"
        | "4 - Medium Heavy"
        | "5 - Heavy"
      feedback_type: "feedback" | "bug" | "feature_request"
      game_type:
        | "Board Game"
        | "Card Game"
        | "Dice Game"
        | "Party Game"
        | "War Game"
        | "Miniatures"
        | "RPG"
        | "Other"
      play_time:
        | "0-15 Minutes"
        | "15-30 Minutes"
        | "30-45 Minutes"
        | "45-60 Minutes"
        | "60+ Minutes"
        | "2+ Hours"
        | "3+ Hours"
      sale_condition:
        | "New/Sealed"
        | "Like New"
        | "Very Good"
        | "Good"
        | "Acceptable"
      suspension_action: "suspended" | "unsuspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      difficulty_level: [
        "1 - Light",
        "2 - Medium Light",
        "3 - Medium",
        "4 - Medium Heavy",
        "5 - Heavy",
      ],
      feedback_type: ["feedback", "bug", "feature_request"],
      game_type: [
        "Board Game",
        "Card Game",
        "Dice Game",
        "Party Game",
        "War Game",
        "Miniatures",
        "RPG",
        "Other",
      ],
      play_time: [
        "0-15 Minutes",
        "15-30 Minutes",
        "30-45 Minutes",
        "45-60 Minutes",
        "60+ Minutes",
        "2+ Hours",
        "3+ Hours",
      ],
      sale_condition: [
        "New/Sealed",
        "Like New",
        "Very Good",
        "Good",
        "Acceptable",
      ],
      suspension_action: ["suspended", "unsuspended"],
    },
  },
} as const
