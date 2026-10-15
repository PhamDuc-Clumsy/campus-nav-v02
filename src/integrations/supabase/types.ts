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
      buildings: {
        Row: {
          category: string
          created_at: string
          description: string
          floors: number | null
          id: string
          image_url: string | null
          name: string
          vi: string
          x: number
          y: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          floors?: number | null
          id: string
          image_url?: string | null
          name: string
          vi: string
          x: number
          y: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          floors?: number | null
          id?: string
          image_url?: string | null
          name?: string
          vi?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      floor_plans: {
        Row: {
          building_id: string
          created_at: string
          floor: number
          id: string
          image_url: string
        }
        Insert: {
          building_id: string
          created_at?: string
          floor: number
          id?: string
          image_url: string
        }
        Update: {
          building_id?: string
          created_at?: string
          floor?: number
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      map_settings: {
        Row: {
          canvas_height: number
          canvas_width: number
          id: number
          image_path: string | null
          offset_x: number
          offset_y: number
          opacity: number
          scale: number
          updated_at: string
        }
        Insert: {
          canvas_height?: number
          canvas_width?: number
          id?: number
          image_path?: string | null
          offset_x?: number
          offset_y?: number
          opacity?: number
          scale?: number
          updated_at?: string
        }
        Update: {
          canvas_height?: number
          canvas_width?: number
          id?: number
          image_path?: string | null
          offset_x?: number
          offset_y?: number
          opacity?: number
          scale?: number
          updated_at?: string
        }
        Relationships: []
      }
      path_segments: {
        Row: {
          a: string
          b: string
          created_at: string
          distance: number | null
          flags: string[]
          id: string
        }
        Insert: {
          a: string
          b: string
          created_at?: string
          distance?: number | null
          flags?: string[]
          id?: string
        }
        Update: {
          a?: string
          b?: string
          created_at?: string
          distance?: number | null
          flags?: string[]
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "path_segments_a_fkey"
            columns: ["a"]
            isOneToOne: false
            referencedRelation: "waypoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_segments_b_fkey"
            columns: ["b"]
            isOneToOne: false
            referencedRelation: "waypoints"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          building_id: string
          code: string | null
          created_at: string
          floor: number
          id: string
          kind: string
          name: string
        }
        Insert: {
          building_id: string
          code?: string | null
          created_at?: string
          floor?: number
          id?: string
          kind?: string
          name: string
        }
        Update: {
          building_id?: string
          code?: string | null
          created_at?: string
          floor?: number
          id?: string
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waypoints: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          id: string
          kind?: string
          label?: string | null
          x: number
          y: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          x?: number
          y?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
