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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bodybuilding_workouts: {
        Row: {
          created_at: string
          difficulty: string
          focus_area: string
          id: string
          notes: string | null
          title: string
          updated_at: string
          workout_content: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          focus_area: string
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
          workout_content: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          focus_area?: string
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          workout_content?: string
        }
        Relationships: []
      }
      challenge_checkpoints: {
        Row: {
          challenge_id: string
          checked_at: string | null
          checkpoint_number: number
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          checked_at?: string | null
          checkpoint_number: number
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          checked_at?: string | null
          checkpoint_number?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      course_invitations: {
        Row: {
          course_id: string
          created_at: string
          id: string
          message: string | null
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          message?: string | null
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          message?: string | null
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_invitations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_registrations: {
        Row: {
          course_id: string
          id: string
          registered_at: string
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          id?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          id?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_registrations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_templates: {
        Row: {
          cancellation_deadline_minutes: number | null
          color: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          instructor: string | null
          max_participants: number | null
          price: number | null
          registration_deadline_minutes: number | null
          title: string
          trainer: string | null
          updated_at: string
        }
        Insert: {
          cancellation_deadline_minutes?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          instructor?: string | null
          max_participants?: number | null
          price?: number | null
          registration_deadline_minutes?: number | null
          title: string
          trainer?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_deadline_minutes?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          instructor?: string | null
          max_participants?: number | null
          price?: number | null
          registration_deadline_minutes?: number | null
          title?: string
          trainer?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          cancellation_deadline_minutes: number | null
          color: string | null
          course_date: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          end_time: string
          id: string
          instructor: string | null
          is_cancelled: boolean
          max_participants: number
          price: number | null
          registration_deadline_minutes: number | null
          start_time: string
          status: Database["public"]["Enums"]["course_status"]
          strength_exercise: string | null
          template_id: string | null
          title: string
          trainer: string | null
          updated_at: string
          wod_content: string | null
        }
        Insert: {
          cancellation_deadline_minutes?: number | null
          color?: string | null
          course_date?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time: string
          id?: string
          instructor?: string | null
          is_cancelled?: boolean
          max_participants?: number
          price?: number | null
          registration_deadline_minutes?: number | null
          start_time: string
          status?: Database["public"]["Enums"]["course_status"]
          strength_exercise?: string | null
          template_id?: string | null
          title: string
          trainer?: string | null
          updated_at?: string
          wod_content?: string | null
        }
        Update: {
          cancellation_deadline_minutes?: number | null
          color?: string | null
          course_date?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string
          id?: string
          instructor?: string | null
          is_cancelled?: boolean
          max_participants?: number
          price?: number | null
          registration_deadline_minutes?: number | null
          start_time?: string
          status?: Database["public"]["Enums"]["course_status"]
          strength_exercise?: string | null
          template_id?: string | null
          title?: string
          trainer?: string | null
          updated_at?: string
          wod_content?: string | null
        }
        Relationships: []
      }
      crossfit_workouts: {
        Row: {
          author_nickname: string | null
          created_at: string
          id: string
          notes: string | null
          required_exercises: string[]
          scaling_beginner: string | null
          scaling_rx: string | null
          scaling_scaled: string | null
          title: string
          updated_at: string
          workout_content: string
          workout_type: string
        }
        Insert: {
          author_nickname?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          required_exercises?: string[]
          scaling_beginner?: string | null
          scaling_rx?: string | null
          scaling_scaled?: string | null
          title: string
          updated_at?: string
          workout_content: string
          workout_type: string
        }
        Update: {
          author_nickname?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          required_exercises?: string[]
          scaling_beginner?: string | null
          scaling_rx?: string | null
          scaling_scaled?: string | null
          title?: string
          updated_at?: string
          workout_content?: string
          workout_type?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          id: string
          subject: string
          title: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          subject: string
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          subject?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gym_settings: {
        Row: {
          address: string | null
          app_icon_url: string | null
          contact_email: string | null
          created_at: string
          gym_name: string
          id: string
          logo_dark_url: string | null
          logo_light_url: string | null
          primary_color: string
          show_bodybuilding_workouts: boolean
          show_functional_fitness_workouts: boolean
          stripe_webhook_endpoint: string | null
          theme_mode: string
          updated_at: string
          webhook_email_url: string | null
          webhook_invitation_url: string | null
          webhook_member_url: string | null
          webhook_news_url: string | null
          webhook_reactivation_url: string | null
          webhook_waitlist_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          app_icon_url?: string | null
          contact_email?: string | null
          created_at?: string
          gym_name?: string
          id?: string
          logo_dark_url?: string | null
          logo_light_url?: string | null
          primary_color?: string
          show_bodybuilding_workouts?: boolean
          show_functional_fitness_workouts?: boolean
          stripe_webhook_endpoint?: string | null
          theme_mode?: string
          updated_at?: string
          webhook_email_url?: string | null
          webhook_invitation_url?: string | null
          webhook_member_url?: string | null
          webhook_news_url?: string | null
          webhook_reactivation_url?: string | null
          webhook_waitlist_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          app_icon_url?: string | null
          contact_email?: string | null
          created_at?: string
          gym_name?: string
          id?: string
          logo_dark_url?: string | null
          logo_light_url?: string | null
          primary_color?: string
          show_bodybuilding_workouts?: boolean
          show_functional_fitness_workouts?: boolean
          stripe_webhook_endpoint?: string | null
          theme_mode?: string
          updated_at?: string
          webhook_email_url?: string | null
          webhook_invitation_url?: string | null
          webhook_member_url?: string | null
          webhook_news_url?: string | null
          webhook_reactivation_url?: string | null
          webhook_waitlist_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      inactive_member_details: {
        Row: {
          cancellations: number | null
          category: string
          created_at: string | null
          days_since_last_activity: number
          display_name: string | null
          first_name: string | null
          id: string
          last_activity_date: string | null
          last_name: string | null
          membership_type: string | null
          snapshot_date: string
          total_bookings: number | null
          total_training_sessions: number | null
          user_id: string
        }
        Insert: {
          cancellations?: number | null
          category: string
          created_at?: string | null
          days_since_last_activity: number
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_activity_date?: string | null
          last_name?: string | null
          membership_type?: string | null
          snapshot_date: string
          total_bookings?: number | null
          total_training_sessions?: number | null
          user_id: string
        }
        Update: {
          cancellations?: number | null
          category?: string
          created_at?: string | null
          days_since_last_activity?: number
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_activity_date?: string | null
          last_name?: string | null
          membership_type?: string | null
          snapshot_date?: string
          total_bookings?: number | null
          total_training_sessions?: number | null
          user_id?: string
        }
        Relationships: []
      }
      inactive_member_snapshots: {
        Row: {
          active_under_10_count: number
          active_under_10_percentage: number | null
          created_at: string | null
          days_10_15_count: number
          days_10_15_percentage: number | null
          days_15_21_count: number
          days_15_21_percentage: number | null
          days_21_plus_count: number
          days_21_plus_percentage: number | null
          id: string
          snapshot_date: string
          total_previously_active: number
        }
        Insert: {
          active_under_10_count?: number
          active_under_10_percentage?: number | null
          created_at?: string | null
          days_10_15_count?: number
          days_10_15_percentage?: number | null
          days_15_21_count?: number
          days_15_21_percentage?: number | null
          days_21_plus_count?: number
          days_21_plus_percentage?: number | null
          id?: string
          snapshot_date: string
          total_previously_active?: number
        }
        Update: {
          active_under_10_count?: number
          active_under_10_percentage?: number | null
          created_at?: string | null
          days_10_15_count?: number
          days_10_15_percentage?: number | null
          days_15_21_count?: number
          days_15_21_percentage?: number | null
          days_21_plus_count?: number
          days_21_plus_percentage?: number | null
          id?: string
          snapshot_date?: string
          total_previously_active?: number
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          challenge_bonus_points: number | null
          created_at: string
          id: string
          month: number
          training_count: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          challenge_bonus_points?: number | null
          created_at?: string
          id?: string
          month: number
          training_count?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          challenge_bonus_points?: number | null
          created_at?: string
          id?: string
          month?: number
          training_count?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      member_favorites: {
        Row: {
          created_at: string
          favorite_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      membership_plans_v2: {
        Row: {
          auto_renewal: boolean | null
          booking_rules: Json
          cancellation_allowed: boolean | null
          cancellation_deadline_days: number | null
          color: string | null
          created_at: string
          description: string | null
          duration_months: number
          id: string
          includes_open_gym: boolean | null
          is_active: boolean | null
          is_public: boolean | null
          name: string
          payment_frequency: string
          payment_type: string | null
          price_monthly: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
          upgrade_priority: number | null
        }
        Insert: {
          auto_renewal?: boolean | null
          booking_rules?: Json
          cancellation_allowed?: boolean | null
          cancellation_deadline_days?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          includes_open_gym?: boolean | null
          is_active?: boolean | null
          is_public?: boolean | null
          name: string
          payment_frequency?: string
          payment_type?: string | null
          price_monthly?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
          upgrade_priority?: number | null
        }
        Update: {
          auto_renewal?: boolean | null
          booking_rules?: Json
          cancellation_allowed?: boolean | null
          cancellation_deadline_days?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          includes_open_gym?: boolean | null
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string
          payment_frequency?: string
          payment_type?: string | null
          price_monthly?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
          upgrade_priority?: number | null
        }
        Relationships: []
      }
      monthly_challenges: {
        Row: {
          bonus_points: number | null
          checkpoint_count: number | null
          created_at: string | null
          created_by: string
          description: string
          icon: string | null
          id: string
          is_archived: boolean | null
          is_primary: boolean | null
          is_recurring: boolean | null
          month: number
          title: string
          updated_at: string | null
          year: number
        }
        Insert: {
          bonus_points?: number | null
          checkpoint_count?: number | null
          created_at?: string | null
          created_by: string
          description: string
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_primary?: boolean | null
          is_recurring?: boolean | null
          month: number
          title: string
          updated_at?: string | null
          year: number
        }
        Update: {
          bonus_points?: number | null
          checkpoint_count?: number | null
          created_at?: string | null
          created_by?: string
          description?: string
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_primary?: boolean | null
          is_recurring?: boolean | null
          month?: number
          title?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      never_active_member_details: {
        Row: {
          category: string
          created_at: string | null
          days_since_signup: number
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          membership_type: string | null
          signup_date: string | null
          snapshot_date: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          days_since_signup: number
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          membership_type?: string | null
          signup_date?: string | null
          snapshot_date: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          days_since_signup?: number
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          membership_type?: string | null
          signup_date?: string | null
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      never_active_snapshots: {
        Row: {
          created_at: string | null
          days_0_7_count: number
          days_0_7_percentage: number | null
          days_15_21_count: number
          days_15_21_percentage: number | null
          days_21_plus_count: number
          days_21_plus_percentage: number | null
          days_8_14_count: number
          days_8_14_percentage: number | null
          id: string
          snapshot_date: string
          total_never_active: number
        }
        Insert: {
          created_at?: string | null
          days_0_7_count?: number
          days_0_7_percentage?: number | null
          days_15_21_count?: number
          days_15_21_percentage?: number | null
          days_21_plus_count?: number
          days_21_plus_percentage?: number | null
          days_8_14_count?: number
          days_8_14_percentage?: number | null
          id?: string
          snapshot_date: string
          total_never_active?: number
        }
        Update: {
          created_at?: string | null
          days_0_7_count?: number
          days_0_7_percentage?: number | null
          days_15_21_count?: number
          days_15_21_percentage?: number | null
          days_21_plus_count?: number
          days_21_plus_percentage?: number | null
          days_8_14_count?: number
          days_8_14_percentage?: number | null
          id?: string
          snapshot_date?: string
          total_never_active?: number
        }
        Relationships: []
      }
      news: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          email_sent_at: string | null
          id: string
          is_published: boolean | null
          link_url: string | null
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          email_sent_at?: string | null
          id?: string
          is_published?: boolean | null
          link_url?: string | null
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          email_sent_at?: string | null
          id?: string
          is_published?: boolean | null
          link_url?: string | null
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      processed_stripe_events: {
        Row: {
          created_at: string | null
          event_id: string
          event_type: string
          id: string
          metadata: Json | null
          processed_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_code: string | null
          authors: boolean
          avatar_url: string | null
          back_squat_1rm: number | null
          bench_press_1rm: number | null
          clean_1rm: number | null
          clean_and_jerk_1rm: number | null
          created_at: string
          deadlift_1rm: number | null
          display_name: string | null
          extra_lifts: Json | null
          first_name: string | null
          front_squat_1rm: number | null
          id: string
          jerk_1rm: number | null
          last_login_at: string | null
          last_name: string | null
          leaderboard_visible: boolean
          membership_type: string | null
          nickname: string | null
          preferred_exercises: Json | null
          reactivation_webhook_sent_at: string | null
          snatch_1rm: number | null
          status: string | null
          updated_at: string
          user_id: string
          welcome_dialog_shown: boolean | null
        }
        Insert: {
          access_code?: string | null
          authors?: boolean
          avatar_url?: string | null
          back_squat_1rm?: number | null
          bench_press_1rm?: number | null
          clean_1rm?: number | null
          clean_and_jerk_1rm?: number | null
          created_at?: string
          deadlift_1rm?: number | null
          display_name?: string | null
          extra_lifts?: Json | null
          first_name?: string | null
          front_squat_1rm?: number | null
          id?: string
          jerk_1rm?: number | null
          last_login_at?: string | null
          last_name?: string | null
          leaderboard_visible?: boolean
          membership_type?: string | null
          nickname?: string | null
          preferred_exercises?: Json | null
          reactivation_webhook_sent_at?: string | null
          snatch_1rm?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
          welcome_dialog_shown?: boolean | null
        }
        Update: {
          access_code?: string | null
          authors?: boolean
          avatar_url?: string | null
          back_squat_1rm?: number | null
          bench_press_1rm?: number | null
          clean_1rm?: number | null
          clean_and_jerk_1rm?: number | null
          created_at?: string
          deadlift_1rm?: number | null
          display_name?: string | null
          extra_lifts?: Json | null
          first_name?: string | null
          front_squat_1rm?: number | null
          id?: string
          jerk_1rm?: number | null
          last_login_at?: string | null
          last_name?: string | null
          leaderboard_visible?: boolean
          membership_type?: string | null
          nickname?: string | null
          preferred_exercises?: Json | null
          reactivation_webhook_sent_at?: string | null
          snatch_1rm?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
          welcome_dialog_shown?: boolean | null
        }
        Relationships: []
      }
      purchase_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          item_id: string
          item_name: string
          item_type: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          item_id: string
          item_name: string
          item_type: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          item_id?: string
          item_name?: string
          item_type?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reactivation_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          profile_data: Json
          success: boolean | null
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          profile_data: Json
          success?: boolean | null
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          profile_data?: Json
          success?: boolean | null
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      shop_product_images: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          stock_quantity: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price: number
          stock_quantity?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          stock_quantity?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number | null
          feedback: string | null
          id: string
          notes: string | null
          plan_id: string | null
          session_date: string
          session_type: string | null
          status: string | null
          user_id: string
          workout_data: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          notes?: string | null
          plan_id?: string | null
          session_date: string
          session_type?: string | null
          status?: string | null
          user_id: string
          workout_data?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          notes?: string | null
          plan_id?: string | null
          session_date?: string
          session_type?: string | null
          status?: string | null
          user_id?: string
          workout_data?: Json | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          challenge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string | null
          completed_checkpoints: number | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          completed_checkpoints?: number | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          completed_checkpoints?: number | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_challenge_progress_challenge_id"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "monthly_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memberships_v2: {
        Row: {
          auto_renewal: boolean
          created_at: string
          end_date: string | null
          id: string
          membership_data: Json
          membership_plan_id: string
          start_date: string
          status: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renewal?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          membership_data?: Json
          membership_plan_id: string
          start_date: string
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renewal?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          membership_data?: Json
          membership_plan_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memberships_v2_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      user_read_news: {
        Row: {
          id: string
          news_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          news_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          news_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_read_news_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
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
      waitlist_promotion_events: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          notified_at: string | null
          payload: Json | null
          registration_id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          notified_at?: string | null
          payload?: Json | null
          registration_id: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          notified_at?: string | null
          payload?: Json | null
          registration_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_old_challenges: { Args: never; Returns: undefined }
      auto_complete_finished_courses_today: { Args: never; Returns: undefined }
      auto_complete_past_courses: { Args: never; Returns: undefined }
      can_user_register_for_course: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: boolean
      }
      can_user_register_for_course_enhanced: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: Json
      }
      can_user_register_for_course_v2: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_old_waitlist_events: { Args: never; Returns: undefined }
      generate_courses_from_template: {
        Args: {
          end_date_param: string
          start_date_param: string
          template_id_param: string
        }
        Returns: undefined
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_member_emails_for_admin: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_weekly_registrations_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      handle_course_registration_credits:
        | { Args: { p_course_id: string; p_user_id: string }; Returns: Json }
        | {
            Args: { p_action?: string; p_course_id: string; p_user_id: string }
            Returns: Json
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_author: { Args: { _user_id: string }; Returns: boolean }
      mark_user_as_active: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      process_course_waitlist: {
        Args: { course_id_param: string }
        Returns: undefined
      }
      promote_from_waitlist: {
        Args: { course_id_param: string }
        Returns: undefined
      }
      renew_limited_credits: { Args: never; Returns: undefined }
      renew_membership_credits: { Args: never; Returns: undefined }
      sync_user_login_status: { Args: never; Returns: undefined }
      update_leaderboard_entry: {
        Args: { p_session_date: string; p_user_id: string }
        Returns: undefined
      }
      update_leaderboard_with_challenges: {
        Args: { p_session_date: string; p_user_id: string }
        Returns: undefined
      }
      update_member_status: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "member"
        | "trainer"
        | "open_gym"
        | "basic_member"
        | "premium_member"
      booking_type:
        | "unlimited"
        | "weekly_limit"
        | "monthly_limit"
        | "open_gym_only"
        | "credits"
      course_status: "active" | "cancelled" | "completed"
      membership_status:
        | "active"
        | "expired"
        | "cancelled"
        | "paused"
        | "pending_activation"
        | "payment_failed"
        | "superseded"
        | "upgraded"
      membership_type: "unlimited" | "limited"
      period_type: "week" | "month"
      registration_status: "registered" | "waitlist" | "cancelled"
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
      app_role: [
        "admin",
        "member",
        "trainer",
        "open_gym",
        "basic_member",
        "premium_member",
      ],
      booking_type: [
        "unlimited",
        "weekly_limit",
        "monthly_limit",
        "open_gym_only",
        "credits",
      ],
      course_status: ["active", "cancelled", "completed"],
      membership_status: [
        "active",
        "expired",
        "cancelled",
        "paused",
        "pending_activation",
        "payment_failed",
        "superseded",
        "upgraded",
      ],
      membership_type: ["unlimited", "limited"],
      period_type: ["week", "month"],
      registration_status: ["registered", "waitlist", "cancelled"],
    },
  },
} as const
