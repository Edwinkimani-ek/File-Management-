import Link from 'next/link';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { formatTime, todayInNairobi } from '@/lib/dates';
import type { DiaryEventType } from '@/lib/types';

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: DiaryEventType;
  event_date: string;
  event_time: string | null;
  status: 'upcoming' | 'done' | 'adjourned';
  matter_id: string | null;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_DOTS: Record<DiaryEventType, string> = {
  hearing: 'bg-brand-600',
  mention: 'bg-sky-600',
  filing_deadline: 'bg-amber-600',
  limitation_deadline: 'bg-red-600',
  client_meeting: 'bg-ink-500',
  other: 'bg-ink-400',
};

/** Cells for a whole month, Monday first, as Kenyan diaries are ruled. */
export function MonthCalendar({
  month,
  events,
}: {
  month: string; // YYYY-MM
  events: CalendarEvent[];
}) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  // getUTCDay() is Sunday-based; shift so Monday is column 0.
  const leading = (first.getUTCDay() + 6) % 7;
  const today = todayInNairobi();

  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.event_date) ?? [];
    list.push(event);
    byDate.set(event.event_date, list);
  }

  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-ink-200 bg-ink-50">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-ink-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, index) => {
            if (!date) {
              return <div key={`blank-${index}`} className="h-28 border-b border-r border-ink-200 bg-ink-50/50" />;
            }
            const dayEvents = byDate.get(date) ?? [];
            const isToday = date === today;
            return (
              <div key={date}
                   className={`h-28 overflow-y-auto border-b border-r border-ink-200 p-1.5 ${
                     isToday ? 'bg-brand-50' : 'bg-white'
                   }`}>
                <p className={`mb-1 text-xs font-medium ${isToday ? 'text-brand-700' : 'text-ink-500'}`}>
                  {Number(date.slice(-2))}
                </p>
                <ul className="space-y-1">
                  {dayEvents.map((event) => (
                    <li key={event.id}>
                      <Link
                        href={event.matter_id ? `/matters/${event.matter_id}/diary` : `/diary?date=${date}`}
                        className="flex items-start gap-1 text-[11px] leading-tight text-ink-700 hover:underline"
                        title={`${EVENT_TYPE_LABELS[event.event_type]} — ${event.title}`}
                      >
                        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOTS[event.event_type]} ${
                          event.status !== 'upcoming' ? 'opacity-40' : ''
                        }`} />
                        <span className={`line-clamp-2 ${event.status !== 'upcoming' ? 'text-ink-400 line-through' : ''}`}>
                          {event.event_time ? `${formatTime(event.event_time)} ` : ''}
                          {event.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
