// Wygenerowane przez `supabase gen types typescript --remote --schema public` (staging) – nie edytuj ręcznie.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          allergies: string
          allergy_status: Database["public"]["Enums"]["allergy_status"]
          created_at: string
          created_by: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          note: string
          notifications_consent_at: string | null
          phone: string
          phone_digits: string | null
          rodo_consent_at: string | null
          salon_id: string
          updated_at: string
        }
        Insert: {
          allergies?: string
          allergy_status: Database["public"]["Enums"]["allergy_status"]
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          note?: string
          notifications_consent_at?: string | null
          phone: string
          phone_digits?: string | null
          rodo_consent_at?: string | null
          salon_id?: string
          updated_at?: string
        }
        Update: {
          allergies?: string
          allergy_status?: Database["public"]["Enums"]["allergy_status"]
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          note?: string
          notifications_consent_at?: string | null
          phone?: string
          phone_digits?: string | null
          rodo_consent_at?: string | null
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          login: string | null
          role: Database["public"]["Enums"]["user_role"]
          salon_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          full_name?: string
          id?: string
          login?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          salon_id?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          login?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          id: number
          ip_hash: string
          login_hash: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: never
          ip_hash: string
          login_hash: string
          success: boolean
        }
        Update: {
          attempted_at?: string
          id?: never
          ip_hash?: string
          login_hash?: string
          success?: boolean
        }
        Relationships: []
      }
      product_lines: {
        Row: {
          brand: string
          created_at: string
          created_by: string
          default_ratio: number | null
          deleted_at: string | null
          id: string
          name: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          created_by?: string
          default_ratio?: number | null
          deleted_at?: string | null
          id?: string
          name?: string
          salon_id?: string
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string
          default_ratio?: number | null
          deleted_at?: string | null
          id?: string
          name?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_lines_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      product_requests: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string
          id: string
          kind: Database["public"]["Enums"]["product_request_kind"]
          product_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          salon_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string
          id?: string
          kind: Database["public"]["Enums"]["product_request_kind"]
          product_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          salon_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["product_request_kind"]
          product_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_requests_product_id_salon_id_fkey"
            columns: ["product_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "product_requests_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          line_id: string
          package_size: number | null
          purchase_price: number | null
          ratio: number | null
          salon_id: string
          shade: string
          shade_key: string | null
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          line_id: string
          package_size?: number | null
          purchase_price?: number | null
          ratio?: number | null
          salon_id?: string
          shade: string
          shade_key?: string | null
          type: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          line_id?: string
          package_size?: number | null
          purchase_price?: number | null
          ratio?: number | null
          salon_id?: string
          shade?: string
          shade_key?: string | null
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_line_id_salon_id_fkey"
            columns: ["line_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "product_lines"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          login: string | null
          role: Database["public"]["Enums"]["user_role"]
          salon_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          full_name?: string
          id: string
          login?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          salon_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          login?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_salon_id: { Args: never; Returns: string }
      import_products: { Args: { items: Json }; Returns: Json }
      is_owner: { Args: never; Returns: boolean }
      login_throttled: {
        Args: { p_ip_hash: string; p_login_hash: string }
        Returns: boolean
      }
      record_login_attempt: {
        Args: { p_ip_hash: string; p_login_hash: string; p_success: boolean }
        Returns: undefined
      }
    }
    Enums: {
      allergy_status: "none" | "has"
      product_request_kind: "missing" | "running_low"
      product_type: "farba" | "utleniacz" | "rozjasniacz" | "toner" | "inny"
      user_role: "owner" | "apprentice"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      allergy_status: ["none", "has"],
      product_request_kind: ["missing", "running_low"],
      product_type: ["farba", "utleniacz", "rozjasniacz", "toner", "inny"],
      user_role: ["owner", "apprentice"],
    },
  },
} as const
