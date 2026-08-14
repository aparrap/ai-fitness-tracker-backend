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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          analysis_type: string
          created_at: string
          id: string
          input_snapshot: Json | null
          model: string | null
          period_end: string | null
          period_start: string | null
          profile_id: string
          prompt_version: string | null
          result: Json
          summary: string | null
          workout_id: string | null
        }
        Insert: {
          analysis_type: string
          created_at?: string
          id?: string
          input_snapshot?: Json | null
          model?: string | null
          period_end?: string | null
          period_start?: string | null
          profile_id: string
          prompt_version?: string | null
          result?: Json
          summary?: string | null
          workout_id?: string | null
        }
        Update: {
          analysis_type?: string
          created_at?: string
          id?: string
          input_snapshot?: Json | null
          model?: string | null
          period_end?: string | null
          period_start?: string | null
          profile_id?: string
          prompt_version?: string | null
          result?: Json
          summary?: string | null
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "fitness_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          body_fat_percent: number | null
          created_at: string
          date_precision: string
          height_cm: number | null
          id: string
          ingested_via: string
          measured_at: string | null
          measured_on: string
          notes: string | null
          profile_id: string
          raw_payload: Json | null
          source_provider: string
          source_record_id: string
          weight_kg: number | null
        }
        Insert: {
          body_fat_percent?: number | null
          created_at?: string
          date_precision?: string
          height_cm?: number | null
          id?: string
          ingested_via?: string
          measured_at?: string | null
          measured_on: string
          notes?: string | null
          profile_id: string
          raw_payload?: Json | null
          source_provider?: string
          source_record_id: string
          weight_kg?: number | null
        }
        Update: {
          body_fat_percent?: number | null
          created_at?: string
          date_precision?: string
          height_cm?: number | null
          id?: string
          ingested_via?: string
          measured_at?: string | null
          measured_on?: string
          notes?: string | null
          profile_id?: string
          raw_payload?: Json | null
          source_provider?: string
          source_record_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "fitness_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_profiles: {
        Row: {
          auth_user_id: string | null
          created_at: string
          display_name: string | null
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      workout_metric_samples: {
        Row: {
          created_at: string
          elapsed_seconds: number | null
          id: number
          metric_name: string
          raw_payload: Json | null
          sampled_at: string | null
          source_provider: string
          unit: string
          value: number
          workout_id: string
        }
        Insert: {
          created_at?: string
          elapsed_seconds?: number | null
          id?: never
          metric_name: string
          raw_payload?: Json | null
          sampled_at?: string | null
          source_provider: string
          unit: string
          value: number
          workout_id: string
        }
        Update: {
          created_at?: string
          elapsed_seconds?: number | null
          id?: never
          metric_name?: string
          raw_payload?: Json | null
          sampled_at?: string | null
          source_provider?: string
          unit?: string
          value?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_metric_samples_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          active_energy_kcal: number | null
          activity_type: string
          avg_heart_rate_bpm: number | null
          avg_pace_seconds_per_km: number | null
          created_at: string
          date_precision: string
          distance_m: number | null
          duration_seconds: number | null
          elevation_gain_m: number | null
          id: string
          ingested_via: string
          max_heart_rate_bpm: number | null
          moving_duration_seconds: number | null
          notes: string | null
          profile_id: string
          raw_payload: Json | null
          source_provider: string
          source_record_id: string
          started_at: string | null
          started_on: string
          title: string | null
          updated_at: string
        }
        Insert: {
          active_energy_kcal?: number | null
          activity_type: string
          avg_heart_rate_bpm?: number | null
          avg_pace_seconds_per_km?: number | null
          created_at?: string
          date_precision?: string
          distance_m?: number | null
          duration_seconds?: number | null
          elevation_gain_m?: number | null
          id?: string
          ingested_via: string
          max_heart_rate_bpm?: number | null
          moving_duration_seconds?: number | null
          notes?: string | null
          profile_id: string
          raw_payload?: Json | null
          source_provider: string
          source_record_id: string
          started_at?: string | null
          started_on: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          active_energy_kcal?: number | null
          activity_type?: string
          avg_heart_rate_bpm?: number | null
          avg_pace_seconds_per_km?: number | null
          created_at?: string
          date_precision?: string
          distance_m?: number | null
          duration_seconds?: number | null
          elevation_gain_m?: number | null
          id?: string
          ingested_via?: string
          max_heart_rate_bpm?: number | null
          moving_duration_seconds?: number | null
          notes?: string | null
          profile_id?: string
          raw_payload?: Json | null
          source_provider?: string
          source_record_id?: string
          started_at?: string | null
          started_on?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "fitness_profiles"
            referencedColumns: ["id"]
          },
        ]
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
  public: {
    Enums: {},
  },
} as const
