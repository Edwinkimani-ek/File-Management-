import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { loadMatter } from '@/lib/matters';
import { formatDate } from '@/lib/dates';
import {
  PRACTICE_AREA_LABELS,
  MATTER_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  EVENT_STATUS_LABELS,
  FEE_NOTE_STATUS_LABELS,
  DOCUMENT_CATEGORY_LABELS,
} from '@/lib/labels';

function join(lines: (string | null | undefined)[]): string {
  return lines.filter(Boolean).join('\n');
}

export async function buildMatterContext(matterId: string): Promise<string> {
  const supabase = createClient();
  const matter = await loadMatter(matterId);

  const [diary, feeNotes, documents, activity] = await Promise.all([
    supabase
      .from('diary_events')
      .select('title, event_type, event_date, event_time, court_station, status')
      .eq('matter_id', matterId)
      .order('event_date', { ascending: true })
      .limit(20),
    supabase
      .from('fee_notes')
      .select('status, total, amount_paid, fee_note_number')
      .eq('matter_id', matterId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('documents')
      .select('file_name, category, uploaded_at, notes')
      .eq('matter_id', matterId)
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false })
      .limit(20),
    supabase
      .from('activity_log')
      .select('action, detail, created_at')
      .eq('matter_id', matterId)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const lines: string[] = [];
  lines.push(`## Matter: ${matter.file_reference} — ${matter.title}`);
  lines.push(`- Status: ${MATTER_STATUS_LABELS[matter.status]}`);
  lines.push(`- Practice area: ${PRACTICE_AREA_LABELS[matter.practice_area]}`);
  lines.push(`- Client: ${matter.clients?.full_name ?? 'Unknown'}`);
  lines.push(`- Assigned advocate: ${matter.assignee?.full_name ?? 'Unassigned'}`);
  lines.push(`- Opened: ${formatDate(matter.date_opened)}`);
  if (matter.court_station) lines.push(`- Court station: ${matter.court_station}`);
  if (matter.court_case_number) lines.push(`- Court case number: ${matter.court_case_number}`);
  if (matter.opposing_party) lines.push(`- Opposing party: ${matter.opposing_party}`);
  if (matter.opposing_advocates) lines.push(`- Opposing advocates: ${matter.opposing_advocates}`);
  if (matter.description) lines.push(`- Description: ${matter.description}`);

  if ((diary.data ?? []).length > 0) {
    lines.push('\n### Diary');
    for (const e of diary.data!) {
      const time = e.event_time ? ` at ${e.event_time}` : '';
      lines.push(
        `- ${formatDate(e.event_date)}${time}: ${e.title} (${(EVENT_TYPE_LABELS as Record<string, string>)[e.event_type]}, ${(EVENT_STATUS_LABELS as Record<string, string>)[e.status]})`,
      );
    }
  }

  if ((feeNotes.data ?? []).length > 0) {
    lines.push('\n### Fee notes');
    for (const f of feeNotes.data!) {
      const totalKes = (f.total / 100).toLocaleString('en-KE', { minimumFractionDigits: 2 });
      const paidKes = (f.amount_paid / 100).toLocaleString('en-KE', { minimumFractionDigits: 2 });
      lines.push(
        `- ${f.fee_note_number ?? 'Draft fee note'}: ${(FEE_NOTE_STATUS_LABELS as Record<string, string>)[f.status]}, total KES ${totalKes}, paid KES ${paidKes}`,
      );
    }
  }

  if ((documents.data ?? []).length > 0) {
    lines.push('\n### Documents on file');
    for (const d of documents.data!) {
      const note = d.notes ? ` — ${d.notes}` : '';
      lines.push(`- ${d.file_name} (${(DOCUMENT_CATEGORY_LABELS as Record<string, string>)[d.category]})${note}`);
    }
  }

  if ((activity.data ?? []).length > 0) {
    lines.push('\n### Recent activity');
    for (const a of activity.data!) {
      const detail = a.detail ? `: ${a.detail}` : '';
      lines.push(`- ${formatDate(a.created_at)} — ${a.action}${detail}`);
    }
  }

  return lines.join('\n');
}

export async function buildDocumentContext(documentId: string): Promise<string | null> {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from('documents')
    .select('file_name, category, notes, matter_id, storage_path')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!doc) return null;

  return join([
    `## Document: ${doc.file_name}`,
    `- Category: ${(DOCUMENT_CATEGORY_LABELS as Record<string, string>)[doc.category]}`,
    doc.notes ? `- Note: ${doc.notes}` : null,
  ]);
}
