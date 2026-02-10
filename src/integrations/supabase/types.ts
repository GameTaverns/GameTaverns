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
      achievements: {
        Row: {
          category: Database["public"]["Enums"]["achievement_category"]
          created_at: string
          description: string
          icon: string | null
          id: string
          is_secret: boolean
          name: string
          points: number
          requirement_type: string
          requirement_value: number
          slug: string
          tier: number
        }
        Insert: {
          category: Database["public"]["Enums"]["achievement_category"]
          created_at?: string
          description: string
          icon?: string | null
          id?: string
          is_secret?: boolean
          name: string
          points?: number
          requirement_type: string
          requirement_value: number
          slug: string
          tier?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["achievement_category"]
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          is_secret?: boolean
          name?: string
          points?: number
          requirement_type?: string
          requirement_value?: number
          slug?: string
          tier?: number
        }
        Relationships: []
      }
      borrower_ratings: {
        Row: {
          created_at: string
          id: string
          loan_id: string
          rated_by_user_id: string
          rated_user_id: string
          rating: number
          review: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          loan_id: string
          rated_by_user_id: string
          rated_user_id: string
          rating: number
          review?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          loan_id?: string
          rated_by_user_id?: string
          rated_user_id?: string
          rating?: number
          review?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrower_ratings_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "game_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      club_events: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          event_location: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          event_location?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_location?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_invite_codes: {
        Row: {
          club_id: string
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          uses: number
        }
        Insert: {
          club_id: string
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          uses?: number
        }
        Update: {
          club_id?: string
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_invite_codes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_libraries: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          library_id: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          library_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          library_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_libraries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_libraries_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_libraries_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_libraries_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_public: boolean
          logo_url: string | null
          name: string
          owner_id: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          logo_url?: string | null
          name: string
          owner_id: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      forum_categories: {
        Row: {
          club_id: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_archived: boolean | null
          is_system: boolean | null
          library_id: string | null
          name: string
          rules: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          club_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_system?: boolean | null
          library_id?: string | null
          name: string
          rules?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          club_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_system?: boolean | null
          library_id?: string | null
          name?: string
          rules?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_categories_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_categories_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_categories_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_categories_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          parent_reply_id: string | null
          thread_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          parent_reply_id?: string | null
          thread_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          parent_reply_id?: string | null
          thread_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          author_id: string
          category_id: string
          content: string
          created_at: string | null
          id: string
          is_locked: boolean | null
          is_pinned: boolean | null
          last_reply_at: string | null
          reply_count: number | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id: string
          category_id: string
          content: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          last_reply_at?: string | null
          reply_count?: number | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string
          category_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          last_reply_at?: string | null
          reply_count?: number | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
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
      game_copies: {
        Row: {
          condition: string | null
          copy_label: string | null
          copy_number: number
          created_at: string
          game_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          condition?: string | null
          copy_label?: string | null
          copy_number?: number
          created_at?: string
          game_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          condition?: string | null
          copy_label?: string | null
          copy_number?: number
          created_at?: string
          game_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_copies_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_copies_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_loans: {
        Row: {
          approved_at: string | null
          borrowed_at: string | null
          borrower_notes: string | null
          borrower_user_id: string
          condition_in: string | null
          condition_out: string | null
          copy_id: string | null
          created_at: string
          damage_reported: boolean
          due_date: string | null
          game_id: string
          id: string
          lender_notes: string | null
          lender_user_id: string
          library_id: string
          requested_at: string
          returned_at: string | null
          status: Database["public"]["Enums"]["loan_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          borrowed_at?: string | null
          borrower_notes?: string | null
          borrower_user_id: string
          condition_in?: string | null
          condition_out?: string | null
          copy_id?: string | null
          created_at?: string
          damage_reported?: boolean
          due_date?: string | null
          game_id: string
          id?: string
          lender_notes?: string | null
          lender_user_id: string
          library_id: string
          requested_at?: string
          returned_at?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          borrowed_at?: string | null
          borrower_notes?: string | null
          borrower_user_id?: string
          condition_in?: string | null
          condition_out?: string | null
          copy_id?: string | null
          created_at?: string
          damage_reported?: boolean
          due_date?: string | null
          game_id?: string
          id?: string
          lender_notes?: string | null
          lender_user_id?: string
          library_id?: string
          requested_at?: string
          returned_at?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_loans_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: false
            referencedRelation: "game_copies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_loans_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_loans_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_loans_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_loans_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_loans_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
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
      game_message_replies: {
        Row: {
          created_at: string
          id: string
          message_id: string
          replied_by: string
          reply_text_encrypted: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          replied_by: string
          reply_text_encrypted: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          replied_by?: string
          reply_text_encrypted?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_message_replies_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "game_messages"
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
          sender_user_id: string | null
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
          sender_user_id?: string | null
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
          sender_user_id?: string | null
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
          {
            foreignKeyName: "game_polls_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
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
      game_session_expansions: {
        Row: {
          created_at: string
          expansion_id: string
          id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          expansion_id: string
          id?: string
          session_id: string
        }
        Update: {
          created_at?: string
          expansion_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_session_expansions_expansion_id_fkey"
            columns: ["expansion_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_session_expansions_expansion_id_fkey"
            columns: ["expansion_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_session_expansions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_session_players: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_first_play: boolean
          is_winner: boolean
          player_name: string
          score: number | null
          session_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_first_play?: boolean
          is_winner?: boolean
          player_name: string
          score?: number | null
          session_id: string
        }
        Update: {
          color?: string | null
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
          copies_owned: number
          created_at: string | null
          crowdfunded: boolean | null
          description: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          game_type: Database["public"]["Enums"]["game_type"] | null
          genre: string | null
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
          copies_owned?: number
          created_at?: string | null
          crowdfunded?: boolean | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          game_type?: Database["public"]["Enums"]["game_type"] | null
          genre?: string | null
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
          copies_owned?: number
          created_at?: string | null
          crowdfunded?: boolean | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          game_type?: Database["public"]["Enums"]["game_type"] | null
          genre?: string | null
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
            foreignKeyName: "games_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
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
          {
            foreignKeyName: "import_jobs_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
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
          discord_thread_id: string | null
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
          discord_thread_id?: string | null
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
          discord_thread_id?: string | null
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
          {
            foreignKeyName: "library_events_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      library_followers: {
        Row: {
          followed_at: string
          follower_user_id: string
          id: string
          library_id: string
        }
        Insert: {
          followed_at?: string
          follower_user_id: string
          id?: string
          library_id: string
        }
        Update: {
          followed_at?: string
          follower_user_id?: string
          id?: string
          library_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_followers_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_followers_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_followers_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      library_members: {
        Row: {
          id: string
          joined_at: string
          library_id: string
          role: Database["public"]["Enums"]["library_member_role"]
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          library_id: string
          role?: Database["public"]["Enums"]["library_member_role"]
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          library_id?: string
          role?: Database["public"]["Enums"]["library_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_members_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_members_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_members_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      library_settings: {
        Row: {
          allow_lending: boolean
          background_image_url: string | null
          background_overlay_opacity: string | null
          contact_email: string | null
          created_at: string
          default_loan_duration_days: number | null
          discord_events_channel_id: string | null
          discord_notifications: Json | null
          discord_url: string | null
          discord_webhook_url: string | null
          facebook_url: string | null
          feature_achievements: boolean | null
          feature_coming_soon: boolean | null
          feature_community_forum: boolean | null
          feature_events: boolean | null
          feature_for_sale: boolean | null
          feature_lending: boolean | null
          feature_messaging: boolean | null
          feature_play_logs: boolean | null
          feature_ratings: boolean | null
          feature_wishlist: boolean | null
          footer_text: string | null
          id: string
          instagram_url: string | null
          is_discoverable: boolean
          lending_terms: string | null
          library_id: string
          logo_url: string | null
          max_loans_per_borrower: number | null
          min_borrower_rating: number | null
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
          theme_dark_foreground_h: string | null
          theme_dark_foreground_l: string | null
          theme_dark_foreground_s: string | null
          theme_dark_primary_h: string | null
          theme_dark_primary_l: string | null
          theme_dark_primary_s: string | null
          theme_dark_sidebar_h: string | null
          theme_dark_sidebar_l: string | null
          theme_dark_sidebar_s: string | null
          theme_font_body: string | null
          theme_font_display: string | null
          theme_foreground_h: string | null
          theme_foreground_l: string | null
          theme_foreground_s: string | null
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
          allow_lending?: boolean
          background_image_url?: string | null
          background_overlay_opacity?: string | null
          contact_email?: string | null
          created_at?: string
          default_loan_duration_days?: number | null
          discord_events_channel_id?: string | null
          discord_notifications?: Json | null
          discord_url?: string | null
          discord_webhook_url?: string | null
          facebook_url?: string | null
          feature_achievements?: boolean | null
          feature_coming_soon?: boolean | null
          feature_community_forum?: boolean | null
          feature_events?: boolean | null
          feature_for_sale?: boolean | null
          feature_lending?: boolean | null
          feature_messaging?: boolean | null
          feature_play_logs?: boolean | null
          feature_ratings?: boolean | null
          feature_wishlist?: boolean | null
          footer_text?: string | null
          id?: string
          instagram_url?: string | null
          is_discoverable?: boolean
          lending_terms?: string | null
          library_id: string
          logo_url?: string | null
          max_loans_per_borrower?: number | null
          min_borrower_rating?: number | null
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
          theme_dark_foreground_h?: string | null
          theme_dark_foreground_l?: string | null
          theme_dark_foreground_s?: string | null
          theme_dark_primary_h?: string | null
          theme_dark_primary_l?: string | null
          theme_dark_primary_s?: string | null
          theme_dark_sidebar_h?: string | null
          theme_dark_sidebar_l?: string | null
          theme_dark_sidebar_s?: string | null
          theme_font_body?: string | null
          theme_font_display?: string | null
          theme_foreground_h?: string | null
          theme_foreground_l?: string | null
          theme_foreground_s?: string | null
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
          allow_lending?: boolean
          background_image_url?: string | null
          background_overlay_opacity?: string | null
          contact_email?: string | null
          created_at?: string
          default_loan_duration_days?: number | null
          discord_events_channel_id?: string | null
          discord_notifications?: Json | null
          discord_url?: string | null
          discord_webhook_url?: string | null
          facebook_url?: string | null
          feature_achievements?: boolean | null
          feature_coming_soon?: boolean | null
          feature_community_forum?: boolean | null
          feature_events?: boolean | null
          feature_for_sale?: boolean | null
          feature_lending?: boolean | null
          feature_messaging?: boolean | null
          feature_play_logs?: boolean | null
          feature_ratings?: boolean | null
          feature_wishlist?: boolean | null
          footer_text?: string | null
          id?: string
          instagram_url?: string | null
          is_discoverable?: boolean
          lending_terms?: string | null
          library_id?: string
          logo_url?: string | null
          max_loans_per_borrower?: number | null
          min_borrower_rating?: number | null
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
          theme_dark_foreground_h?: string | null
          theme_dark_foreground_l?: string | null
          theme_dark_foreground_s?: string | null
          theme_dark_primary_h?: string | null
          theme_dark_primary_l?: string | null
          theme_dark_primary_s?: string | null
          theme_dark_sidebar_h?: string | null
          theme_dark_sidebar_l?: string | null
          theme_dark_sidebar_s?: string | null
          theme_font_body?: string | null
          theme_font_display?: string | null
          theme_foreground_h?: string | null
          theme_foreground_l?: string | null
          theme_foreground_s?: string | null
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
          {
            foreignKeyName: "library_settings_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: true
            referencedRelation: "library_directory"
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
          {
            foreignKeyName: "library_suspensions_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_waitlist: {
        Row: {
          created_at: string
          game_id: string
          id: string
          library_id: string
          notified_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          library_id: string
          notified_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          library_id?: string
          notified_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_waitlist_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_waitlist_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_waitlist_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_waitlist_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_waitlist_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
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
      notification_log: {
        Row: {
          body: string | null
          channel: string
          id: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          sent_at: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel: string
          id?: string
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          sent_at?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          id?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          sent_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          discord_event_reminders: boolean
          discord_loan_requests: boolean
          discord_loan_updates: boolean
          email_achievement_earned: boolean
          email_event_reminders: boolean
          email_loan_requests: boolean
          email_loan_updates: boolean
          email_wishlist_alerts: boolean
          id: string
          push_achievement_earned: boolean
          push_event_reminders: boolean
          push_loan_requests: boolean
          push_loan_updates: boolean
          push_wishlist_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discord_event_reminders?: boolean
          discord_loan_requests?: boolean
          discord_loan_updates?: boolean
          email_achievement_earned?: boolean
          email_event_reminders?: boolean
          email_loan_requests?: boolean
          email_loan_updates?: boolean
          email_wishlist_alerts?: boolean
          id?: string
          push_achievement_earned?: boolean
          push_event_reminders?: boolean
          push_loan_requests?: boolean
          push_loan_updates?: boolean
          push_wishlist_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discord_event_reminders?: boolean
          discord_loan_requests?: boolean
          discord_loan_updates?: boolean
          email_achievement_earned?: boolean
          email_event_reminders?: boolean
          email_loan_requests?: boolean
          email_loan_updates?: boolean
          email_wishlist_alerts?: boolean
          id?: string
          push_achievement_earned?: boolean
          push_event_reminders?: boolean
          push_loan_requests?: boolean
          push_loan_updates?: boolean
          push_wishlist_alerts?: boolean
          updated_at?: string
          user_id?: string
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
          sender_email: string | null
          sender_name: string
          type: Database["public"]["Enums"]["feedback_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_email?: string | null
          sender_name: string
          type: Database["public"]["Enums"]["feedback_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_email?: string | null
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
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          notified: boolean
          progress: number
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          notified?: boolean
          progress?: number
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          notified?: boolean
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          discord_user_id: string | null
          display_name: string | null
          featured_achievement_id: string | null
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
          featured_achievement_id?: string | null
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
          featured_achievement_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_featured_achievement_id_fkey"
            columns: ["featured_achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
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
      user_totp_settings: {
        Row: {
          backup_codes_encrypted: string | null
          created_at: string
          id: string
          is_enabled: boolean
          last_login_totp_verified_at: string | null
          totp_secret_encrypted: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          backup_codes_encrypted?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_login_totp_verified_at?: string | null
          totp_secret_encrypted: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          backup_codes_encrypted?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_login_totp_verified_at?: string | null
          totp_secret_encrypted?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      borrower_reputation: {
        Row: {
          average_rating: number | null
          positive_ratings: number | null
          total_ratings: number | null
          user_id: string | null
        }
        Relationships: []
      }
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
            foreignKeyName: "games_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
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
      library_directory: {
        Row: {
          allow_lending: boolean | null
          created_at: string | null
          description: string | null
          follower_count: number | null
          game_count: number | null
          id: string | null
          is_discoverable: boolean | null
          logo_url: string | null
          member_count: number | null
          name: string | null
          slug: string | null
        }
        Relationships: []
      }
      library_members_public: {
        Row: {
          library_id: string | null
          member_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_members_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_members_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_members_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      library_settings_public: {
        Row: {
          background_image_url: string | null
          background_overlay_opacity: string | null
          contact_email: string | null
          created_at: string | null
          discord_url: string | null
          facebook_url: string | null
          feature_achievements: boolean | null
          feature_coming_soon: boolean | null
          feature_events: boolean | null
          feature_for_sale: boolean | null
          feature_lending: boolean | null
          feature_messaging: boolean | null
          feature_play_logs: boolean | null
          feature_ratings: boolean | null
          feature_wishlist: boolean | null
          footer_text: string | null
          id: string | null
          instagram_url: string | null
          library_id: string | null
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
          theme_dark_foreground_h: string | null
          theme_dark_foreground_l: string | null
          theme_dark_foreground_s: string | null
          theme_dark_primary_h: string | null
          theme_dark_primary_l: string | null
          theme_dark_primary_s: string | null
          theme_dark_sidebar_h: string | null
          theme_dark_sidebar_l: string | null
          theme_dark_sidebar_s: string | null
          theme_font_body: string | null
          theme_font_display: string | null
          theme_foreground_h: string | null
          theme_foreground_l: string | null
          theme_foreground_s: string | null
          theme_primary_h: string | null
          theme_primary_l: string | null
          theme_primary_s: string | null
          theme_sidebar_h: string | null
          theme_sidebar_l: string | null
          theme_sidebar_s: string | null
          twitter_handle: string | null
          updated_at: string | null
        }
        Insert: {
          background_image_url?: string | null
          background_overlay_opacity?: string | null
          contact_email?: string | null
          created_at?: string | null
          discord_url?: string | null
          facebook_url?: string | null
          feature_achievements?: boolean | null
          feature_coming_soon?: boolean | null
          feature_events?: boolean | null
          feature_for_sale?: boolean | null
          feature_lending?: boolean | null
          feature_messaging?: boolean | null
          feature_play_logs?: boolean | null
          feature_ratings?: boolean | null
          feature_wishlist?: boolean | null
          footer_text?: string | null
          id?: string | null
          instagram_url?: string | null
          library_id?: string | null
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
          theme_dark_foreground_h?: string | null
          theme_dark_foreground_l?: string | null
          theme_dark_foreground_s?: string | null
          theme_dark_primary_h?: string | null
          theme_dark_primary_l?: string | null
          theme_dark_primary_s?: string | null
          theme_dark_sidebar_h?: string | null
          theme_dark_sidebar_l?: string | null
          theme_dark_sidebar_s?: string | null
          theme_font_body?: string | null
          theme_font_display?: string | null
          theme_foreground_h?: string | null
          theme_foreground_l?: string | null
          theme_foreground_s?: string | null
          theme_primary_h?: string | null
          theme_primary_l?: string | null
          theme_primary_s?: string | null
          theme_sidebar_h?: string | null
          theme_sidebar_l?: string | null
          theme_sidebar_s?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Update: {
          background_image_url?: string | null
          background_overlay_opacity?: string | null
          contact_email?: string | null
          created_at?: string | null
          discord_url?: string | null
          facebook_url?: string | null
          feature_achievements?: boolean | null
          feature_coming_soon?: boolean | null
          feature_events?: boolean | null
          feature_for_sale?: boolean | null
          feature_lending?: boolean | null
          feature_messaging?: boolean | null
          feature_play_logs?: boolean | null
          feature_ratings?: boolean | null
          feature_wishlist?: boolean | null
          footer_text?: string | null
          id?: string | null
          instagram_url?: string | null
          library_id?: string | null
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
          theme_dark_foreground_h?: string | null
          theme_dark_foreground_l?: string | null
          theme_dark_foreground_s?: string | null
          theme_dark_primary_h?: string | null
          theme_dark_primary_l?: string | null
          theme_dark_primary_s?: string | null
          theme_dark_sidebar_h?: string | null
          theme_dark_sidebar_l?: string | null
          theme_dark_sidebar_s?: string | null
          theme_font_body?: string | null
          theme_font_display?: string | null
          theme_foreground_h?: string | null
          theme_foreground_l?: string | null
          theme_foreground_s?: string | null
          theme_primary_h?: string | null
          theme_primary_l?: string | null
          theme_primary_s?: string | null
          theme_sidebar_h?: string | null
          theme_sidebar_l?: string | null
          theme_sidebar_s?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
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
          {
            foreignKeyName: "library_settings_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: true
            referencedRelation: "library_directory"
            referencedColumns: ["id"]
          },
        ]
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
      user_profiles_minimal: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          user_id: string | null
          username: string | null
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
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_forum_category: {
        Args: { _category_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_forum_category: {
        Args: { _category_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_expired_email_tokens: { Args: never; Returns: undefined }
      cleanup_expired_tokens: { Args: never; Returns: undefined }
      cleanup_old_messages: {
        Args: { retention_days?: number }
        Returns: number
      }
      create_notification: {
        Args: {
          _body?: string
          _metadata?: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      generate_slug: { Args: { title: string }; Returns: string }
      get_role_tier: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_level: {
        Args: {
          _min_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_club_member: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_owner: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_library_member: {
        Args: { _library_id: string; _user_id: string }
        Returns: boolean
      }
      is_library_moderator: {
        Args: { _library_id: string; _user_id: string }
        Returns: boolean
      }
      is_slug_available: { Args: { check_slug: string }; Returns: boolean }
      set_timezone: { Args: never; Returns: undefined }
      slugify: { Args: { input: string }; Returns: string }
      user_has_totp_enabled: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      achievement_category:
        | "collector"
        | "player"
        | "social"
        | "explorer"
        | "contributor"
        | "lender"
      app_role: "admin" | "moderator" | "user" | "owner" | "staff"
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
      library_member_role: "member" | "moderator"
      loan_status:
        | "requested"
        | "approved"
        | "active"
        | "returned"
        | "declined"
        | "cancelled"
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
      achievement_category: [
        "collector",
        "player",
        "social",
        "explorer",
        "contributor",
        "lender",
      ],
      app_role: ["admin", "moderator", "user", "owner", "staff"],
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
      library_member_role: ["member", "moderator"],
      loan_status: [
        "requested",
        "approved",
        "active",
        "returned",
        "declined",
        "cancelled",
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
