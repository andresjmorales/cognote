export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ClefType = "treble" | "bass" | "both";
export type PracticeMode = "lesson" | "free_practice" | "flashcard";
export type AttendanceStatus =
  | "attended"
  | "teacher_cancel"
  | "student_cancel"
  | "no_show";
export type EmailRecipients = "primary" | "secondary" | "both";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type PaymentMethod = "manual" | "stripe";
export type InvoiceCadence = "monthly" | "manual";
export type PaymentProvider = "manual" | "stripe";
export type RateBasis = "per_lesson" | "per_hour";
export type MusicFormat = "pdf" | "musicxml" | "mxl";
export type MusicLicenseCode =
  | "public_domain"
  | "cc0"
  | "cc_by"
  | "cc_by_sa"
  | "teacher_owned"
  | "unknown"
  | "restricted";

export interface Database {
  public: {
    Tables: {
      teachers: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string;
        };
      };
      students: {
        Row: {
          id: string;
          teacher_id: string;
          name: string;
          parent_contact: string | null;
          guardian_id: string | null;
          teacher_notes: string;
          level: string | null;
          birthdate: string | null;
          default_rate_cents: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          name: string;
          parent_contact?: string | null;
          guardian_id?: string | null;
          teacher_notes?: string;
          level?: string | null;
          birthdate?: string | null;
          default_rate_cents?: number | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          parent_contact?: string | null;
          guardian_id?: string | null;
          teacher_notes?: string;
          level?: string | null;
          birthdate?: string | null;
          default_rate_cents?: number | null;
        };
      };
      guardians: {
        Row: {
          id: string;
          teacher_id: string;
          name: string;
          family_name: string | null;
          email: string | null;
          phone: string | null;
          secondary_name: string | null;
          secondary_email: string | null;
          secondary_phone: string | null;
          email_recipients: EmailRecipients;
          portal_token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          name: string;
          family_name?: string | null;
          email?: string | null;
          phone?: string | null;
          secondary_name?: string | null;
          secondary_email?: string | null;
          secondary_phone?: string | null;
          email_recipients?: EmailRecipients;
          portal_token: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          family_name?: string | null;
          email?: string | null;
          phone?: string | null;
          secondary_name?: string | null;
          secondary_email?: string | null;
          secondary_phone?: string | null;
          email_recipients?: EmailRecipients;
          portal_token?: string;
        };
      };
      studio_policies: {
        Row: {
          teacher_id: string;
          studio_name: string;
          studio_website: string;
          studio_contact: string;
          studio_info: string;
          timezone: string;
          lesson_duration_options: number[];
          cancellation_window_hours: number;
          timely_cancel_earns_makeup: boolean;
          late_cancel_earns_makeup: boolean;
          no_show_earns_makeup: boolean;
          teacher_cancel_earns_makeup: boolean;
          makeup_credit_expiry_days: number | null;
          bill_attended: boolean;
          bill_no_show: boolean;
          bill_teacher_cancel: boolean;
          bill_timely_student_cancel: boolean;
          bill_late_student_cancel: boolean;
          bill_makeup: boolean;
          default_rate_cents: number | null;
          rate_basis: RateBasis;
          currency: string;
          invoice_cadence: InvoiceCadence;
          payment_instructions: string;
          payment_provider: PaymentProvider;
          stripe_secret_key: string | null;
          stripe_publishable_key: string | null;
          stripe_webhook_secret: string | null;
          notify_in_app: boolean;
          notify_email_portal_cancel: boolean;
          notify_email_invoice_paid: boolean;
          updated_at: string;
        };
        Insert: {
          teacher_id: string;
          studio_name?: string;
          studio_website?: string;
          studio_contact?: string;
          studio_info?: string;
          timezone?: string;
          lesson_duration_options?: number[];
          cancellation_window_hours?: number;
          timely_cancel_earns_makeup?: boolean;
          late_cancel_earns_makeup?: boolean;
          no_show_earns_makeup?: boolean;
          teacher_cancel_earns_makeup?: boolean;
          makeup_credit_expiry_days?: number | null;
          bill_attended?: boolean;
          bill_no_show?: boolean;
          bill_teacher_cancel?: boolean;
          bill_timely_student_cancel?: boolean;
          bill_late_student_cancel?: boolean;
          bill_makeup?: boolean;
          default_rate_cents?: number | null;
          rate_basis?: RateBasis;
          currency?: string;
          invoice_cadence?: InvoiceCadence;
          payment_instructions?: string;
          payment_provider?: PaymentProvider;
          stripe_secret_key?: string | null;
          stripe_publishable_key?: string | null;
          stripe_webhook_secret?: string | null;
          notify_in_app?: boolean;
          notify_email_portal_cancel?: boolean;
          notify_email_invoice_paid?: boolean;
        };
        Update: {
          studio_name?: string;
          studio_website?: string;
          studio_contact?: string;
          studio_info?: string;
          timezone?: string;
          lesson_duration_options?: number[];
          cancellation_window_hours?: number;
          timely_cancel_earns_makeup?: boolean;
          late_cancel_earns_makeup?: boolean;
          no_show_earns_makeup?: boolean;
          teacher_cancel_earns_makeup?: boolean;
          makeup_credit_expiry_days?: number | null;
          bill_attended?: boolean;
          bill_no_show?: boolean;
          bill_teacher_cancel?: boolean;
          bill_timely_student_cancel?: boolean;
          bill_late_student_cancel?: boolean;
          bill_makeup?: boolean;
          default_rate_cents?: number | null;
          rate_basis?: RateBasis;
          currency?: string;
          invoice_cadence?: InvoiceCadence;
          payment_instructions?: string;
          payment_provider?: PaymentProvider;
          stripe_secret_key?: string | null;
          stripe_publishable_key?: string | null;
          stripe_webhook_secret?: string | null;
          notify_in_app?: boolean;
          notify_email_portal_cancel?: boolean;
          notify_email_invoice_paid?: boolean;
        };
      };
      lesson_slots: {
        Row: {
          id: string;
          teacher_id: string;
          student_id: string;
          day_of_week: number;
          start_time: string;
          duration_minutes: number;
          start_date: string;
          end_date: string | null;
          active: boolean;
          rate_cents: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          student_id: string;
          day_of_week: number;
          start_time: string;
          duration_minutes?: number;
          start_date?: string;
          end_date?: string | null;
          active?: boolean;
          rate_cents?: number | null;
        };
        Update: {
          day_of_week?: number;
          start_time?: string;
          duration_minutes?: number;
          start_date?: string;
          end_date?: string | null;
          active?: boolean;
          rate_cents?: number | null;
        };
      };
      invoices: {
        Row: {
          id: string;
          teacher_id: string;
          guardian_id: string;
          period_start: string;
          period_end: string;
          status: InvoiceStatus;
          subtotal_cents: number;
          currency: string;
          sent_at: string | null;
          paid_at: string | null;
          payment_method: PaymentMethod | null;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_checkout_url: string | null;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          guardian_id: string;
          period_start: string;
          period_end: string;
          status?: InvoiceStatus;
          subtotal_cents?: number;
          currency?: string;
          sent_at?: string | null;
          paid_at?: string | null;
          payment_method?: PaymentMethod | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_url?: string | null;
          notes?: string;
        };
        Update: {
          status?: InvoiceStatus;
          subtotal_cents?: number;
          currency?: string;
          sent_at?: string | null;
          paid_at?: string | null;
          payment_method?: PaymentMethod | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_url?: string | null;
          notes?: string;
        };
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          lesson_id: string | null;
          description: string;
          quantity: number;
          unit_cents: number;
          amount_cents: number;
          sort_order: number;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          lesson_id?: string | null;
          description: string;
          quantity?: number;
          unit_cents: number;
          amount_cents: number;
          sort_order?: number;
        };
        Update: {
          lesson_id?: string | null;
          description?: string;
          quantity?: number;
          unit_cents?: number;
          amount_cents?: number;
          sort_order?: number;
        };
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          amount_cents: number;
          method: PaymentMethod;
          external_id: string | null;
          recorded_at: string;
          note: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          amount_cents: number;
          method: PaymentMethod;
          external_id?: string | null;
          recorded_at?: string;
          note?: string;
        };
        Update: {
          amount_cents?: number;
          method?: PaymentMethod;
          external_id?: string | null;
          note?: string;
        };
      };
      lessons: {
        Row: {
          id: string;
          teacher_id: string;
          student_id: string;
          slot_id: string | null;
          lesson_date: string;
          starts_at: string;
          duration_minutes: number;
          makeup_for: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          student_id: string;
          slot_id?: string | null;
          lesson_date: string;
          starts_at: string;
          duration_minutes: number;
          makeup_for?: string | null;
        };
        Update: {
          lesson_date?: string;
          starts_at?: string;
          duration_minutes?: number;
          makeup_for?: string | null;
        };
      };
      attendance: {
        Row: {
          id: string;
          lesson_id: string;
          status: AttendanceStatus;
          notice_at: string | null;
          cancel_note: string;
          marked_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          status: AttendanceStatus;
          notice_at?: string | null;
          cancel_note?: string;
          marked_at?: string;
        };
        Update: {
          status?: AttendanceStatus;
          notice_at?: string | null;
          cancel_note?: string;
          marked_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          teacher_id: string;
          type: "portal_cancel" | "invoice_paid";
          title: string;
          body: string;
          href: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          type: "portal_cancel" | "invoice_paid";
          title: string;
          body?: string;
          href?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
          title?: string;
          body?: string;
          href?: string | null;
        };
      };
      waitlist: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
        };
        Update: {
          email?: string;
        };
      };
      lesson_notes: {
        Row: {
          id: string;
          lesson_id: string;
          body: string;
          private_body: string;
          shared_with_parent: boolean;
          emailed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          body?: string;
          private_body?: string;
          shared_with_parent?: boolean;
          emailed_at?: string | null;
        };
        Update: {
          body?: string;
          private_body?: string;
          shared_with_parent?: boolean;
          emailed_at?: string | null;
        };
      };
      plans: {
        Row: {
          id: string;
          teacher_id: string;
          name: string;
          is_template: boolean;
          clef: ClefType;
          key_signature: string;
          include_sharps: boolean;
          include_flats: boolean;
          include_chords: boolean;
          measures_shown: number;
          questions_per_lesson: number;
          answer_choices: number;
          notes: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          name: string;
          is_template?: boolean;
          clef?: ClefType;
          key_signature?: string;
          include_sharps?: boolean;
          include_flats?: boolean;
          include_chords?: boolean;
          measures_shown?: number;
          questions_per_lesson?: number;
          answer_choices?: number;
          notes: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          is_template?: boolean;
          clef?: ClefType;
          key_signature?: string;
          include_sharps?: boolean;
          include_flats?: boolean;
          include_chords?: boolean;
          measures_shown?: number;
          questions_per_lesson?: number;
          answer_choices?: number;
          notes?: string[];
          updated_at?: string;
        };
      };
      student_plans: {
        Row: {
          id: string;
          student_id: string;
          plan_id: string;
          token: string;
          assigned_at: string;
          due_date: string | null;
          unassigned_at: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          plan_id: string;
          token: string;
          assigned_at?: string;
          due_date?: string | null;
          unassigned_at?: string | null;
        };
        Update: {
          due_date?: string | null;
          unassigned_at?: string | null;
          assigned_at?: string;
        };
      };
      practice_sessions: {
        Row: {
          id: string;
          student_plan_id: string;
          mode: PracticeMode;
          started_at: string;
          completed_at: string | null;
          total_correct: number;
          total_incorrect: number;
          total_questions: number;
        };
        Insert: {
          id?: string;
          student_plan_id: string;
          mode: PracticeMode;
          started_at?: string;
          completed_at?: string | null;
          total_correct?: number;
          total_incorrect?: number;
          total_questions?: number;
        };
        Update: {
          completed_at?: string | null;
          total_correct?: number;
          total_incorrect?: number;
          total_questions?: number;
        };
      };
      note_attempts: {
        Row: {
          id: string;
          session_id: string;
          note_displayed: string;
          clef: "treble" | "bass";
          correct_answer: string;
          student_answer: string;
          is_correct: boolean;
          response_time_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          note_displayed: string;
          clef: "treble" | "bass";
          correct_answer: string;
          student_answer: string;
          is_correct: boolean;
          response_time_ms?: number | null;
          created_at?: string;
        };
        Update: {};
      };
      flashcard_progress: {
        Row: {
          id: string;
          student_plan_id: string;
          note: string;
          clef: "treble" | "bass";
          ease_factor: number;
          interval_days: number;
          repetitions: number;
          next_review: string;
          last_reviewed: string | null;
        };
        Insert: {
          id?: string;
          student_plan_id: string;
          note: string;
          clef: "treble" | "bass";
          ease_factor?: number;
          interval_days?: number;
          repetitions?: number;
          next_review?: string;
          last_reviewed?: string | null;
        };
        Update: {
          ease_factor?: number;
          interval_days?: number;
          repetitions?: number;
          next_review?: string;
          last_reviewed?: string | null;
        };
      };
      music_library_items: {
        Row: {
          id: string;
          teacher_id: string;
          title: string;
          composer: string;
          arranger: string;
          format: MusicFormat;
          original_filename: string;
          storage_path: string;
          mime_type: string;
          byte_size: number;
          sha256: string;
          tags: string[];
          source: string;
          source_url: string | null;
          license_code: MusicLicenseCode;
          license_url: string | null;
          attribution: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          title: string;
          composer?: string;
          arranger?: string;
          format: MusicFormat;
          original_filename: string;
          storage_path: string;
          mime_type: string;
          byte_size: number;
          sha256: string;
          tags?: string[];
          source?: string;
          source_url?: string | null;
          license_code?: MusicLicenseCode;
          license_url?: string | null;
          attribution?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          composer?: string;
          arranger?: string;
          tags?: string[];
          source?: string;
          source_url?: string | null;
          license_code?: MusicLicenseCode;
          license_url?: string | null;
          attribution?: string;
          updated_at?: string;
        };
      };
      sheet_music_assignments: {
        Row: {
          id: string;
          music_item_id: string;
          student_id: string;
          assignment_note: string;
          due_date: string | null;
          assigned_at: string;
          unassigned_at: string | null;
          emailed_at: string | null;
        };
        Insert: {
          id?: string;
          music_item_id: string;
          student_id: string;
          assignment_note?: string;
          due_date?: string | null;
          assigned_at?: string;
          unassigned_at?: string | null;
          emailed_at?: string | null;
        };
        Update: {
          assignment_note?: string;
          due_date?: string | null;
          assigned_at?: string;
          unassigned_at?: string | null;
          emailed_at?: string | null;
        };
      };
    };
    Enums: {
      clef_type: ClefType;
      practice_mode: PracticeMode;
    };
  };
}
