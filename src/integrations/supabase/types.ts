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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: unknown
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: unknown
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: unknown
        }
        Relationships: []
      }
      feedback: {
        Row: {
          client_token: string | null
          created_at: string
          id: string
          notes: string | null
          owns_shoe: boolean
          predicted_score: number | null
          scan_id: string | null
          shoe_id: string
          user_id: string | null
          user_rating: number
        }
        Insert: {
          client_token?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          owns_shoe?: boolean
          predicted_score?: number | null
          scan_id?: string | null
          shoe_id: string
          user_id?: string | null
          user_rating: number
        }
        Update: {
          client_token?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          owns_shoe?: boolean
          predicted_score?: number | null
          scan_id?: string | null
          shoe_id?: string
          user_id?: string | null
          user_rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "feedback_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_shoe_id_fkey"
            columns: ["shoe_id"]
            isOneToOne: false
            referencedRelation: "shoes"
            referencedColumns: ["id"]
          },
        ]
      }
      kiri_submissions: {
        Row: {
          created_at: string
          frame_count: number | null
          id: string
          ip: unknown
          scan_id: string | null
        }
        Insert: {
          created_at?: string
          frame_count?: number | null
          id?: string
          ip?: unknown
          scan_id?: string | null
        }
        Update: {
          created_at?: string
          frame_count?: number | null
          id?: string
          ip?: unknown
          scan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiri_submissions_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_approvals: {
        Row: {
          approval_token: string
          created_at: string
          user_id: string
        }
        Insert: {
          approval_token?: string
          created_at?: string
          user_id: string
        }
        Update: {
          approval_token?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agbs_accepted_at: string | null
          approval_decided_at: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          avatar_url: string | null
          brand_id: string | null
          created_at: string | null
          id: string
          name: string | null
          newsletter_consent: boolean
          requested_at: string
          unit_pref: string | null
        }
        Insert: {
          agbs_accepted_at?: string | null
          approval_decided_at?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          brand_id?: string | null
          created_at?: string | null
          id: string
          name?: string | null
          newsletter_consent?: boolean
          requested_at?: string
          unit_pref?: string | null
        }
        Update: {
          agbs_accepted_at?: string | null
          approval_decided_at?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          brand_id?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          newsletter_consent?: boolean
          requested_at?: string
          unit_pref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string
          ref: string | null
          scan_count: number | null
          shoe_name: string | null
          shoe_slug: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          ref?: string | null
          scan_count?: number | null
          shoe_name?: string | null
          shoe_slug?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          ref?: string | null
          scan_count?: number | null
          shoe_name?: string | null
          shoe_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          arch_type: string | null
          ball_width_mm: number | null
          brand_id: string | null
          client_token: string
          completed_at: string | null
          confidence: string | null
          created_at: string | null
          eu_size: number | null
          foot_length_mm: number | null
          foot_toebox_height_mm: number | null
          foot_width_mm: number | null
          heel_width_mm: number | null
          id: string
          kiri_completed_at: string | null
          kiri_error: string | null
          kiri_frame_count: number | null
          kiri_model_url: string | null
          kiri_model_url_fetched_at: string | null
          kiri_serialize: string | null
          kiri_status: number | null
          kiri_submitted_at: string | null
          preferred_drop_mm: number | null
          qr_ref: string | null
          shoe_slug: string | null
          side_image_url: string | null
          sock_thickness_mm: number | null
          status: string | null
          top_image_url: string | null
          user_id: string | null
        }
        Insert: {
          arch_type?: string | null
          ball_width_mm?: number | null
          brand_id?: string | null
          client_token?: string
          completed_at?: string | null
          confidence?: string | null
          created_at?: string | null
          eu_size?: number | null
          foot_length_mm?: number | null
          foot_toebox_height_mm?: number | null
          foot_width_mm?: number | null
          heel_width_mm?: number | null
          id?: string
          kiri_completed_at?: string | null
          kiri_error?: string | null
          kiri_frame_count?: number | null
          kiri_model_url?: string | null
          kiri_model_url_fetched_at?: string | null
          kiri_serialize?: string | null
          kiri_status?: number | null
          kiri_submitted_at?: string | null
          preferred_drop_mm?: number | null
          qr_ref?: string | null
          shoe_slug?: string | null
          side_image_url?: string | null
          sock_thickness_mm?: number | null
          status?: string | null
          top_image_url?: string | null
          user_id?: string | null
        }
        Update: {
          arch_type?: string | null
          ball_width_mm?: number | null
          brand_id?: string | null
          client_token?: string
          completed_at?: string | null
          confidence?: string | null
          created_at?: string | null
          eu_size?: number | null
          foot_length_mm?: number | null
          foot_toebox_height_mm?: number | null
          foot_width_mm?: number | null
          heel_width_mm?: number | null
          id?: string
          kiri_completed_at?: string | null
          kiri_error?: string | null
          kiri_frame_count?: number | null
          kiri_model_url?: string | null
          kiri_model_url_fetched_at?: string | null
          kiri_serialize?: string | null
          kiri_status?: number | null
          kiri_submitted_at?: string | null
          preferred_drop_mm?: number | null
          qr_ref?: string | null
          shoe_slug?: string | null
          side_image_url?: string | null
          sock_thickness_mm?: number | null
          status?: string | null
          top_image_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shoes: {
        Row: {
          arch_support: string
          available_sizes: number[] | null
          brand_id: string | null
          brand_name: string
          brand_url: string | null
          category: string
          created_at: string | null
          data_source: string | null
          forefoot_stack_mm: number | null
          forefoot_width_mm: number | null
          gender: string
          geometry_confidence: string | null
          heel_drop_mm: number | null
          heel_stack_mm: number | null
          heel_width_mm: number | null
          id: string
          image_url: string | null
          inner_length_mm: number | null
          name: string
          outer_length_mm: number | null
          passform: string | null
          price_eur: number | null
          retour_rate_pct: number | null
          runrepeat_score: number | null
          shoe_height_mm: number | null
          shop_url: string | null
          slug: string
          sole_height_mm: number | null
          sort_order: number | null
          source_url: string | null
          subcategory: string | null
          toebox: string
          toebox_height_mm: number | null
          toebox_width_mm: number | null
          weight_g: number | null
          width_grade: string
          width_mm: number | null
        }
        Insert: {
          arch_support: string
          available_sizes?: number[] | null
          brand_id?: string | null
          brand_name: string
          brand_url?: string | null
          category: string
          created_at?: string | null
          data_source?: string | null
          forefoot_stack_mm?: number | null
          forefoot_width_mm?: number | null
          gender: string
          geometry_confidence?: string | null
          heel_drop_mm?: number | null
          heel_stack_mm?: number | null
          heel_width_mm?: number | null
          id?: string
          image_url?: string | null
          inner_length_mm?: number | null
          name: string
          outer_length_mm?: number | null
          passform?: string | null
          price_eur?: number | null
          retour_rate_pct?: number | null
          runrepeat_score?: number | null
          shoe_height_mm?: number | null
          shop_url?: string | null
          slug: string
          sole_height_mm?: number | null
          sort_order?: number | null
          source_url?: string | null
          subcategory?: string | null
          toebox: string
          toebox_height_mm?: number | null
          toebox_width_mm?: number | null
          weight_g?: number | null
          width_grade: string
          width_mm?: number | null
        }
        Update: {
          arch_support?: string
          available_sizes?: number[] | null
          brand_id?: string | null
          brand_name?: string
          brand_url?: string | null
          category?: string
          created_at?: string | null
          data_source?: string | null
          forefoot_stack_mm?: number | null
          forefoot_width_mm?: number | null
          gender?: string
          geometry_confidence?: string | null
          heel_drop_mm?: number | null
          heel_stack_mm?: number | null
          heel_width_mm?: number | null
          id?: string
          image_url?: string | null
          inner_length_mm?: number | null
          name?: string
          outer_length_mm?: number | null
          passform?: string | null
          price_eur?: number | null
          retour_rate_pct?: number | null
          runrepeat_score?: number | null
          shoe_height_mm?: number | null
          shop_url?: string | null
          slug?: string
          sole_height_mm?: number | null
          sort_order?: number | null
          source_url?: string | null
          subcategory?: string | null
          toebox?: string
          toebox_height_mm?: number | null
          toebox_width_mm?: number | null
          weight_g?: number | null
          width_grade?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shoes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
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
      user_shoe_fits: {
        Row: {
          created_at: string
          dimension: Database["public"]["Enums"]["fit_dimension"]
          id: string
          note: string | null
          rating: Database["public"]["Enums"]["fit_rating"]
          updated_at: string
          user_shoe_id: string
        }
        Insert: {
          created_at?: string
          dimension: Database["public"]["Enums"]["fit_dimension"]
          id?: string
          note?: string | null
          rating: Database["public"]["Enums"]["fit_rating"]
          updated_at?: string
          user_shoe_id: string
        }
        Update: {
          created_at?: string
          dimension?: Database["public"]["Enums"]["fit_dimension"]
          id?: string
          note?: string | null
          rating?: Database["public"]["Enums"]["fit_rating"]
          updated_at?: string
          user_shoe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shoe_fits_user_shoe_id_fkey"
            columns: ["user_shoe_id"]
            isOneToOne: false
            referencedRelation: "user_shoes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_shoes: {
        Row: {
          brand_name: string | null
          created_at: string
          id: string
          model_name: string | null
          notes: string | null
          shoe_id: string | null
          size_eu: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_name?: string | null
          created_at?: string
          id?: string
          model_name?: string | null
          notes?: string | null
          shoe_id?: string | null
          size_eu?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_name?: string | null
          created_at?: string
          id?: string
          model_name?: string | null
          notes?: string | null
          shoe_id?: string | null
          size_eu?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shoes_shoe_id_fkey"
            columns: ["shoe_id"]
            isOneToOne: false
            referencedRelation: "shoes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_scan_session: {
        Args: { p_brand_id?: string; p_shoe_slug: string }
        Returns: {
          client_token: string
          session_id: string
        }[]
      }
      get_scan_session: {
        Args: { p_client_token: string; p_session_id: string }
        Returns: {
          arch_type: string | null
          ball_width_mm: number | null
          brand_id: string | null
          client_token: string
          completed_at: string | null
          confidence: string | null
          created_at: string | null
          eu_size: number | null
          foot_length_mm: number | null
          foot_toebox_height_mm: number | null
          foot_width_mm: number | null
          heel_width_mm: number | null
          id: string
          kiri_completed_at: string | null
          kiri_error: string | null
          kiri_frame_count: number | null
          kiri_model_url: string | null
          kiri_model_url_fetched_at: string | null
          kiri_serialize: string | null
          kiri_status: number | null
          kiri_submitted_at: string | null
          preferred_drop_mm: number | null
          qr_ref: string | null
          shoe_slug: string | null
          side_image_url: string | null
          sock_thickness_mm: number | null
          status: string | null
          top_image_url: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "scans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      submit_feedback: {
        Args: {
          p_client_token: string
          p_notes: string
          p_owns_shoe: boolean
          p_predicted_score: number
          p_scan_id: string
          p_shoe_id: string
          p_user_rating: number
        }
        Returns: string
      }
      submit_scan_measurements: {
        Args: {
          p_arch_type: string
          p_ball_width_mm: number
          p_client_token: string
          p_eu_size: number
          p_foot_length_mm: number
          p_foot_toebox_height_mm?: number
          p_foot_width_mm: number
          p_heel_width_mm: number
          p_preferred_drop_mm?: number
          p_session_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "brand" | "consumer"
      approval_status: "pending" | "approved" | "rejected" | "waitlist"
      fit_dimension:
        | "length"
        | "toebox_width"
        | "forefoot_width"
        | "midfoot"
        | "heel"
        | "drop"
        | "cushion"
      fit_rating:
        | "much_too_tight"
        | "slightly_tight"
        | "perfect"
        | "slightly_loose"
        | "much_too_loose"
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
      app_role: ["admin", "brand", "consumer"],
      approval_status: ["pending", "approved", "rejected", "waitlist"],
      fit_dimension: [
        "length",
        "toebox_width",
        "forefoot_width",
        "midfoot",
        "heel",
        "drop",
        "cushion",
      ],
      fit_rating: [
        "much_too_tight",
        "slightly_tight",
        "perfect",
        "slightly_loose",
        "much_too_loose",
      ],
    },
  },
} as const
