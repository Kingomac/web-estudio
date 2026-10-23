import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { dev } from 'astro';
import { entrySchema } from '../../src/schemas/content.ts';

test('dev actualiza el catálogo al editar, añadir y borrar manifiestos sin reiniciar', async () => {
  const project = process.cwd();
  const root = await mkdtemp(path.join(tmpdir(), 'web-estudio-dev-'));
  let server: Awaited<ReturnType<typeof dev>> | undefined;
  try {
    for (const file of ['src', 'content', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) {
      await cp(path.join(project, file), path.join(root, file), { recursive: true });
    }
    await symlink(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    server = await dev({ root, server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
    const url = `http://127.0.0.1:${server.address.port}/web-estudio/`;
    async function expectPage(text: string, present = true) {
      const deadline = Date.now() + 15_000;
      do {
        const response = await fetch(url);
        if (response.ok && (await response.text()).includes(text) === present) return;
        await Bun.sleep(100);
      } while (Date.now() < deadline);
      assert.fail(`La página no refleja el cambio: ${text} (presente: ${present})`);
    }
    const file = path.join(root, 'content/asignaturas/protocolos/asignatura.json');
    const subject = entrySchema.parse(await Bun.file(file).json());
    assert.ok(subject.kind === 'asignatura');
    await expectPage(subject.title);
    subject.title = 'Título actualizado durante el desarrollo';
    await writeFile(file, JSON.stringify(subject));
    await expectPage(subject.title);
    const added = path.join(root, 'content/bimestres/b9.json');
    const bimester = { id: 'b9', kind: 'bimestre', title: 'Bimestre temporal de prueba', order: 90 };
    await writeFile(added, JSON.stringify(bimester));
    await expectPage(bimester.title);
    await rm(added);
    await expectPage(bimester.title, false);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
