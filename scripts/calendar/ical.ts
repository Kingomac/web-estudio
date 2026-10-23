import ICAL from 'ical.js';
import { createHash } from 'node:crypto';
import { calendarEventSchema } from '../../src/schemas/content.ts';
import type { CalendarEvent, CalendarSourceId } from '../../src/schemas/content.ts';
import { eventDays } from '../../src/lib/calendario.ts';

export function calendarName(source: string): string | undefined {
  const value: unknown = ICAL.Component.fromString(source).getFirstPropertyValue('x-wr-calname');
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

// Keep only temporal context; never descriptions, attendees or private feed URLs.
function publicEventUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return;
    if (url.hostname === 'moovi.uvigo.gal' && /^\/mod\/[a-z]+\/view\.php$/.test(url.pathname)) {
      const id = url.searchParams.get('id');
      if (id && /^\d+$/.test(id)) return `${url.origin}${url.pathname}?id=${id}`;
    }
    if (url.hostname === 'calendar.google.com' && url.pathname === '/calendar/event') {
      const eid = url.searchParams.get('eid');
      if (eid) return `${url.origin}${url.pathname}?eid=${encodeURIComponent(eid)}`;
    }
  } catch { /* An unrecognized URL is omitted from public data. */ }
}

export function parseCalendar(source: string, sourceId: CalendarSourceId, from: string, until: string): CalendarEvent[] {
  const calendar = ICAL.Component.fromString(source);
  if (calendar.name !== 'vcalendar') throw new Error('La fuente no contiene un calendario iCalendar.');
  const result = new Map<string, CalendarEvent>();
  const components = calendar.getAllSubcomponents('vevent');
  const parents = new Set(components.filter(c => !c.hasProperty('recurrence-id')).map(c => String(c.getFirstPropertyValue('uid'))));
  for (const component of components) {
    const event = new ICAL.Event(component);
    if (event.isRecurrenceException() && parents.has(event.uid)) continue;
    if (component.getFirstPropertyValue('status') === 'CANCELLED') continue;
    if (!event.uid || !component.hasProperty('dtstart')) throw new Error('Evento sin UID o inicio.');
    // Do not silently interpret an unknown TZID as UTC or the machine's local timezone.
    for (const name of ['dtstart', 'dtend', 'recurrence-id']) {
      const property = component.getFirstProperty(name);
      const tzid: unknown = property?.getParameter('tzid');
      if (typeof tzid === 'string' && tzid !== 'UTC' && !calendar.getTimeZoneByID(tzid)) throw new Error('La fuente no define su zona horaria.');
    }
    const serialize = (time: ICAL.Time): string => {
      if (time.isDate) return time.toString();
      if (time.zone.tzid === 'floating') throw new Error('Evento sin zona horaria explícita.');
      return time.toJSDate().toISOString();
    };
    const add = (item: ICAL.Event, startDate: ICAL.Time, endDate: ICAL.Time, recurrenceId: string) => {
      if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return;
      const start = serialize(startDate), end = serialize(endDate);
      const id = createHash('sha256').update(`${sourceId}:${event.uid}:${recurrenceId}`).digest('hex').slice(0, 24);
      const entry = calendarEventSchema.parse({
        id, sourceId, title: (item.summary || event.summary) === 'Busy' ? 'Ocupado' : item.summary || event.summary || 'Evento sin título',
        allDay: startDate.isDate, start, end, location: item.location || undefined,
        url: publicEventUrl(item.component.getFirstPropertyValue('url')),
      });
      const days = eventDays(entry);
      if (days.first >= until || days.last < from) return;
      result.set(id, entry);
    };
    if (!event.isRecurring()) {
      add(event, event.startDate, event.endDate, event.isRecurrenceException() ? event.recurrenceId.toString() : event.startDate.toString());
      continue;
    }
    const iterator = event.iterator();
    let complete = false;
    for (let i = 0; i < 50_000; i++) {
      const occurrence = iterator.next();
      if (!occurrence || occurrence.toString().slice(0, 10) >= until) { complete = true; break; }
      const details = event.getOccurrenceDetails(occurrence);
      add(details.item, details.startDate, details.endDate, occurrence.toString());
    }
    if (!complete) throw new Error('La recurrencia supera el límite de expansión.');
  }
  return [...result.values()].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}
