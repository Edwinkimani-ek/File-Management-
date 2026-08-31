import 'server-only';
import { escapeHtml, layoutEmail } from '@/lib/email';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { formatDate, formatLongDate, formatTime } from '@/lib/dates';
import { env } from '@/lib/env';
import type { DiaryEventType } from '@/lib/types';

export interface ReminderEvent {
  id: string;
  title: string;
  event_type: DiaryEventType;
  event_date: string;
  event_time: string | null;
  court_station: string | null;
  matter_id: string | null;
  matters: { id: string; file_reference: string; title: string } | null;
}

function eventLine(event: ReminderEvent): string {
  const parts = [
    EVENT_TYPE_LABELS[event.event_type],
    formatDate(event.event_date) + (event.event_time ? ` at ${formatTime(event.event_time)}` : ''),
    event.court_station,
    event.matters ? `${event.matters.file_reference} — ${event.matters.title}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function eventHtml(event: ReminderEvent): string {
  const href = event.matters
    ? `${env.siteUrl}/matters/${event.matters.id}/diary`
    : `${env.siteUrl}/diary`;
  return `<li style="margin:0 0 10px">
    <a href="${href}" style="color:#1e5142;font-weight:600;text-decoration:none">${escapeHtml(event.title)}</a>
    <br /><span style="color:#5b7191;font-size:13px">${escapeHtml(eventLine(event))}</span>
  </li>`;
}

/** One entry, some days out. */
export function leadReminderMail(args: {
  firmName: string;
  fullName: string;
  daysBefore: number;
  event: ReminderEvent;
}) {
  const when =
    args.daysBefore === 0
      ? 'today'
      : args.daysBefore === 1
        ? 'tomorrow'
        : `in ${args.daysBefore} days`;

  const heading = `${EVENT_TYPE_LABELS[args.event.event_type]} ${when}`;
  const body = `<p style="margin:0 0 12px">Hello ${escapeHtml(args.fullName.split(' ')[0])},</p>
<p style="margin:0 0 12px">This is a reminder of a diary entry due <strong>${when}</strong>, on ${escapeHtml(formatLongDate(args.event.event_date))}.</p>
<ul style="margin:0 0 16px;padding-left:18px">${eventHtml(args.event)}</ul>`;

  return {
    subject: `${heading}: ${args.event.title}`,
    html: layoutEmail(args.firmName, heading, body),
    text: `Hello ${args.fullName.split(' ')[0]},\n\nReminder — a diary entry is due ${when} (${formatDate(args.event.event_date)}).\n\n${args.event.title}\n${eventLine(args.event)}\n\n${env.siteUrl}/diary`,
  };
}

/** Everything one advocate has on today, sent at 07:00 Nairobi. */
export function digestMail(args: {
  firmName: string;
  fullName: string;
  date: string;
  events: ReminderEvent[];
}) {
  const heading = `Your diary for ${formatDate(args.date)}`;
  const body = `<p style="margin:0 0 12px">Good morning ${escapeHtml(args.fullName.split(' ')[0])},</p>
<p style="margin:0 0 12px">You have ${args.events.length} entr${args.events.length === 1 ? 'y' : 'ies'} today, ${escapeHtml(formatLongDate(args.date))}.</p>
<ul style="margin:0 0 16px;padding-left:18px">${args.events.map(eventHtml).join('')}</ul>
<p style="margin:0"><a href="${env.siteUrl}/diary" style="color:#1e5142">Open the diary</a></p>`;

  return {
    subject: `${heading} — ${args.events.length} entr${args.events.length === 1 ? 'y' : 'ies'}`,
    html: layoutEmail(args.firmName, heading, body),
    text:
      `Good morning ${args.fullName.split(' ')[0]},\n\nYour diary for ${formatDate(args.date)}:\n\n` +
      args.events.map((e) => `- ${e.title}\n  ${eventLine(e)}`).join('\n') +
      `\n\n${env.siteUrl}/diary`,
  };
}
