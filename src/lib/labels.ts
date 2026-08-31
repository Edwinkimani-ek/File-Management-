import type {
  ClientType, DiaryEventStatus, DiaryEventType, DocumentCategory,
  FeeNoteStatus, MatterStatus, MatterVisibility, PaymentMethod,
  PracticeArea, UserRole,
} from '@/lib/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  partner: 'Partner',
  associate: 'Associate',
  clerk: 'Clerk',
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  individual: 'Individual',
  company: 'Company',
};

export const PRACTICE_AREA_LABELS: Record<PracticeArea, string> = {
  civil_litigation: 'Civil litigation',
  criminal: 'Criminal',
  conveyancing: 'Conveyancing',
  family: 'Family',
  employment: 'Employment',
  commercial: 'Commercial',
  succession: 'Succession',
  other: 'Other',
};

export const MATTER_STATUS_LABELS: Record<MatterStatus, string> = {
  active: 'Active',
  dormant: 'Dormant',
  closed: 'Closed',
};

export const VISIBILITY_LABELS: Record<MatterVisibility, string> = {
  assigned_only: 'Assigned advocate only',
  firm_wide: 'Firm-wide',
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  pleading: 'Pleading',
  correspondence: 'Correspondence',
  court_order: 'Court order',
  attendance_note: 'Attendance note',
  contract: 'Contract',
  evidence: 'Evidence',
  other: 'Other',
};

export const EVENT_TYPE_LABELS: Record<DiaryEventType, string> = {
  hearing: 'Hearing',
  mention: 'Mention',
  filing_deadline: 'Filing deadline',
  limitation_deadline: 'Limitation deadline',
  client_meeting: 'Client meeting',
  other: 'Other',
};

export const EVENT_STATUS_LABELS: Record<DiaryEventStatus, string> = {
  upcoming: 'Upcoming',
  done: 'Done',
  adjourned: 'Adjourned',
};

export const FEE_NOTE_STATUS_LABELS: Record<FeeNoteStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  sent: 'Sent',
  partially_paid: 'Partially paid',
  paid: 'Paid',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  mpesa: 'M-Pesa',
  bank: 'Bank transfer',
  cash: 'Cash',
  cheque: 'Cheque',
};

export function entries<T extends string>(record: Record<T, string>) {
  return Object.entries(record) as [T, string][];
}
