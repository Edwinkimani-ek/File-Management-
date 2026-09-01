export type UserRole = 'partner' | 'associate' | 'clerk';
export type UserStatus = 'active' | 'disabled';
export type ClientType = 'individual' | 'company';
export type PracticeArea =
  | 'civil_litigation' | 'criminal' | 'conveyancing' | 'family'
  | 'employment' | 'commercial' | 'succession' | 'other';
export type MatterStatus = 'active' | 'dormant' | 'closed';
export type MatterVisibility = 'assigned_only' | 'firm_wide';
export type DocumentCategory =
  | 'pleading' | 'correspondence' | 'court_order' | 'attendance_note'
  | 'contract' | 'evidence' | 'other';
export type DiaryEventType =
  | 'hearing' | 'mention' | 'filing_deadline' | 'limitation_deadline'
  | 'client_meeting' | 'other';
export type DiaryEventStatus = 'upcoming' | 'done' | 'adjourned';
export type FeeNoteStatus = 'draft' | 'approved' | 'sent' | 'paid' | 'partially_paid';
export type PaymentMethod = 'mpesa' | 'bank' | 'cash' | 'cheque';

export interface Firm {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  default_limitation_years: number;
  vat_rate_bp: number;
  created_at: string;
}

export interface AppUser {
  id: string;
  firm_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface Client {
  id: string;
  firm_id: string;
  type: ClientType;
  full_name: string;
  id_number: string | null;
  kra_pin: string | null;
  phone: string | null;
  email: string | null;
  physical_address: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Matter {
  id: string;
  firm_id: string;
  file_reference: string;
  client_id: string;
  title: string;
  practice_area: PracticeArea;
  court_station: string | null;
  court_case_number: string | null;
  opposing_party: string | null;
  opposing_advocates: string | null;
  status: MatterStatus;
  assigned_to: string | null;
  visibility: MatterVisibility;
  date_opened: string;
  date_closed: string | null;
  closing_note: string | null;
  description: string | null;
  cause_of_action_date: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface MatterDocument {
  id: string;
  firm_id: string;
  matter_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: DocumentCategory;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
  deleted_at: string | null;
}

export interface DiaryEvent {
  id: string;
  firm_id: string;
  matter_id: string | null;
  title: string;
  event_type: DiaryEventType;
  event_date: string;
  event_time: string | null;
  court_station: string | null;
  assigned_to: string | null;
  reminder_days_before: number[];
  status: DiaryEventStatus;
  outcome_notes: string | null;
  rescheduled_to: string | null;
  rescheduled_from: string | null;
  created_at: string;
}

export interface FeeNoteLineItem {
  description: string;
  /** KES cents. */
  amount: number;
}

export interface FeeNote {
  id: string;
  firm_id: string;
  matter_id: string;
  client_id: string;
  fee_note_number: string | null;
  line_items: FeeNoteLineItem[];
  subtotal: number;
  vat_applicable: boolean;
  vat_amount: number;
  total: number;
  status: FeeNoteStatus;
  amount_paid: number;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  firm_id: string;
  fee_note_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  payment_date: string;
  recorded_by: string | null;
  created_at: string;
}

export interface TemplatePlaceholder {
  token: string;
  label: string;
}

export interface Template {
  id: string;
  firm_id: string;
  name: string;
  description: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  placeholders: TemplatePlaceholder[];
  is_starter: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ActivityEntry {
  id: string;
  firm_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  matter_id: string | null;
  detail: string | null;
  created_at: string;
}
