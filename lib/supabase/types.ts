export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ClefType = "treble" | "bass" | "both";
export type PracticeMode = "lesson" | "free_practice" | "flashcard";

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
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          name: string;
          parent_contact?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          parent_contact?: string | null;
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
        };
        Insert: {
          id?: string;
          student_id: string;
          plan_id: string;
          token: string;
          assigned_at?: string;
          due_date?: string | null;
        };
        Update: {
          due_date?: string | null;
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
