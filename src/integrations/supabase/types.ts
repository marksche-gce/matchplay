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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      match_participants: {
        Row: {
          id: string
          is_placeholder: boolean | null
          match_id: string
          placeholder_name: string | null
          player_id: string | null
          position: number | null
          score: number | null
          team_number: number | null
        }
        Insert: {
          id?: string
          is_placeholder?: boolean | null
          match_id: string
          placeholder_name?: string | null
          player_id?: string | null
          position?: number | null
          score?: number | null
          team_number?: number | null
        }
        Update: {
          id?: string
          is_placeholder?: boolean | null
          match_id?: string
          placeholder_name?: string | null
          player_id?: string | null
          position?: number | null
          score?: number | null
          team_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_simple"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          id: string
          match_date: string | null
          match_time: string | null
          next_match_id: string | null
          previous_match_1_id: string | null
          previous_match_2_id: string | null
          round: string
          status: string
          tee: number | null
          tournament_id: string
          type: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_date?: string | null
          match_time?: string | null
          next_match_id?: string | null
          previous_match_1_id?: string | null
          previous_match_2_id?: string | null
          round: string
          status?: string
          tee?: number | null
          tournament_id: string
          type: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_date?: string | null
          match_time?: string | null
          next_match_id?: string | null
          previous_match_1_id?: string | null
          previous_match_2_id?: string | null
          round?: string
          status?: string
          tee?: number | null
          tournament_id?: string
          type?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_previous_match_1_id_fkey"
            columns: ["previous_match_1_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_previous_match_2_id_fkey"
            columns: ["previous_match_2_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players_simple"
            referencedColumns: ["id"]
          },
        ]
      }
      matches_new: {
        Row: {
          created_at: string | null
          feeds_to_match_id: string | null
          feeds_to_position: number | null
          id: string
          match_number: number
          player1_id: string | null
          player2_id: string | null
          round_number: number
          status: Database["public"]["Enums"]["match_status"] | null
          team1_id: string | null
          team2_id: string | null
          tournament_id: string | null
          updated_at: string | null
          winner_player_id: string | null
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string | null
          feeds_to_match_id?: string | null
          feeds_to_position?: number | null
          id?: string
          match_number: number
          player1_id?: string | null
          player2_id?: string | null
          round_number: number
          status?: Database["public"]["Enums"]["match_status"] | null
          team1_id?: string | null
          team2_id?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          winner_player_id?: string | null
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string | null
          feeds_to_match_id?: string | null
          feeds_to_position?: number | null
          id?: string
          match_number?: number
          player1_id?: string | null
          player2_id?: string | null
          round_number?: number
          status?: Database["public"]["Enums"]["match_status"] | null
          team1_id?: string | null
          team2_id?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          winner_player_id?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_new_feeds_to_match_id_fkey"
            columns: ["feeds_to_match_id"]
            isOneToOne: false
            referencedRelation: "matches_new"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_new_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players_new"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_new_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players_new"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_new_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_new_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_new_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments_new"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_new_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players_new"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_new_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          email: string | null
          emergency_contact: string | null
          handicap: number
          id: string
          name: string
          phone: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          handicap?: number
          id?: string
          name: string
          phone?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          handicap?: number
          id?: string
          name?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      players_new: {
        Row: {
          created_at: string | null
          email: string | null
          handicap: number | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          handicap?: number | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          handicap?: number | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      round_deadlines: {
        Row: {
          closing_date: string
          id: string
          round_number: number
          tournament_id: string | null
        }
        Insert: {
          closing_date: string
          id?: string
          round_number: number
          tournament_id?: string | null
        }
        Update: {
          closing_date?: string
          id?: string
          round_number?: number
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_deadlines_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments_new"
            referencedColumns: ["id"]
          },
        ]
      }
      system_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["system_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["system_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["system_role"]
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          player1_id: string | null
          player2_id: string | null
          tenant_id: string | null
          tournament_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          player1_id?: string | null
          player2_id?: string | null
          tenant_id?: string | null
          tournament_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          player1_id?: string | null
          player2_id?: string | null
          tenant_id?: string | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players_new"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players_new"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments_new"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      tournament_registrations: {
        Row: {
          id: string
          notes: string | null
          payment_status: string
          player_id: string
          registration_date: string
          status: string
          tournament_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          payment_status?: string
          player_id: string
          registration_date?: string
          status?: string
          tournament_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          payment_status?: string
          player_id?: string
          registration_date?: string
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_simple"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations_new: {
        Row: {
          id: string
          player_id: string | null
          registered_at: string | null
          team_id: string | null
          tournament_id: string | null
        }
        Insert: {
          id?: string
          player_id?: string | null
          registered_at?: string | null
          team_id?: string | null
          tournament_id?: string | null
        }
        Update: {
          id?: string
          player_id?: string | null
          registered_at?: string | null
          team_id?: string | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_new_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_new"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_new_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_new_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments_new"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          course: string
          created_at: string
          description: string | null
          end_date: string
          entry_fee: number | null
          format: string
          id: string
          max_players: number
          name: string
          registration_deadline: string | null
          registration_open: boolean
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          course: string
          created_at?: string
          description?: string | null
          end_date: string
          entry_fee?: number | null
          format: string
          id?: string
          max_players?: number
          name: string
          registration_deadline?: string | null
          registration_open?: boolean
          start_date: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          course?: string
          created_at?: string
          description?: string | null
          end_date?: string
          entry_fee?: number | null
          format?: string
          id?: string
          max_players?: number
          name?: string
          registration_deadline?: string | null
          registration_open?: boolean
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments_new: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          max_players: number
          max_rounds: number | null
          name: string
          registration_status:
            | Database["public"]["Enums"]["registration_status"]
            | null
          start_date: string
          tenant_id: string | null
          type: Database["public"]["Enums"]["tournament_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          max_players: number
          max_rounds?: number | null
          name: string
          registration_status?:
            | Database["public"]["Enums"]["registration_status"]
            | null
          start_date: string
          tenant_id?: string | null
          type: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          max_players?: number
          max_rounds?: number | null
          name?: string
          registration_status?:
            | Database["public"]["Enums"]["registration_status"]
            | null
          start_date?: string
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_new_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      players_secure: {
        Row: {
          created_at: string | null
          email: string | null
          emergency_contact: string | null
          handicap: number | null
          id: string | null
          name: string | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: never
          emergency_contact?: never
          handicap?: number | null
          id?: string | null
          name?: string | null
          phone?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: never
          emergency_contact?: never
          handicap?: number | null
          id?: string | null
          name?: string | null
          phone?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      players_simple: {
        Row: {
          created_at: string | null
          email: string | null
          emergency_contact: string | null
          handicap: number | null
          id: string | null
          name: string | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: never
          emergency_contact?: never
          handicap?: number | null
          id?: string | null
          name?: string | null
          phone?: never
          updated_at?: string | null
          user_id?: never
        }
        Update: {
          created_at?: string | null
          email?: never
          emergency_contact?: never
          handicap?: number | null
          id?: string | null
          name?: string | null
          phone?: never
          updated_at?: string | null
          user_id?: never
        }
        Relationships: []
      }
    }
    Functions: {
      create_admin_user: {
        Args: {
          user_display_name: string
          user_email: string
          user_password: string
          user_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      get_current_user_player_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_current_user_system_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["system_role"]
      }
      get_current_user_tenant_role: {
        Args: { _tenant_id: string }
        Returns: Database["public"]["Enums"]["tenant_role"]
      }
      get_user_tenants: {
        Args: { _user_id: string }
        Returns: {
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          user_role: Database["public"]["Enums"]["tenant_role"]
        }[]
      }
      has_role: {
        Args:
          | { _role: Database["public"]["Enums"]["app_role"]; _user_id: string }
          | { role_name: string }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["tenant_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_system_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_manager: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_organizer: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_player: {
        Args: { player_id_param: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "organizer" | "player"
      match_status: "pending" | "scheduled" | "completed"
      registration_status: "open" | "closed" | "full"
      system_role: "system_admin"
      tenant_role: "tenant_admin" | "organizer" | "player" | "manager"
      tournament_type: "singles" | "foursome"
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
      app_role: ["admin", "organizer", "player"],
      match_status: ["pending", "scheduled", "completed"],
      registration_status: ["open", "closed", "full"],
      system_role: ["system_admin"],
      tenant_role: ["tenant_admin", "organizer", "player", "manager"],
      tournament_type: ["singles", "foursome"],
    },
  },
} as const
