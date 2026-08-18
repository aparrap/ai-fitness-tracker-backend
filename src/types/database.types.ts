export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      fitness_profiles: {
        Row: {
          id: string;
          auth_user_id: string | null;
          display_name: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          display_name?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          display_name?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      body_measurements: {
        Row: {
          id: string;
          profile_id: string;
          measured_on: string;
          measured_at: string | null;
          date_precision: string;
          weight_kg: number | null;
          height_cm: number | null;
          body_fat_percent: number | null;
          source_provider: string;
          source_record_id: string;
          ingested_via: string;
          notes: string | null;
          raw_payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          measured_on: string;
          measured_at?: string | null;
          date_precision?: string;
          weight_kg?: number | null;
          height_cm?: number | null;
          body_fat_percent?: number | null;
          source_provider?: string;
          source_record_id: string;
          ingested_via?: string;
          notes?: string | null;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Update: {
          measured_on?: string;
          measured_at?: string | null;
          date_precision?: string;
          weight_kg?: number | null;
          height_cm?: number | null;
          body_fat_percent?: number | null;
          source_provider?: string;
          source_record_id?: string;
          ingested_via?: string;
          notes?: string | null;
          raw_payload?: Json | null;
        };
        Relationships: [];
      };
      workouts: {
        Row: {
          id: string;
          profile_id: string;
          activity_type: string;
          started_on: string;
          started_at: string | null;
          date_precision: string;
          title: string | null;
          duration_seconds: number | null;
          moving_duration_seconds: number | null;
          distance_m: number | null;
          active_energy_kcal: number | null;
          avg_heart_rate_bpm: number | null;
          max_heart_rate_bpm: number | null;
          avg_pace_seconds_per_km: number | null;
          elevation_gain_m: number | null;
          source_provider: string;
          source_record_id: string;
          ingested_via: string;
          notes: string | null;
          raw_payload: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          activity_type: string;
          started_on: string;
          started_at?: string | null;
          date_precision?: string;
          title?: string | null;
          duration_seconds?: number | null;
          moving_duration_seconds?: number | null;
          distance_m?: number | null;
          active_energy_kcal?: number | null;
          avg_heart_rate_bpm?: number | null;
          max_heart_rate_bpm?: number | null;
          avg_pace_seconds_per_km?: number | null;
          elevation_gain_m?: number | null;
          source_provider: string;
          source_record_id: string;
          ingested_via: string;
          notes?: string | null;
          raw_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          activity_type?: string;
          started_on?: string;
          started_at?: string | null;
          date_precision?: string;
          title?: string | null;
          duration_seconds?: number | null;
          moving_duration_seconds?: number | null;
          distance_m?: number | null;
          active_energy_kcal?: number | null;
          avg_heart_rate_bpm?: number | null;
          max_heart_rate_bpm?: number | null;
          avg_pace_seconds_per_km?: number | null;
          elevation_gain_m?: number | null;
          source_provider?: string;
          source_record_id?: string;
          ingested_via?: string;
          notes?: string | null;
          raw_payload?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_metric_samples: {
        Row: {
          id: number;
          workout_id: string;
          metric_name: string;
          sampled_at: string | null;
          sample_ended_at: string | null;
          elapsed_seconds: number | null;
          value: number;
          unit: string;
          source_provider: string;
          source_record_id: string;
          association_kind: string | null;
          source_name: string | null;
          source_bundle_identifier: string | null;
          raw_payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          workout_id: string;
          metric_name: string;
          sampled_at?: string | null;
          sample_ended_at?: string | null;
          elapsed_seconds?: number | null;
          value: number;
          unit: string;
          source_provider: string;
          source_record_id: string;
          association_kind?: string | null;
          source_name?: string | null;
          source_bundle_identifier?: string | null;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Update: {
          metric_name?: string;
          sampled_at?: string | null;
          sample_ended_at?: string | null;
          elapsed_seconds?: number | null;
          value?: number;
          unit?: string;
          source_provider?: string;
          source_record_id?: string;
          association_kind?: string | null;
          source_name?: string | null;
          source_bundle_identifier?: string | null;
          raw_payload?: Json | null;
        };
        Relationships: [];
      };
      workout_splits: {
        Row: {
          id: number;
          workout_id: string;
          split_kind: string;
          split_number: number;
          started_at: string | null;
          ended_at: string | null;
          start_distance_m: number | null;
          end_distance_m: number | null;
          distance_m: number;
          duration_seconds: number;
          avg_pace_seconds_per_km: number | null;
          avg_heart_rate_bpm: number | null;
          max_heart_rate_bpm: number | null;
          heart_rate_change_bpm: number | null;
          source: string;
          algorithm_version: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: never;
          workout_id: string;
          split_kind?: string;
          split_number: number;
          started_at?: string | null;
          ended_at?: string | null;
          start_distance_m?: number | null;
          end_distance_m?: number | null;
          distance_m: number;
          duration_seconds: number;
          avg_pace_seconds_per_km?: number | null;
          avg_heart_rate_bpm?: number | null;
          max_heart_rate_bpm?: number | null;
          heart_rate_change_bpm?: number | null;
          source?: string;
          algorithm_version?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          split_kind?: string;
          split_number?: number;
          started_at?: string | null;
          ended_at?: string | null;
          start_distance_m?: number | null;
          end_distance_m?: number | null;
          distance_m?: number;
          duration_seconds?: number;
          avg_pace_seconds_per_km?: number | null;
          avg_heart_rate_bpm?: number | null;
          max_heart_rate_bpm?: number | null;
          heart_rate_change_bpm?: number | null;
          source?: string;
          algorithm_version?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_analysis_snapshots: {
        Row: {
          workout_id: string;
          analysis: Json;
          algorithm_version: string;
          computed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workout_id: string;
          analysis: Json;
          algorithm_version?: string;
          computed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          analysis?: Json;
          algorithm_version?: string;
          computed_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_source_links: {
        Row: {
          id: string;
          profile_id: string;
          workout_id: string;
          source_provider: string;
          source_record_id: string;
          raw_payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          workout_id: string;
          source_provider: string;
          source_record_id: string;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          workout_id?: string;
          source_provider?: string;
          source_record_id?: string;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      data_syncs: {
        Row: {
          id: string;
          profile_id: string;
          provider: string;
          client_sync_id: string;
          status: string;
          weights_processed: number;
          workouts_processed: number;
          workouts_matched: number;
          metric_samples_processed: number;
          device_metadata: Json | null;
          error_message: string | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          provider: string;
          client_sync_id: string;
          status: string;
          weights_processed?: number;
          workouts_processed?: number;
          workouts_matched?: number;
          metric_samples_processed?: number;
          device_metadata?: Json | null;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          provider?: string;
          client_sync_id?: string;
          status?: string;
          weights_processed?: number;
          workouts_processed?: number;
          workouts_matched?: number;
          metric_samples_processed?: number;
          device_metadata?: Json | null;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_analyses: {
        Row: {
          id: string;
          profile_id: string;
          workout_id: string | null;
          analysis_type: string;
          period_start: string | null;
          period_end: string | null;
          model: string | null;
          prompt_version: string | null;
          summary: string | null;
          result: Json;
          input_snapshot: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          workout_id?: string | null;
          analysis_type: string;
          period_start?: string | null;
          period_end?: string | null;
          model?: string | null;
          prompt_version?: string | null;
          summary?: string | null;
          result?: Json;
          input_snapshot?: Json | null;
          created_at?: string;
        };
        Update: {
          workout_id?: string | null;
          analysis_type?: string;
          period_start?: string | null;
          period_end?: string | null;
          model?: string | null;
          prompt_version?: string | null;
          summary?: string | null;
          result?: Json;
          input_snapshot?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      replace_workout_kilometre_splits: {
        Args: {
          p_workout_id: string;
          p_splits: Json;
        };
        Returns: Database['public']['Tables']['workout_splits']['Row'][];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
