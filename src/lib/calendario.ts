import { calendarContextSchema, calendarQuerySchema } from '../schemas/content.ts';
import type { CalendarEvent, CalendarSnapshot, CalendarSources, CalendarQuery } from '../schemas/content.ts';

export const calendarTimezone = 'Europe/Madrid';
export function madridDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: calendarTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function eventDays(event: CalendarEvent): { first: string; last: string } {
  if (event.allDay) return { first: event.start, last: addDays(event.end, -1) };
  return { first: madridDay(new Date(event.start)), last: madridDay(new Date(Math.max(Date.parse(event.start), Date.parse(event.end) - 1))) };
}
export function occursOn(event: CalendarEvent, day: string): boolean {
  const { first, last } = eventDays(event);
  return first <= day && last >= day;
}
export function occursInMonth(event: CalendarEvent, month: string): boolean {
  const { first, last } = eventDays(event);
  return first.slice(0, 7) <= month && last.slice(0, 7) >= month;
}
export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}
export function eventSchedule(event: CalendarEvent): string {
  const { first, last } = eventDays(event);
  const dates = first === last ? dayLabel(first) : `${dayLabel(first)} – ${dayLabel(last)}`;
  if (event.allDay) return `${dates} · Todo el día`;
  const time = (value: string) => new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: calendarTimezone }).format(new Date(value));
  return `${dates} · ${time(event.start)}${event.end === event.start ? '' : ` – ${time(event.end)}`}`;
}

const normalized = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');

export function calendarContext(snapshot: CalendarSnapshot, definitions: CalendarSources, options: CalendarQuery, now = new Date()) {
  const query = calendarQuerySchema.parse(options);
  const configured = new Map(definitions.map(source => [source.id, source]));
  if (snapshot.sources.length !== configured.size || snapshot.sources.some(source => !configured.has(source.id))) throw new Error('Las fuentes y la copia local no coinciden. Ejecuta calendar:sync.');
  if (query.sourceIds?.some(id => !configured.has(id))) throw new Error('Fuente desconocida. Consulta calendar:sources.');
  const selected = snapshot.sources.filter(source => !query.sourceIds || query.sourceIds.includes(source.id));
  const sources = selected.map(source => {
    const definition = configured.get(source.id)!;
    return {
      ...source, kind: definition.kind,
      stale: !source.lastSuccessAt || now.getTime() - Date.parse(source.lastSuccessAt) > 48 * 60 * 60 * 1000,
      scope: definition.kind === 'moovi' ? 'Exportación del usuario: eventos recientes y próximos 60 días desde la sincronización; no es todo el curso.' : 'Eventos publicados por esta fuente dentro del curso 2026/27; no garantiza que incluya todas las actividades.',
      referenceUrl: definition.kind === 'moovi' ? 'https://moovi.uvigo.gal/calendar/view.php' : `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(definition.calendarId)}&ctz=Europe%2FMadrid`,
    };
  });
  const labels = new Map(sources.map(source => [source.id, source.label]));
  const events = snapshot.events.filter(event => {
    if (!labels.has(event.sourceId)) return false;
    const { first, last } = eventDays(event);
    if (first > query.to || last < query.from) return false;
    return !query.search || normalized([labels.get(event.sourceId), event.title, event.location].filter(Boolean).join(' ')).includes(normalized(query.search));
  }).toSorted((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const warnings = ['La ausencia de eventos no demuestra que no haya clases, entregas o exámenes; esta copia no acredita que una tarea esté completada.'];
  if (query.from < snapshot.from || query.to >= snapshot.until) warnings.push(`La consulta excede el intervalo importado: desde ${snapshot.from} hasta ${snapshot.until} (fin exclusivo).`);
  for (const source of sources) {
    if (source.status === 'error') warnings.push(`${source.id}: falló el último intento de sincronización; consulta lastSuccessAt antes de usar la copia.`);
    if (source.stale) warnings.push(`${source.id}: sin una copia actualizada en las últimas 48 horas. Sincroniza antes de planificar.`);
    if (source.limitedDetails) warnings.push(`${source.id}: hay eventos que solo indican disponibilidad, sin detalles.`);
  }
  return calendarContextSchema.parse({ timezone: calendarTimezone, query, snapshotUpdatedAt: snapshot.updatedAt, coverage: { from: snapshot.from, until: snapshot.until }, sources, events, warnings });
}
