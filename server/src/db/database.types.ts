Initialising login role...
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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_configs: {
        Row: {
          created_at: string
          encrypted_api_key: string | null
          id: string
          mode: string
          model: string | null
          org_id: string
          provider: string | null
        }
        Insert: {
          created_at?: string
          encrypted_api_key?: string | null
          id?: string
          mode?: string
          model?: string | null
          org_id: string
          provider?: string | null
        }
        Update: {
          created_at?: string
          encrypted_api_key?: string | null
          id?: string
          mode?: string
          model?: string | null
          org_id?: string
          provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cost_usd: number
          id: string
          month: string
          org_id: string
          provider: string
          requests: number
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          cost_usd?: number
          id?: string
          month: string
          org_id: string
          provider: string
          requests?: number
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          cost_usd?: number
          id?: string
          month?: string
          org_id?: string
          provider?: string
          requests?: number
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_patterns: {
        Row: {
          category: string | null
          created_at: string
          edited: string
          id: string
          org_id: string
          original: string
          property_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          edited: string
          id?: string
          org_id: string
          original: string
          property_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          edited?: string
          id?: string
          org_id?: string
          original?: string
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edit_patterns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      host_style_profiles: {
        Row: {
          id: string
          org_id: string
          profile_json: Json
          property_id: string | null
          samples_analyzed: number
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          profile_json?: Json
          property_id?: string | null
          samples_analyzed?: number
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          profile_json?: Json
          property_id?: string | null
          samples_analyzed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_style_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          joined_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          joined_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          autopilot_enabled: boolean
          autopilot_threshold: number
          default_language: string
          id: string
          muted_properties_json: Json | null
          notification_categories_json: Json | null
          org_id: string
          quiet_hours_json: Json | null
          response_language_mode: string
        }
        Insert: {
          autopilot_enabled?: boolean
          autopilot_threshold?: number
          default_language?: string
          id?: string
          muted_properties_json?: Json | null
          notification_categories_json?: Json | null
          org_id: string
          quiet_hours_json?: Json | null
          response_language_mode?: string
        }
        Update: {
          autopilot_enabled?: boolean
          autopilot_threshold?: number
          default_language?: string
          id?: string
          muted_properties_json?: Json | null
          notification_categories_json?: Json | null
          org_id?: string
          quiet_hours_json?: Json | null
          response_language_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pms_connections: {
        Row: {
          account_id: string
          connected_at: string
          encrypted_credentials: string
          id: string
          last_sync_at: string | null
          oauth_refresh_token: string | null
          oauth_token: string | null
          org_id: string
          provider: string
          status: string
          token_expires_at: string | null
        }
        Insert: {
          account_id: string
          connected_at?: string
          encrypted_credentials: string
          id?: string
          last_sync_at?: string | null
          oauth_refresh_token?: string | null
          oauth_token?: string | null
          org_id: string
          provider: string
          status?: string
          token_expires_at?: string | null
        }
        Update: {
          account_id?: string
          connected_at?: string
          encrypted_credentials?: string
          id?: string
          last_sync_at?: string | null
          oauth_refresh_token?: string | null
          oauth_token?: string | null
          org_id?: string
          provider?: string
          status?: string
          token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pms_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_knowledge: {
        Row: {
          check_in: string | null
          check_out: string | null
          custom_fields: Json | null
          id: string
          org_id: string
          parking: string | null
          photos_json: Json | null
          property_id: string
          rules: string | null
          tone: string | null
          updated_at: string
          wifi_name: string | null
          wifi_password: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          custom_fields?: Json | null
          id?: string
          org_id: string
          parking?: string | null
          photos_json?: Json | null
          property_id: string
          rules?: string | null
          tone?: string | null
          updated_at?: string
          wifi_name?: string | null
          wifi_password?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          custom_fields?: Json | null
          id?: string
          org_id?: string
          parking?: string | null
          photos_json?: Json | null
          property_id?: string
          rules?: string | null
          tone?: string | null
          updated_at?: string
          wifi_name?: string | null
          wifi_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_knowledge_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          plan: string
          stripe_customer_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          plan?: string
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          plan?: string
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
