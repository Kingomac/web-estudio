import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { parseCalendar } from '../../scripts/calendar/ical.ts';
import { syncCalendars } from '../../scripts/calendar/sync.ts';
import { calendarContext, eventDays, eventSchedule, occursOn, occursInMonth } from '../../src/lib/calendario.ts';
import { calendarSnapshotSchema, calendarSourcesSchema, calendarContextSchema } from '../../src/schemas/content.ts';

const wrap = (events: string, timezone = '') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${timezone}${events}END:VCALENDAR\r\n`;
const event = (fields: string) => `BEGIN:VEVENT\r\n${fields.replaceAll('\n', '\r\n')}\r\nEND:VEVENT\r\n`;
const from = '2026-09-01', until = '2027-09-01';
const madrid = `BEGIN:VTIMEZONE\r\nTZID:Europe/Madrid\r\nBEGIN:DAYLIGHT\r\nDTSTART:19700329T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nDTSTART:19701025T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n`;

test('calendario conserva días completos, fin exclusivo y entregas de duración cero en Madrid', () => {
  const events = parseCalendar(wrap(
    event('UID:holiday\nSUMMARY:Vacaciones\nDTSTART;VALUE=DATE:20270322\nDTEND;VALUE=DATE:20270327') +
    event('UID:deadline\nSUMMARY:Entrega\nDTSTART:20261026T225900Z\nDTEND:20261026T225900Z') +
    event('UID:midnight\nSUMMARY:Inicio del curso\nDTSTART:20260831T230000Z\nDTEND:20260901T000000Z')
  ), 'google', from, until);
  const holiday = events.find(e => e.title === 'Vacaciones')!;
  assert.ok(occursOn(holiday, '2027-03-26'));
  assert.ok(!occursOn(holiday, '2027-03-27'));
  assert.deepEqual(eventDays(holiday), { first: '2027-03-22', last: '2027-03-26' });
  assert.match(eventSchedule(events.find(e => e.title === 'Entrega')!), /23:59$/);
  assert.ok(occursInMonth(events.find(e => e.title === 'Inicio del curso')!, '2026-09'));
});

test('calendario expande recurrencias con cambio de hora, exclusiones y excepciones', () => {
  const events = parseCalendar(wrap(
    event('UID:weekly\nSUMMARY:Clase\nDTSTART;TZID=Europe/Madrid:20261018T100000\nDTEND;TZID=Europe/Madrid:20261018T110000\nRRULE:FREQ=WEEKLY;COUNT=3\nEXDATE;TZID=Europe/Madrid:20261101T100000') +
    event('UID:weekly\nRECURRENCE-ID;TZID=Europe/Madrid:20261025T100000\nSUMMARY:Clase trasladada\nDTSTART;TZID=Europe/Madrid:20261025T120000\nDTEND;TZID=Europe/Madrid:20261025T130000') +
    event('UID:cancelled\nSUMMARY:Cancelada\nSTATUS:CANCELLED\nDTSTART:20261020T120000Z\nDTEND:20261020T130000Z'), madrid
  ), 'google', from, until);
  assert.equal(events.length, 2);
  assert.equal(events[0].start, '2026-10-18T08:00:00.000Z');
  assert.equal(events[1].start, '2026-10-25T11:00:00.000Z');
  assert.equal(events[1].title, 'Clase trasladada');
});

test('calendario no publica credenciales, descripciones, organizadores ni enlaces arbitrarios', () => {
  const source = wrap(event('UID:private-uid\nSUMMARY:Entrega con título\n plegado\nDTSTART:20261026T225900Z\nDESCRIPTION:authtoken=secreto\nORGANIZER:mailto:privado@example.com\nURL:https://moovi.uvigo.gal/mod/assign/view.php?id=123&authtoken=secreto'));
  const [entry] = parseCalendar(source, 'moovi', from, until);
  assert.equal(entry.title, 'Entrega con títuloplegado');
  assert.equal(entry.url, 'https://moovi.uvigo.gal/mod/assign/view.php?id=123');
  assert.ok(!JSON.stringify(entry).includes('secreto'));
  assert.ok(!JSON.stringify(entry).includes('private-uid'));
  assert.ok(!JSON.stringify(entry).includes('@'));
  const [unsafe] = parseCalendar(source.replace('https://moovi.uvigo.gal/mod/assign/view.php?id=123&authtoken=secreto', 'javascript:alert(1)'), 'moovi', from, until);
  assert.equal(unsafe.url, undefined);
});

test('calendario rechaza HTML, fechas flotantes y zonas desconocidas', () => {
  assert.throws(() => parseCalendar('<html>Inicia sesión</html>', 'google', from, until));
  assert.throws(() => parseCalendar(wrap(event('UID:float\nSUMMARY:Clase\nDTSTART:20261026T120000')), 'google', from, until), /zona horaria/);
  assert.throws(() => parseCalendar(wrap(event('UID:unknown\nSUMMARY:Clase\nDTSTART;TZID=Unknown/Zone:20261026T120000')), 'google', from, until), /zona horaria/);
});

test('sincronizar conserva fuentes fallidas, reemplaza eventos modificados y elimina los borrados', async () => {
  const oldUrl = process.env.MOOVI_CALENDAR_URL;
  process.env.MOOVI_CALENDAR_URL = 'https://moovi.uvigo.gal/calendar/export_execute.php?authtoken=secreto';
  try {
    const feed = wrap(event('UID:one\nSUMMARY:Clase\nDTSTART:20261026T120000Z\nDTEND:20261026T130000Z'));
    const first = await syncCalendars(undefined, async () => feed);
    assert.equal(first.events.length, first.sources.length);
    const changed = await syncCalendars(first, async url => {
      if (url.includes('moovi')) throw new Error(url);
      return feed.replace('SUMMARY:Clase', 'SUMMARY:Clase actualizada');
    });
    assert.equal(changed.sources.find(s => s.id === 'moovi')!.status, 'error');
    assert.deepEqual(changed.events.filter(e => e.sourceId === 'moovi'), first.events.filter(e => e.sourceId === 'moovi'));
    assert.equal(changed.events.find(e => e.sourceId === 'google')!.title, 'Clase actualizada');
    assert.equal(changed.events.find(e => e.sourceId === 'google')!.id, first.events.find(e => e.sourceId === 'google')!.id);
    assert.ok(!JSON.stringify(changed).includes('secreto'));
    const empty = await syncCalendars(changed, async () => wrap(''));
    assert.equal(empty.events.length, 0);
    assert.ok(empty.sources.every(s => s.status === 'ok'));
  } finally {
    if (oldUrl === undefined) delete process.env.MOOVI_CALENDAR_URL;
    else process.env.MOOVI_CALENDAR_URL = oldUrl;
  }
});

test('el contexto filtra intervalos inclusivos de Madrid, fuentes y texto sin tildes', () => {
  const definitions = calendarSourcesSchema.parse([
    { id: 'google', kind: 'google', label: 'Protocolos de Comunicacións', calendarId: 'fixture@group.calendar.google.com' },
    { id: 'moovi', kind: 'moovi', label: 'Entregas' },
  ]);
  const snapshot = calendarSnapshotSchema.parse({
    version: 1, timezone: 'Europe/Madrid', from, until, updatedAt: '2026-10-26T10:00:00Z',
    sources: definitions.map(({ id, label }) => ({ id, label, status: 'ok', checkedAt: '2026-10-26T10:00:00Z', lastSuccessAt: '2026-10-26T10:00:00Z' })),
    events: [
      { id: 'midnight', sourceId: 'google', title: 'Práctica', start: '2026-10-25T23:30:00Z', end: '2026-10-26T00:30:00Z', allDay: false },
      { id: 'multi', sourceId: 'google', title: 'Actividad de varios días', start: '2026-10-25', end: '2026-10-27', allDay: true },
      { id: 'deadline', sourceId: 'moovi', title: 'Entrega', start: '2026-10-26T22:59:00Z', end: '2026-10-26T22:59:00Z', allDay: false },
    ],
  });
  const now = new Date('2026-10-26T11:00:00Z');
  const options = { from: '2026-10-26', to: '2026-10-26' };
  const result = calendarContext(snapshot, definitions, { ...options, search: 'COMUNICACIONS' }, now);
  assert.deepEqual(result.events.map(e => e.id).toSorted(), ['midnight', 'multi']);
  assert.equal(calendarContext(snapshot, definitions, { ...options, search: 'practica' }, now).events[0].id, 'midnight');
  assert.equal(calendarContext(snapshot, definitions, { ...options, sourceIds: ['moovi'] }, now).events[0].id, 'deadline');
  assert.equal(calendarContext(snapshot, definitions, { from: '2026-10-27', to: '2026-10-27' }, now).events.length, 0);
  assert.throws(() => calendarContext(snapshot, definitions, { ...options, sourceIds: ['inexistente'] }, now), /Fuente desconocida/);
  assert.throws(() => calendarContext(snapshot, definitions, { from: '2026-10-27', to: '2026-10-26' }, now));
});

test('el contexto advierte de antigüedad, fallos, cobertura y disponibilidad limitada aunque no haya eventos', () => {
  const definitions = calendarSourcesSchema.parse([{ id: 'moovi', kind: 'moovi', label: 'Moovi' }]);
  const snapshot = calendarSnapshotSchema.parse({
    version: 1, timezone: 'Europe/Madrid', from, until, updatedAt: '2026-10-26T10:00:00Z', events: [],
    sources: [{ id: 'moovi', label: 'Moovi', status: 'error', checkedAt: '2026-10-26T10:00:00Z', lastSuccessAt: '2026-10-20T10:00:00Z', limitedDetails: true }],
  });
  const result = calendarContext(snapshot, definitions, { from: '2027-09-01', to: '2027-09-02' }, new Date('2026-10-26T11:00:00Z'));
  assert.equal(result.events.length, 0);
  assert.equal(result.sources[0].stale, true);
  assert.equal(result.sources[0].lastSuccessAt, '2026-10-20T10:00:00Z');
  assert.match(result.sources[0].scope, /60 días/);
  assert.ok(result.warnings.some(w => w.includes('no demuestra')));
  assert.ok(result.warnings.some(w => w.includes('falló')));
  assert.ok(result.warnings.some(w => w.includes('48 horas')));
  assert.ok(result.warnings.some(w => w.includes('excede')));
  assert.ok(result.warnings.some(w => w.includes('sin detalles')));
  assert.ok(!JSON.stringify(result).includes('authtoken'));
});

test('la CLI entrega contexto JSON y rechaza fechas o fuentes inválidas sin modificar la copia', async () => {
  const path = 'content/assets/calendario.json';
  const before = await Bun.file(path).text();
  const run = (...args: string[]) => Bun.spawnSync([process.execPath, 'scripts/calendar/cli.ts', ...args, '--json'], { stdout: 'pipe', stderr: 'pipe' });
  const result = run('query', '--from', '2026-10-26', '--to', '2026-11-01', '--source', 'google-12');
  assert.equal(result.exitCode, 0);
  const context = calendarContextSchema.parse(JSON.parse(result.stdout.toString()));
  assert.equal(context.timezone, 'Europe/Madrid');
  assert.equal(context.sources.length, 1);
  assert.ok(context.events.every(e => e.sourceId === 'google-12'));
  for (const args of [['--from', '2026-02-30'], ['--source', 'inexistente']]) {
    const invalid = run('query', ...args);
    assert.equal(invalid.exitCode, 1);
    const error: unknown = JSON.parse(invalid.stdout.toString());
    assert.ok(typeof error === 'object' && error !== null && 'ok' in error && error.ok === false);
  }
  assert.equal(await Bun.file(path).text(), before);
});
