import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { requireCatalog } from '../../src/lib/catalogo.ts';
import { entrySchema } from '../../src/schemas/content.ts';
const project = process.cwd();
const cli = path.join(project, 'scripts/content/cli.ts');
async function repository() {
  const root = await mkdtemp(path.join(tmpdir(), 'web-estudio-test-'));
  // Copy the fixture and its dependencies, not every subject's growing PDF archive.
  for (const file of [
    'content/bimestres/b1.json',
    'content/asignaturas/protocolos/asignatura.json',
    'content/asignaturas/protocolos/tags/ipv6.json',
    'content/asignaturas/protocolos/tags/repaso.json',
    'content/asignaturas/protocolos/materiales/tema-3-ip-en-iot.json',
    'content/asignaturas/protocolos/apuntes/ipv6-y-vecinos',
    'content/asignaturas/protocolos/resumenes/ipv6-esencial',
    'public/materiales/protocolos/tema-3-ip-en-iot.pdf',
  ]) await cp(path.join(project, file), path.join(root, file), { recursive: true });
  return root;
}
function run(root: string, ...args: string[]) {
  const result = Bun.spawnSync([process.execPath, cli, ...args, '--root', root, '--json'], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString() || result.stdout.toString());
  return JSON.parse(result.stdout.toString());
}

test('incorporar un original desde una ruta externa es idempotente y conserva su contenido', async () => {
  const root = await repository();
  try {
    const original = path.join(project, 'public/materiales/protocolos/tema-3-ip-en-iot.pdf');
    const before = await readFile(original);
    const result = run(root, 'import', '--source', original, '--subject', 'protocolos', '--slug', 'otro-nombre', '--title', 'Otro', '--scope', 'Documento', '--tags', 'protocolos.tags.ipv6');
    assert.equal(result.unchanged, true);
    assert.equal(result.existing, 'protocolos.materiales.tema-3-ip-en-iot');
    assert.deepEqual(await readFile(original), before);
    const manifest = path.join(root, 'content/asignaturas/protocolos/materiales/tema-3-ip-en-iot.json');
    await rm(manifest);
    await rm(path.join(root, 'public/materiales/protocolos/tema-3-ip-en-iot.pdf'));
    const imported = run(root, 'import', '--source', original, '--subject', 'protocolos', '--slug', 'tema-3-ip-en-iot', '--title', 'IP en IoT', '--scope', 'Original completo', '--tags', 'protocolos.tags.ipv6');
    assert.equal(imported.pageCount, 55);
    assert.deepEqual(await readFile(path.join(root, 'public/materiales/protocolos/tema-3-ip-en-iot.pdf')), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('new crea archivos sin sobrescribir y obliga a completar la plantilla', async () => {
  const root = await repository();
  try {
    const args = ['new', '--kind', 'apuntes', '--subject', 'protocolos', '--slug', 'nuevo', '--title', 'Nuevo', '--tags', 'protocolos.tags.ipv6'];
    const created = run(root, ...args);
    assert.equal(created.created.length, 2);
    assert.throws(() => run(root, ...args));
    assert.throws(() => run(root, 'check'));
    assert.throws(() => run(root, 'new', '--kind', 'apuntes', '--subject', 'protocolos', '--slug', '../fuera', '--title', 'Fuera'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('un original alterado y una cita rota impiden compilar', async () => {
  const root = await repository();
  try {
    const pdf = path.join(root, 'public/materiales/protocolos/tema-3-ip-en-iot.pdf');
    const bytes = await readFile(pdf);
    await writeFile(pdf, Buffer.concat([bytes, Buffer.from('\n% changed')]));
    assert.throws(() => run(root, 'check'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const body of ['body.mdx', 'body.astro'] as const) test(`new --data rechaza el cuerpo pendiente ${body} hasta completarlo`, async () => {
  const root = await repository();
  try {
    const source = entrySchema.parse(await Bun.file(path.join(root, 'content/asignaturas/protocolos/resumenes/ipv6-esencial/recurso.json')).json());
    assert.ok(source.kind === 'resumen');
    const manifest = { ...source, id: 'protocolos.resumenes.nuevo', slug: 'nuevo', body };
    const data = path.join(root, 'nuevo.json');
    await writeFile(data, JSON.stringify(manifest));
    run(root, 'new', '--data', data);
    assert.throws(() => run(root, 'check'), /PENDIENTE en el cuerpo/);
    await assert.rejects(requireCatalog({ root }), /recurso\.json:body:.*PENDIENTE/);
    await writeFile(path.join(root, 'content/asignaturas/protocolos/resumenes/nuevo', body), '<h2 id="introduccion">Introducción</h2>\n<p>Cuerpo de prueba completo.</p>\n');
    assert.equal(run(root, 'check').ok, true);
    await requireCatalog({ root });
  } finally { await rm(root, { recursive: true, force: true }); }
});
