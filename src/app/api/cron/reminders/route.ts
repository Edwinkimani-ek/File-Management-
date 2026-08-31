import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { sendMail } from '@/lib/email';
import { digestMail, leadReminderMail, type ReminderEvent } from '@/lib/reminders';
import { daysUntil, todayInNairobi } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EVENT_SELECT =
  'id, firm_id, title, event_type, event_date, event_time, court_station, assigned_to,' +
  ' reminder_days_before, matter_id, matters:matter_id (id, file_reference, title)';

interface Row extends ReminderEvent {
  firm_id: string;
  assigned_to: string | null;
  reminder_days_before: number[];
}

/**
 * Scheduled job behind the diary reminders. Runs daily at 07:00 in
 * Nairobi (04:00 UTC — see vercel.json) and does two things:
 *
 *   1. lead reminders, for any entry whose reminder_days_before includes
 *      the number of days between today and its date (7, 3 and 1 by
 *      default);
 *   2. a morning digest of everything that user has listed today.
 *
 * It runs under the service role because it works across every firm, and
 * it claims a row in diary_reminders_sent before sending, so a retry or an
 * overlapping run cannot email the same thing twice. Pass ?date= to test
 * it against another day on staging.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const override = url.searchParams.get('date');
  const today = /^\d{4}-\d{2}-\d{2}$/.test(override ?? '') ? override! : todayInNairobi();
  const includeDigest = url.searchParams.get('digest') !== '0';

  const admin = createAdminClient();

  // Only the next year matters; a reminder further out than that would
  // have to have been configured deliberately and can wait for tomorrow.
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCFullYear(horizon.getUTCFullYear() + 1);

  const { data: events, error } = await admin
    .from('diary_events')
    .select(EVENT_SELECT)
    .eq('status', 'upcoming')
    .gte('event_date', today)
    .lte('event_date', horizon.toISOString().slice(0, 10))
    .not('assigned_to', 'is', null)
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (events ?? []) as unknown as Row[];
  const recipients = await loadRecipients(admin, rows.map((r) => r.assigned_to!));

  let leadSent = 0;
  let digestSent = 0;
  const failures: string[] = [];

  // ------------------------------------------------------ lead reminders
  for (const row of rows) {
    const days = daysUntil(row.event_date) - daysUntil(today);
    const wanted = row.reminder_days_before ?? [];
    if (!wanted.includes(days)) continue;

    const recipient = recipients.get(row.assigned_to!);
    if (!recipient) continue;

    const claimed = await claim(admin, row.firm_id, row.id, recipient.id, `lead:${days}`);
    if (!claimed) continue;

    const mail = leadReminderMail({
      firmName: recipient.firmName,
      fullName: recipient.fullName,
      daysBefore: days,
      event: row,
    });
    const result = await sendMail({ to: recipient.email, ...mail });
    if (result.sent) leadSent += 1;
    else failures.push(`lead ${row.id}: ${result.error}`);
  }

  // ------------------------------------------------------ morning digest
  if (includeDigest) {
    const todays = rows.filter((row) => row.event_date === today);
    const byUser = new Map<string, Row[]>();
    for (const row of todays) {
      const list = byUser.get(row.assigned_to!) ?? [];
      list.push(row);
      byUser.set(row.assigned_to!, list);
    }

    for (const [userId, userEvents] of byUser) {
      const recipient = recipients.get(userId);
      if (!recipient) continue;

      // One ledger row per event keeps the digest idempotent even if the
      // day's entries change between runs.
      const fresh: Row[] = [];
      for (const event of userEvents) {
        const claimed = await claim(
          admin, event.firm_id, event.id, userId, `digest:${today}`,
        );
        if (claimed) fresh.push(event);
      }
      if (fresh.length === 0) continue;

      const mail = digestMail({
        firmName: recipient.firmName,
        fullName: recipient.fullName,
        date: today,
        events: userEvents,
      });
      const result = await sendMail({ to: recipient.email, ...mail });
      if (result.sent) digestSent += 1;
      else failures.push(`digest ${userId}: ${result.error}`);
    }
  }

  return NextResponse.json({
    date: today,
    considered: rows.length,
    lead_reminders_sent: leadSent,
    digests_sent: digestSent,
    failures,
  });
}

interface Recipient {
  id: string;
  email: string;
  fullName: string;
  firmName: string;
}

async function loadRecipients(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Map<string, Recipient>> {
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return new Map();

  const { data } = await admin
    .from('users')
    .select('id, email, full_name, status, firms:firm_id (name)')
    .in('id', unique)
    .eq('status', 'active');

  const map = new Map<string, Recipient>();
  for (const row of (data ?? []) as unknown as {
    id: string;
    email: string;
    full_name: string;
    firms: { name: string } | null;
  }[]) {
    map.set(row.id, {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      firmName: row.firms?.name ?? 'Your firm',
    });
  }
  return map;
}

/**
 * Writes the ledger row first. A unique violation means someone — an
 * earlier run, or a retry — already has this reminder, so we do not send.
 */
async function claim(
  admin: ReturnType<typeof createAdminClient>,
  firmId: string,
  eventId: string,
  userId: string,
  kind: string,
): Promise<boolean> {
  const { error } = await admin
    .from('diary_reminders_sent')
    .insert({ firm_id: firmId, event_id: eventId, user_id: userId, kind });
  return !error;
}
