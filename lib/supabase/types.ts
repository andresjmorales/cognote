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
          created_at?: string;
        };
        Update: {
          name?: string;
          parent_contact?: string | null;
          guardian_id?: string | null;
          teacher_notes?: string;
          level?: string | null;
          birthdate?: string | null;
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
          timezone: string;
          lesson_duration_options: number[];
          cancellation_window_hours: number;
          timely_cancel_earns_makeup: boolean;
          late_cancel_earns_makeup: boolean;
          no_show_earns_makeup: boolean;
          teacher_cancel_earns_makeup: boolean;
          makeup_credit_expiry_days: number | null;
          updated_at: string;
        };
        Insert: {
          teacher_id: string;
          studio_name?: string;
          timezone?: string;
          lesson_duration_options?: number[];
          cancellation_window_hours?: number;
          timely_cancel_earns_makeup?: boolean;
          late_cancel_earns_makeup?: boolean;
          no_show_earns_makeup?: boolean;
          teacher_cancel_earns_makeup?: boolean;
          makeup_credit_expiry_days?: number | null;
        };
        Update: {
          studio_name?: string;
          timezone?: string;
          lesson_duration_options?: number[];
          cancellation_window_hours?: number;
          timely_cancel_earns_makeup?: boolean;
          late_cancel_earns_makeup?: boolean;
          no_show_earns_makeup?: boolean;
          teacher_cancel_earns_makeup?: boolean;
          makeup_credit_expiry_days?: number | null;
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
        };
        Update: {
          day_of_week?: number;
          start_time?: string;
          duration_minutes?: number;
          start_date?: string;
          end_date?: string | null;
          active?: boolean;
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
          marked_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          status: AttendanceStatus;
          notice_at?: string | null;
          marked_at?: string;
        };
        Update: {
          status?: AttendanceStatus;
          notice_at?: string | null;
          marked_at?: string;
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
          shared_with_parent: boolean;
          emailed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          body: string;
          shared_with_parent?: boolean;
          emailed_at?: string | null;
        };
        Update: {
          body?: string;
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
    };
    Enums: {
      clef_type: ClefType;
      practice_mode: PracticeMode;
    };
  };
}
