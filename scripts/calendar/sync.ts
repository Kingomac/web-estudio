import { mkdir, rename, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { calendarSnapshotSchema, calendarSourcesSchema } from '../../src/schemas/content.ts';
import type { CalendarSnapshot } from '../../src/schemas/content.ts';
import { calendarName, parseCalendar } from './ical.ts';
import configuredSources from '../../content/assets/calendario-fuentes.json';

export const snapshotPath = 'content/assets/calendario.json';
const sources = calendarSourcesSchema.parse(configuredSources);

export async function syncCalendars(previous?: CalendarSnapshot, download: (url: string) => Promise<string> = downloadCalendar): Promise<CalendarSnapshot> {
  const now = new Date().toISOString();
  const snapshot: CalendarSnapshot = { version: 1, timezone: 'Europe/Madrid', from: '2026-09-01', until: '2027-09-01', updatedAt: now, sources: [], events: [] };
  for (const source of sources) {
    const oldSource = previous?.sources.find(s => s.id === source.id);
    try {
      const url = source.kind === 'google' ? `https://calendar.google.com/calendar/ical/${encodeURIComponent(source.calendarId)}/public/basic.ics` : process.env.MOOVI_CALENDAR_URL;
      if (!url) throw new Error('Falta la configuración privada de la fuente.');
      const body = await download(url);
      const events = parseCalendar(body, source.id, snapshot.from, snapshot.until);
      snapshot.events.push(...events);
      snapshot.sources.push({ id: source.id, label: source.kind === 'google' ? calendarName(body) ?? source.label : source.label, status: 'ok', checkedAt: now, lastSuccessAt: now, limitedDetails: events.some(e => e.title === 'Ocupado') });
    } catch {
      // Never log raw network/parser errors: they can contain subscription credentials.
      snapshot.sources.push({ id: source.id, label: oldSource?.label ?? source.label, status: 'error', checkedAt: now, lastSuccessAt: oldSource?.lastSuccessAt ?? null, limitedDetails: oldSource?.limitedDetails ?? false });
      snapshot.events.push(...(previous?.events.filter(e => e.sourceId === source.id) ?? []));
    }
  }
  snapshot.events.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  return calendarSnapshotSchema.parse(snapshot);
}

async function downloadCalendar(url: string): Promise<string> {
  const address = new URL(url);
  if (address.protocol !== 'https:' || !['calendar.google.com', 'moovi.uvigo.gal'].includes(address.hostname)) throw new Error('Origen no permitido.');
  const response = await fetch(address, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
  if (!response.ok) throw new Error('La fuente no está disponible.');
  const body = await response.text();
  if (body.length > 5_000_000 || !body.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error('Respuesta de calendario inválida.');
  return body;
}

if (import.meta.main) {
  try {
    const file = Bun.file(snapshotPath);
    const previous = await file.exists() ? calendarSnapshotSchema.parse(await file.json()) : undefined;
    const snapshot = await syncCalendars(previous);
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    const temporary = `${snapshotPath}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
      await rename(temporary, snapshotPath);
    } finally { await rm(temporary, { force: true }); }
    for (const source of snapshot.sources) console.log(`${source.label}: ${source.status === 'ok' ? `${snapshot.events.filter(e => e.sourceId === source.id).length} eventos` : 'no se pudo actualizar; se conserva la última copia disponible'}.`);
    if (snapshot.sources.some(s => s.status === 'error')) process.exitCode = 1;
  } catch { console.error('No se pudo guardar el calendario. Revisa la configuración y la copia local.'); process.exitCode = 1; }
}
