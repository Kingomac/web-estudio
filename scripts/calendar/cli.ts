import { parseArgs } from 'node:util';
import path from 'node:path';
import { calendarSnapshotSchema, calendarSourcesSchema, calendarQuerySchema } from '../../src/schemas/content.ts';
import { addDays, calendarContext, eventSchedule, madridDay } from '../../src/lib/calendario.ts';

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  json: { type: 'boolean' }, help: { type: 'boolean' }, root: { type: 'string' },
  from: { type: 'string' }, to: { type: 'string' }, source: { type: 'string' }, search: { type: 'string' },
} });
const command = positionals[0] || 'query';
const help = `Contexto temporal del máster para agentes\n\nquery [--from AAAA-MM-DD --to AAAA-MM-DD] [--source ID,ID] [--search TEXTO]\nsources                        Listar IDs, procedencia, vigencia y alcance\ncheck                          Validar las fuentes y su copia local\n\n--json emite datos estructurados; --root permite elegir el repositorio.\nLas fechas se interpretan en Europe/Madrid; ambos extremos son inclusivos.\nPor defecto se consultan hoy y los 13 días siguientes. No consulta la red.\nEjecuta calendar:sync antes de utilizar fechas para planificar.\n`;

async function main() {
  if (values.help) { console.log(help); return; }
  if (!['query', 'sources', 'check'].includes(command)) throw new Error('Comando desconocido. Usa --help.');
  const root = path.resolve(values.root || process.cwd());
  const definitions = calendarSourcesSchema.parse(await Bun.file(path.join(root, 'content/assets/calendario-fuentes.json')).json());
  const snapshot = calendarSnapshotSchema.parse(await Bun.file(path.join(root, 'content/assets/calendario.json')).json());
  const from = values.from ?? madridDay(new Date());
  // Validate the date before using it to calculate a default interval.
  calendarQuerySchema.parse({ from, to: from });
  const query = calendarQuerySchema.parse({ from, to: values.to ?? addDays(from, 13), sourceIds: values.source?.split(',').map(id => id.trim()), search: values.search });
  const result = calendarContext(snapshot, definitions, query);
  if (command === 'check') {
    console.log(values.json ? JSON.stringify({ ok: true, sources: definitions.length, events: snapshot.events.length, warnings: result.warnings }, null, 2) : `Contexto válido: ${definitions.length} fuentes, ${snapshot.events.length} eventos. La validación no acredita su vigencia.`);
  } else if (command === 'sources') {
    console.log(values.json ? JSON.stringify({ timezone: result.timezone, coverage: result.coverage, sources: result.sources, warnings: result.warnings }, null, 2) : result.sources.map(source => `${source.id}: ${source.label} · ${source.status} · última copia ${source.lastSuccessAt ?? 'inexistente'}${source.stale ? ' · desactualizada' : ''}\n  ${source.scope}`).join('\n'));
  } else if (values.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`${result.events.length} eventos entre ${query.from} y ${query.to}, inclusive (${result.timezone}).`);
    for (const event of result.events) console.log(`${eventSchedule(event)} · ${event.title} [${event.sourceId}; ${event.id}]${event.location ? ` · ${event.location}` : ''}`);
    for (const warning of result.warnings) console.log(`Aviso: ${warning}`);
  }
}
main().catch(error => {
  const message = error instanceof Error ? error.message : 'No se pudo consultar el contexto temporal.';
  console.log(values.json ? JSON.stringify({ ok: false, errors: [{ message }] }, null, 2) : message);
  process.exitCode = 1;
});
