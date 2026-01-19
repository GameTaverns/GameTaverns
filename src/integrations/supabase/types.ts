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
          is_for_sale: boolean
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
          is_for_sale?: boolean
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
          is_for_sale?: boolean
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
          is_coming_soon: boolean | null
          is_expansion: boolean | null
          is_for_sale: boolean | null
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
          is_coming_soon?: boolean | null
          is_expansion?: boolean | null
          is_for_sale?: boolean | null
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
          is_coming_soon?: boolean | null
          is_expansion?: boolean | null
          is_for_sale?: boolean | null
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
    }
    Functions: {
      generate_slug: { Args: { title: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
    },
  },
} as const
