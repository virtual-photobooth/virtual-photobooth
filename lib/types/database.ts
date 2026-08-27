export type UserRole = 'owner' | 'client';
export type EventStatus = 'draft' | 'active' | 'completed' | 'inactive';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string | null;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  client_id: string;
  name: string;
  monogram?: string | null;
  subtitle?: string | null;
  slug: string;
  event_date: string;
  status: EventStatus;
  frame_path: string | null;
  cover_path?: string | null;
  photo_count: number;
  countdown_seconds: number;
  is_voice_enabled: boolean;
  voice_retention_days: number;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface Guest {
  id: string;
  event_id: string;
  name: string;
  instagram: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  event_id: string;
  guest_id: string | null;
  final_photo_path: string;
  created_at: string;
  guest?: Guest;
}

export interface VoiceMessage {
  id: string;
  event_id: string;
  guest_id: string | null;
  audio_path: string;
  duration_seconds: number | null;
  expires_at: string;
  is_deleted: boolean;
  created_at: string;
  guest?: Guest;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string };
        Update: Partial<Omit<Profile, 'id'>>;
        Relationships: [];
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<Client, 'id'>>;
        Relationships: [];
      };
      events: {
        Row: Event;
        Insert: Omit<Event, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<Event, 'id'>>;
        Relationships: [];
      };
      guests: {
        Row: Guest;
        Insert: Omit<Guest, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Guest, 'id'>>;
        Relationships: [];
      };
      photos: {
        Row: Photo;
        Insert: Omit<Photo, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Photo, 'id'>>;
        Relationships: [];
      };
      voice_messages: {
        Row: VoiceMessage;
        Insert: Omit<VoiceMessage, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<VoiceMessage, 'id'>>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_owner: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_user_client_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      event_status: EventStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
