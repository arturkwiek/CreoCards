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
      mix_items: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          grams: number
          id: string
          mix_id: string
          position: number
          product_id: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          grams: number
          id?: string
          mix_id: string
          position?: number
          product_id: string
          salon_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          grams?: number
          id?: string
          mix_id?: string
          position?: number
          product_id?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mix_items_mix_id_salon_id_fkey"
            columns: ["mix_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "recipe_mixes"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "mix_items_product_id_salon_id_fkey"
            columns: ["product_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "mix_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
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
      recipe_mixes: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          oxidant_grams: number
          oxidant_percent: number | null
          oxidant_product_id: string | null
          position: number
          processing_minutes: number | null
          ratio: number | null
          recipe_id: string
          salon_id: string
          updated_at: string
          zone: Database["public"]["Enums"]["mix_zone"]
        }
        Insert: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          oxidant_grams?: number
          oxidant_percent?: number | null
          oxidant_product_id?: string | null
          position?: number
          processing_minutes?: number | null
          ratio?: number | null
          recipe_id: string
          salon_id?: string
          updated_at?: string
          zone?: Database["public"]["Enums"]["mix_zone"]
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          oxidant_grams?: number
          oxidant_percent?: number | null
          oxidant_product_id?: string | null
          position?: number
          processing_minutes?: number | null
          ratio?: number | null
          recipe_id?: string
          salon_id?: string
          updated_at?: string
          zone?: Database["public"]["Enums"]["mix_zone"]
        }
        Relationships: [
          {
            foreignKeyName: "recipe_mixes_oxidant_product_id_salon_id_fkey"
            columns: ["oxidant_product_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "recipe_mixes_recipe_id_salon_id_fkey"
            columns: ["recipe_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "recipe_mixes_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          note: string
          salon_id: string
          updated_at: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          note?: string
          salon_id?: string
          updated_at?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          note?: string
          salon_id?: string
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_visit_id_salon_id_fkey"
            columns: ["visit_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id", "salon_id"]
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
      services: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          duration_min: number | null
          id: string
          name: string
          position: number
          price_from: number | null
          price_to: number | null
          salon_id: string
          updated_at: string
          with_color: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          duration_min?: number | null
          id?: string
          name: string
          position?: number
          price_from?: number | null
          price_to?: number | null
          salon_id?: string
          updated_at?: string
          with_color?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          duration_min?: number | null
          id?: string
          name?: string
          position?: number
          price_from?: number | null
          price_to?: number | null
          salon_id?: string
          updated_at?: string
          with_color?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
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
      visits: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          price: number | null
          salon_id: string
          service_id: string | null
          updated_at: string
          visit_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          price?: number | null
          salon_id?: string
          service_id?: string | null
          updated_at?: string
          visit_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          price?: number | null
          salon_id?: string
          service_id?: string | null
          updated_at?: string
          visit_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_client_id_salon_id_fkey"
            columns: ["client_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "visits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_service_id_salon_id_fkey"
            columns: ["service_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_mix: { Args: { p_mix_id: string }; Returns: boolean }
      can_edit_recipe: { Args: { p_recipe_id: string }; Returns: boolean }
      can_edit_visit: { Args: { p_visit_id: string }; Returns: boolean }
      current_salon_id: { Args: never; Returns: string }
      import_products: { Args: { items: Json }; Returns: Json }
      import_services: { Args: { items: Json }; Returns: Json }
      is_owner: { Args: never; Returns: boolean }
      product_usage: {
        Args: never
        Returns: {
          product_id: string
          uses: number
        }[]
      }
      save_recipe: {
        Args: { p_recipe: Json; p_visit_id: string }
        Returns: string
      }
    }
    Enums: {
      allergy_status: "none" | "has"
      mix_zone: "calosc" | "odrost" | "dlugosci" | "konce" | "pasemka" | "inne"
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
      mix_zone: ["calosc", "odrost", "dlugosci", "konce", "pasemka", "inne"],
      product_request_kind: ["missing", "running_low"],
      product_type: ["farba", "utleniacz", "rozjasniacz", "toner", "inny"],
      user_role: ["owner", "apprentice"],
    },
  },
} as const
