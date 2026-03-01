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
      activity_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      activity_reactions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      artists: {
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
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
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
      catalog_artists: {
        Row: {
          artist_id: string
          catalog_id: string
          id: string
        }
        Insert: {
          artist_id: string
          catalog_id: string
          id?: string
        }
        Update: {
          artist_id?: string
          catalog_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_artists_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "catalog_artists_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_corrections: {
        Row: {
          catalog_id: string
          created_at: string
          field_name: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          suggested_value: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          field_name: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          suggested_value: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          field_name?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          suggested_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_corrections_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "catalog_corrections_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_designers: {
        Row: {
          catalog_id: string
          designer_id: string
          id: string
        }
        Insert: {
          catalog_id: string
          designer_id: string
          id?: string
        }
        Update: {
          catalog_id?: string
          designer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_designers_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "catalog_designers_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_designers_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_mechanics: {
        Row: {
          catalog_id: string
          id: string
          mechanic_id: string
        }
        Insert: {
          catalog_id: string
          id?: string
          mechanic_id: string
        }
        Update: {
          catalog_id?: string
          id?: string
          mechanic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_mechanics_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "catalog_mechanics_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_mechanics_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "mechanics"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_publishers: {
        Row: {
          catalog_id: string
          id: string
          publisher_id: string
        }
        Insert: {
          catalog_id: string
          id?: string
          publisher_id: string
        }
        Update: {
          catalog_id?: string
          id?: string
          publisher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_publishers_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "catalog_publishers_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_publishers_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_purchase_links: {
        Row: {
          catalog_id: string
          created_at: string
          id: string
          is_affiliate: boolean
          retailer_logo_url: string | null
          retailer_name: string
          source: string
          status: string
          submitted_by: string | null
          updated_at: string
          url: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          id?: string
          is_affiliate?: boolean
          retailer_logo_url?: string | null
          retailer_name: string
          source?: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          id?: string
          is_affiliate?: boolean
          retailer_logo_url?: string | null
          retailer_name?: string
          source?: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_purchase_links_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "catalog_purchase_links_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_ratings: {
        Row: {
          catalog_id: string
          created_at: string
          device_fingerprint: string | null
          guest_identifier: string
          id: string
          ip_address: string | null
          rating: number
          source: string
          updated_at: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          device_fingerprint?: string | null
          guest_identifier: string
          id?: string
          ip_address?: string | null
          rating: number
          source?: string
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          device_fingerprint?: string | null
          guest_identifier?: string
          id?: string
          ip_address?: string | null
          rating?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_ratings_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "catalog_ratings_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_scraper_state: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          last_error: string | null
          last_run_at: string | null
          next_bgg_id: number
          total_added: number
          total_errors: number
          total_processed: number
          total_skipped: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_run_at?: string | null
          next_bgg_id?: number
          total_added?: number
          total_errors?: number
          total_processed?: number
          total_skipped?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_run_at?: string | null
          next_bgg_id?: number
          total_added?: number
          total_errors?: number
          total_processed?: number
          total_skipped?: number
          updated_at?: string
        }
        Relationships: []
      }
      catalog_video_votes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_video_votes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "catalog_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_videos: {
        Row: {
          catalog_id: string
          created_at: string
          downvotes: number
          id: string
          is_featured: boolean
          source: string | null
          submitted_by: string | null
          title: string | null
          updated_at: string
          upvotes: number
          youtube_url: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          downvotes?: number
          id?: string
          is_featured?: boolean
          source?: string | null
          submitted_by?: string | null
          title?: string | null
          updated_at?: string
          upvotes?: number
          youtube_url: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          downvotes?: number
          id?: string
          is_featured?: boolean
          source?: string | null
          submitted_by?: string | null
          title?: string | null
          updated_at?: string
          upvotes?: number
          youtube_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_videos_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "catalog_videos_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
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
      curated_list_items: {
        Row: {
          created_at: string
          game_id: string
          id: string
          list_id: string
          notes: string | null
          rank: number
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          list_id: string
          notes?: string | null
          rank?: number
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          list_id?: string
          notes?: string | null
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "curated_list_items_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "curated_list_items_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_list_items_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "curated_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_list_votes: {
        Row: {
          created_at: string
          id: string
          list_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curated_list_votes_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "curated_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          library_id: string | null
          title: string
          updated_at: string
          user_id: string
          vote_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          library_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          vote_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          library_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "curated_lists_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_lists_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_lists_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "curated_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "curated_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles_minimal"
            referencedColumns: ["user_id"]
          },
        ]
      }
      dashboard_layouts: {
        Row: {
          config: Json
          created_at: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      designers: {
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
      direct_messages: {
        Row: {
          content: string
          created_at: string
          deleted_by_recipient: boolean
          deleted_by_sender: boolean
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_by_recipient?: boolean
          deleted_by_sender?: boolean
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_by_recipient?: boolean
          deleted_by_sender?: boolean
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
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
      feedback_notes: {
        Row: {
          author_id: string
          author_name: string | null
          content: string
          created_at: string
          feedback_id: string
          id: string
          note_type: string
        }
        Insert: {
          author_id: string
          author_name?: string | null
          content: string
          created_at?: string
          feedback_id: string
          id?: string
          note_type?: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          content?: string
          created_at?: string
          feedback_id?: string
          id?: string
          note_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_notes_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "platform_feedback"
            referencedColumns: ["id"]
          },
        ]
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
          parent_category_id: string | null
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
          parent_category_id?: string | null
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
          parent_category_id?: string | null
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
          {
            foreignKeyName: "forum_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
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
          bgg_market_price: number | null
          bgg_price_fetched_at: string | null
          created_at: string
          current_value: number | null
          game_id: string
          id: string
          purchase_date: string | null
          purchase_price: number | null
          updated_at: string
          value_updated_at: string | null
        }
        Insert: {
          bgg_market_price?: number | null
          bgg_price_fetched_at?: string | null
          created_at?: string
          current_value?: number | null
          game_id: string
          id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          updated_at?: string
          value_updated_at?: string | null
        }
        Update: {
          bgg_market_price?: number | null
          bgg_price_fetched_at?: string | null
          created_at?: string
          current_value?: number | null
          game_id?: string
          id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          updated_at?: string
          value_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_admin_data_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
      game_artists: {
        Row: {
          artist_id: string
          game_id: string
          id: string
        }
        Insert: {
          artist_id: string
          game_id: string
          id?: string
        }
        Update: {
          artist_id?: string
          game_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_artists_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_artists_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_artists_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_catalog: {
        Row: {
          additional_images: string[] | null
          bgg_community_rating: number | null
          bgg_id: string | null
          bgg_url: string | null
          bgg_verified_type: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_expansion: boolean
          max_players: number | null
          min_players: number | null
          parent_catalog_id: string | null
          play_time_minutes: number | null
          slug: string | null
          suggested_age: string | null
          title: string
          updated_at: string
          weight: number | null
          year_published: number | null
        }
        Insert: {
          additional_images?: string[] | null
          bgg_community_rating?: number | null
          bgg_id?: string | null
          bgg_url?: string | null
          bgg_verified_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_expansion?: boolean
          max_players?: number | null
          min_players?: number | null
          parent_catalog_id?: string | null
          play_time_minutes?: number | null
          slug?: string | null
          suggested_age?: string | null
          title: string
          updated_at?: string
          weight?: number | null
          year_published?: number | null
        }
        Update: {
          additional_images?: string[] | null
          bgg_community_rating?: number | null
          bgg_id?: string | null
          bgg_url?: string | null
          bgg_verified_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_expansion?: boolean
          max_players?: number | null
          min_players?: number | null
          parent_catalog_id?: string | null
          play_time_minutes?: number | null
          slug?: string | null
          suggested_age?: string | null
          title?: string
          updated_at?: string
          weight?: number | null
          year_published?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_catalog_parent_catalog_id_fkey"
            columns: ["parent_catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "game_catalog_parent_catalog_id_fkey"
            columns: ["parent_catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
      game_designers: {
        Row: {
          designer_id: string
          game_id: string
          id: string
        }
        Insert: {
          designer_id: string
          game_id: string
          id?: string
        }
        Update: {
          designer_id?: string
          game_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_designers_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_designers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_designers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_designers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_documents: {
        Row: {
          catalog_id: string | null
          created_at: string
          document_type: string
          file_size_bytes: number | null
          file_url: string
          game_id: string
          id: string
          is_catalog_synced: boolean
          language: string | null
          sync_requested_at: string | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          catalog_id?: string | null
          created_at?: string
          document_type?: string
          file_size_bytes?: number | null
          file_url: string
          game_id: string
          id?: string
          is_catalog_synced?: boolean
          language?: string | null
          sync_requested_at?: string | null
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          catalog_id?: string | null
          created_at?: string
          document_type?: string
          file_size_bytes?: number | null
          file_url?: string
          game_id?: string
          id?: string
          is_catalog_synced?: boolean
          language?: string | null
          sync_requested_at?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_documents_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "game_documents_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_documents_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_documents_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_documents_game_id_fkey"
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
          source: string
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
          source?: string
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
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
          linked_user_id: string | null
          player_name: string
          score: number | null
          session_id: string
          tag_status: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_first_play?: boolean
          is_winner?: boolean
          linked_user_id?: string | null
          player_name: string
          score?: number | null
          session_id: string
          tag_status?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_first_play?: boolean
          is_winner?: boolean
          linked_user_id?: string | null
          player_name?: string
          score?: number | null
          session_id?: string
          tag_status?: string
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
          catalog_id: string | null
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
          is_unplayed: boolean
          library_id: string | null
          location_misc: string | null
          location_room: string | null
          location_shelf: string | null
          max_players: number | null
          min_players: number | null
          ownership_status: Database["public"]["Enums"]["ownership_status"]
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
          catalog_id?: string | null
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
          is_unplayed?: boolean
          library_id?: string | null
          location_misc?: string | null
          location_room?: string | null
          location_shelf?: string | null
          max_players?: number | null
          min_players?: number | null
          ownership_status?: Database["public"]["Enums"]["ownership_status"]
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
          catalog_id?: string | null
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
          is_unplayed?: boolean
          library_id?: string | null
          location_misc?: string | null
          location_room?: string | null
          location_shelf?: string | null
          max_players?: number | null
          min_players?: number | null
          ownership_status?: Database["public"]["Enums"]["ownership_status"]
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
            foreignKeyName: "games_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "games_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
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
      import_item_errors: {
        Row: {
          bgg_id: string | null
          created_at: string
          error_category: string
          error_reason: string
          id: string
          item_title: string | null
          job_id: string
          raw_input: Json | null
        }
        Insert: {
          bgg_id?: string | null
          created_at?: string
          error_category?: string
          error_reason: string
          id?: string
          item_title?: string | null
          job_id: string
          raw_input?: Json | null
        }
        Update: {
          bgg_id?: string | null
          created_at?: string
          error_category?: string
          error_reason?: string
          id?: string
          item_title?: string | null
          job_id?: string
          raw_input?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_item_errors_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
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
          import_metadata: Json | null
          import_type: string | null
          library_id: string
          processed_items: number
          skipped_items: number
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
          import_metadata?: Json | null
          import_type?: string | null
          library_id: string
          processed_items?: number
          skipped_items?: number
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
          import_metadata?: Json | null
          import_type?: string | null
          library_id?: string
          processed_items?: number
          skipped_items?: number
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
          bgg_last_sync_message: string | null
          bgg_last_sync_status: string | null
          bgg_last_synced_at: string | null
          bgg_sync_collection: boolean
          bgg_sync_enabled: boolean
          bgg_sync_frequency: string
          bgg_sync_plays: boolean
          bgg_sync_removal_behavior: string
          bgg_sync_wishlist: boolean
          bgg_username: string | null
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
          location_city: string | null
          location_country: string | null
          location_region: string | null
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
          theme_font_accent: string | null
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
          bgg_last_sync_message?: string | null
          bgg_last_sync_status?: string | null
          bgg_last_synced_at?: string | null
          bgg_sync_collection?: boolean
          bgg_sync_enabled?: boolean
          bgg_sync_frequency?: string
          bgg_sync_plays?: boolean
          bgg_sync_removal_behavior?: string
          bgg_sync_wishlist?: boolean
          bgg_username?: string | null
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
          location_city?: string | null
          location_country?: string | null
          location_region?: string | null
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
          theme_font_accent?: string | null
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
          bgg_last_sync_message?: string | null
          bgg_last_sync_status?: string | null
          bgg_last_synced_at?: string | null
          bgg_sync_collection?: boolean
          bgg_sync_enabled?: boolean
          bgg_sync_frequency?: string
          bgg_sync_plays?: boolean
          bgg_sync_removal_behavior?: string
          bgg_sync_wishlist?: boolean
          bgg_username?: string | null
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
          location_city?: string | null
          location_country?: string | null
          location_region?: string | null
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
          theme_font_accent?: string | null
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
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
      photo_likes: {
        Row: {
          created_at: string
          id: string
          photo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_likes_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "user_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_feedback: {
        Row: {
          assigned_to: string | null
          assigned_to_name: string | null
          created_at: string
          discord_thread_id: string | null
          id: string
          is_read: boolean
          message: string
          screenshot_urls: string[] | null
          sender_email: string | null
          sender_name: string
          status: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          created_at?: string
          discord_thread_id?: string | null
          id?: string
          is_read?: boolean
          message: string
          screenshot_urls?: string[] | null
          sender_email?: string | null
          sender_name: string
          status?: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          created_at?: string
          discord_thread_id?: string | null
          id?: string
          is_read?: boolean
          message?: string
          screenshot_urls?: string[] | null
          sender_email?: string | null
          sender_name?: string
          status?: string
          type?: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
        }
        Relationships: []
      }
      player_elo_ratings: {
        Row: {
          elo: number
          game_id: string | null
          games_played: number
          id: string
          losses: number
          peak_elo: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          elo?: number
          game_id?: string | null
          games_played?: number
          id?: string
          losses?: number
          peak_elo?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          elo?: number
          game_id?: string | null
          games_played?: number
          id?: string
          losses?: number
          peak_elo?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_elo_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "player_elo_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_elo_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
      reengagement_email_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      referral_badges: {
        Row: {
          created_at: string
          founding_member_granted_at: string | null
          has_guild_founder: boolean
          has_legend: boolean
          has_tavern_regular: boolean
          has_town_crier: boolean
          id: string
          is_founding_member: boolean
          referral_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          founding_member_granted_at?: string | null
          has_guild_founder?: boolean
          has_legend?: boolean
          has_tavern_regular?: boolean
          has_town_crier?: boolean
          id?: string
          is_founding_member?: boolean
          referral_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          founding_member_granted_at?: string | null
          has_guild_founder?: boolean
          has_legend?: boolean
          has_tavern_regular?: boolean
          has_town_crier?: boolean
          id?: string
          is_founding_member?: boolean
          referral_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_user_id: string | null
          referrer_user_id: string
          signed_up_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_user_id?: string | null
          referrer_user_id: string
          signed_up_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_user_id?: string | null
          referrer_user_id?: string
          signed_up_at?: string | null
        }
        Relationships: []
      }
      server_commands: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          output: string | null
          requested_by: string
          script_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          output?: string | null
          requested_by: string
          script_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          output?: string | null
          requested_by?: string
          script_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      session_tag_requests: {
        Row: {
          created_at: string
          game_id: string | null
          game_title: string | null
          id: string
          resolved_at: string | null
          session_date: string | null
          session_player_id: string
          status: string
          tagged_by_user_id: string
          tagged_user_id: string
        }
        Insert: {
          created_at?: string
          game_id?: string | null
          game_title?: string | null
          id?: string
          resolved_at?: string | null
          session_date?: string | null
          session_player_id: string
          status?: string
          tagged_by_user_id: string
          tagged_user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string | null
          game_title?: string | null
          id?: string
          resolved_at?: string | null
          session_date?: string | null
          session_player_id?: string
          status?: string
          tagged_by_user_id?: string
          tagged_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_tag_requests_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "session_tag_requests_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_tag_requests_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_tag_requests_session_player_id_fkey"
            columns: ["session_player_id"]
            isOneToOne: false
            referencedRelation: "game_session_players"
            referencedColumns: ["id"]
          },
        ]
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
      system_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          library_id: string | null
          message: string
          metadata: Json | null
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          library_id?: string | null
          message: string
          metadata?: Json | null
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          library_id?: string | null
          message?: string
          metadata?: Json | null
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_logs_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_logs_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "library_directory"
            referencedColumns: ["id"]
          },
        ]
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
      user_dashboard_prefs: {
        Row: {
          hidden_tabs: string[]
          hidden_widgets: Json
          tab_order: string[]
          updated_at: string
          user_id: string
          widget_order: Json
          widget_sizes: Json
        }
        Insert: {
          hidden_tabs?: string[]
          hidden_widgets?: Json
          tab_order?: string[]
          updated_at?: string
          user_id: string
          widget_order?: Json
          widget_sizes?: Json
        }
        Update: {
          hidden_tabs?: string[]
          hidden_widgets?: Json
          tab_order?: string[]
          updated_at?: string
          user_id?: string
          widget_order?: Json
          widget_sizes?: Json
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_photos: {
        Row: {
          batch_id: string | null
          caption: string | null
          created_at: string
          id: string
          image_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          banner_gradient: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          discord_user_id: string | null
          display_name: string | null
          featured_achievement_id: string | null
          id: string
          marketing_emails_opted_out: boolean
          profile_accent_h: string | null
          profile_accent_l: string | null
          profile_accent_s: string | null
          profile_background_h: string | null
          profile_background_l: string | null
          profile_background_s: string | null
          profile_bg_image_url: string | null
          profile_bg_opacity: string | null
          profile_primary_h: string | null
          profile_primary_l: string | null
          profile_primary_s: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_gradient?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          discord_user_id?: string | null
          display_name?: string | null
          featured_achievement_id?: string | null
          id?: string
          marketing_emails_opted_out?: boolean
          profile_accent_h?: string | null
          profile_accent_l?: string | null
          profile_accent_s?: string | null
          profile_background_h?: string | null
          profile_background_l?: string | null
          profile_background_s?: string | null
          profile_bg_image_url?: string | null
          profile_bg_opacity?: string | null
          profile_primary_h?: string | null
          profile_primary_l?: string | null
          profile_primary_s?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_gradient?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          discord_user_id?: string | null
          display_name?: string | null
          featured_achievement_id?: string | null
          id?: string
          marketing_emails_opted_out?: boolean
          profile_accent_h?: string | null
          profile_accent_l?: string | null
          profile_accent_s?: string | null
          profile_background_h?: string | null
          profile_background_l?: string | null
          profile_background_s?: string | null
          profile_bg_image_url?: string | null
          profile_bg_opacity?: string | null
          profile_primary_h?: string | null
          profile_primary_l?: string | null
          profile_primary_s?: string | null
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
      user_push_tokens: {
        Row: {
          created_at: string
          device_info: Json | null
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
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
      user_special_badges: {
        Row: {
          badge_color: string
          badge_icon: string | null
          badge_label: string
          badge_type: string
          granted_at: string
          granted_by: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          badge_color?: string
          badge_icon?: string | null
          badge_label: string
          badge_type: string
          granted_at?: string
          granted_by: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          badge_color?: string
          badge_icon?: string | null
          badge_label?: string
          badge_type?: string
          granted_at?: string
          granted_by?: string
          id?: string
          notes?: string | null
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
      catalog_popularity: {
        Row: {
          bgg_id: string | null
          catalog_id: string | null
          image_url: string | null
          library_count: number | null
          max_players: number | null
          min_players: number | null
          play_time_minutes: number | null
          slug: string | null
          title: string | null
          total_plays: number | null
          weight: number | null
        }
        Relationships: []
      }
      catalog_ratings_summary: {
        Row: {
          average_rating: number | null
          catalog_id: string | null
          rating_count: number | null
          visitor_average: number | null
          visitor_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_ratings_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "catalog_ratings_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      game_hotness: {
        Row: {
          catalog_id: string | null
          game_id: string | null
          hotness_score: number | null
          image_url: string | null
          library_id: string | null
          max_players: number | null
          min_players: number | null
          play_time: Database["public"]["Enums"]["play_time"] | null
          recent_plays: number | null
          recent_ratings: number | null
          recent_wishes: number | null
          slug: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_popularity"
            referencedColumns: ["catalog_id"]
          },
          {
            foreignKeyName: "games_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
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
        ]
      }
      game_ratings_library_view: {
        Row: {
          created_at: string | null
          game_id: string | null
          guest_identifier: string | null
          id: string | null
          rating: number | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          game_id?: string | null
          guest_identifier?: string | null
          id?: string | null
          rating?: number | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          game_id?: string | null
          guest_identifier?: string | null
          id?: string | null
          rating?: number | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
          bgg_user_average: number | null
          bgg_user_count: number | null
          game_id: string | null
          rating_count: number | null
          visitor_average: number | null
          visitor_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
          copies_owned: number | null
          created_at: string | null
          crowdfunded: boolean | null
          description: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          game_type: Database["public"]["Enums"]["game_type"] | null
          genre: string | null
          id: string | null
          image_url: string | null
          in_base_game_box: boolean | null
          inserts: boolean | null
          is_coming_soon: boolean | null
          is_expansion: boolean | null
          is_favorite: boolean | null
          is_for_sale: boolean | null
          is_unplayed: boolean | null
          library_id: string | null
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
          copies_owned?: number | null
          created_at?: string | null
          crowdfunded?: boolean | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          game_type?: Database["public"]["Enums"]["game_type"] | null
          genre?: string | null
          id?: string | null
          image_url?: string | null
          in_base_game_box?: boolean | null
          inserts?: boolean | null
          is_coming_soon?: boolean | null
          is_expansion?: boolean | null
          is_favorite?: boolean | null
          is_for_sale?: boolean | null
          is_unplayed?: boolean | null
          library_id?: string | null
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
          copies_owned?: number | null
          created_at?: string | null
          crowdfunded?: boolean | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          game_type?: Database["public"]["Enums"]["game_type"] | null
          genre?: string | null
          id?: string | null
          image_url?: string | null
          in_base_game_box?: boolean | null
          inserts?: boolean | null
          is_coming_soon?: boolean | null
          is_expansion?: boolean | null
          is_favorite?: boolean | null
          is_for_sale?: boolean | null
          is_unplayed?: boolean | null
          library_id?: string | null
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
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
            referencedRelation: "game_hotness"
            referencedColumns: ["game_id"]
          },
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
      public_user_profiles: {
        Row: {
          achievement_points: number | null
          achievements_earned: number | null
          avatar_url: string | null
          banner_gradient: string | null
          banner_url: string | null
          bio: string | null
          display_name: string | null
          expansions_owned: number | null
          featured_achievement_id: string | null
          games_owned: number | null
          member_since: string | null
          profile_accent_h: string | null
          profile_accent_l: string | null
          profile_accent_s: string | null
          profile_background_h: string | null
          profile_background_l: string | null
          profile_background_s: string | null
          profile_bg_image_url: string | null
          profile_bg_opacity: string | null
          profile_primary_h: string | null
          profile_primary_l: string | null
          profile_primary_s: string | null
          sessions_logged: number | null
          user_id: string | null
          username: string | null
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
      site_settings_public: {
        Row: {
          key: string | null
          value: string | null
        }
        Insert: {
          key?: string | null
          value?: string | null
        }
        Update: {
          key?: string | null
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
      calculate_elo_k_factor: {
        Args: { games_played: number }
        Returns: number
      }
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
      cleanup_old_audit_logs: {
        Args: { retention_days?: number }
        Returns: number
      }
      cleanup_old_login_attempts: { Args: never; Returns: number }
      cleanup_old_messages: {
        Args: { retention_days?: number }
        Returns: number
      }
      cleanup_old_system_logs: {
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
      get_catalog_enrichment_status: { Args: never; Returns: Json }
      get_catalog_filter_options: { Args: never; Returns: Json }
      get_cron_job_runs: {
        Args: never
        Returns: {
          command: string
          database: string
          end_time: string
          job_pid: number
          jobid: number
          jobname: string
          return_message: string
          runid: number
          start_time: string
          status: string
          username: string
        }[]
      }
      get_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      get_or_create_referral_code: {
        Args: { _user_id: string }
        Returns: string
      }
      get_role_tier: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      get_unenriched_catalog_entries: {
        Args: { p_limit?: number }
        Returns: {
          bgg_id: string
          id: string
          title: string
        }[]
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
      is_account_locked: { Args: { _email: string }; Returns: boolean }
      is_club_member: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_owner: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_library_co_owner: {
        Args: { _library_id: string; _user_id: string }
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
      update_player_elo: {
        Args: {
          p_game_id: string
          p_opponent_elo: number
          p_user_id: string
          p_won: boolean
        }
        Returns: number
      }
      update_referral_badges: {
        Args: { _referrer_id: string }
        Returns: undefined
      }
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
      feedback_type: "feedback" | "bug" | "feature_request" | "badge_request"
      game_type:
        | "Board Game"
        | "Card Game"
        | "Dice Game"
        | "Party Game"
        | "War Game"
        | "Miniatures"
        | "RPG"
        | "Other"
      library_member_role: "member" | "moderator" | "co_owner"
      loan_status:
        | "requested"
        | "approved"
        | "active"
        | "returned"
        | "declined"
        | "cancelled"
      ownership_status: "owned" | "previously_owned" | "played_only"
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
      feedback_type: ["feedback", "bug", "feature_request", "badge_request"],
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
      library_member_role: ["member", "moderator", "co_owner"],
      loan_status: [
        "requested",
        "approved",
        "active",
        "returned",
        "declined",
        "cancelled",
      ],
      ownership_status: ["owned", "previously_owned", "played_only"],
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
