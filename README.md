# Cuaderno IoT

Web de estudio estática con Astro, TypeScript estricto, contenido MDX/Astro y práctica en el navegador. El contenido lo prepara un agente LLM a partir de las rutas locales que indique el usuario.

## Ejecutar

Requiere Bun 1.4.4, indicado en `.bun-version`. Si acabas de instalarlo, abre una terminal nueva para cargar su ruta.

```bash
bun install --frozen-lockfile
bun run dev
```

Abre la dirección que imprime Astro, normalmente `http://127.0.0.1:4321/web-estudio/`.

## Verificar

```bash
bun run test:install
bun run check
```

`check` comprueba tipos, ejecuta las unitarias, valida contenido y PDF, compila, revisa enlaces y anclas del HTML y ejecuta los flujos E2E en Firefox. `bun run test:e2e` requiere un `dist/` actualizado. Para Linux sin las bibliotecas de Firefox, usa `bun run test:install --with-deps`.

Usa `bun run check` para esta verificación completa. `bun check` es un comando propio de Bun y no ejecuta el script del proyecto. El comprobador de tipos de Astro sigue siendo necesario para validar también los componentes `.astro`.

Para revisar la web compilada, ejecuta `bun run build` y `bun run preview`. La previsualización usa `Bun.serve`, queda vinculada a `127.0.0.1:4321` y termina con Ctrl+C.

## Autoría desde archivos del PC

El usuario da al agente una ruta y un objetivo, por ejemplo: «Prepara una lectura y 20 preguntas con los materiales de `/ruta/a/mi/asignatura/`».

El agente inspecciona la ruta, lee las fuentes, consulta el catálogo, incorpora los originales relevantes, escribe el contenido, verifica las citas y ejecuta las comprobaciones. Los archivos de origen permanecen intactos; el sitio se reconstruye con los archivos del repositorio.

```bash
bun run content:inspect --source '/ruta/a/los/materiales' --json
bun run content:list --subject protocolos --json
bun run content:show protocolos.apuntes.ipv6-y-vecinos --json
bun run content:impact protocolos.materiales.tema-3-ip-en-iot --json
bun run content:check --json
```

Consulta [el manual de autoría](docs/autoria.md) y [las instrucciones del agente](AGENTS.md).

## Primer incremento

Incluye cuatro bimestres, la ficha de Protocolos, un original PDF, una lectura Astro con visual NDP, un resumen MDX, un test con los tres tipos de pregunta, un formulario y un taller. Es una muestra funcional; el resto del temario y de las asignaturas se incorpora progresivamente desde sus fuentes.

Las fuentes de esta muestra son las páginas físicas 9 y 39 del PDF original de Tema 3. Los recursos muestran su alcance parcial. Las guías de otras asignaturas todavía pendientes de verificación permanecen en el inventario documental.

La impresión cuenta con estilos A4 y alternativas estáticas. La prueba automatizada verifica visibilidad con CSS de impresión; la revisión de los cortes en la salida paginada de Firefox sigue siendo manual.

## Publicación

La base por defecto es `/web-estudio`. `BASE_PATH` permite cambiarla, y `SITE_URL` configura el origen de la web. La compilación no necesita los archivos externos del PC ni acceso a las universidades.

El workflow de GitHub valida pull requests y cambios en `main`. La publicación se inicia manualmente con `publish: true` después de configurar Pages para usar GitHub Actions. El workflow obtiene el dominio y la base del repositorio. No se ha conectado ni publicado ningún repositorio remoto desde este checkout.

## Estructura

- `content/`: entidades JSON y cuerpos de lectura; una fuente editable por recurso.
- `public/materiales/`: copias íntegras de originales incorporados.
- `src/schemas/`: contratos Zod y tipos derivados.
- `src/lib/catalogo.ts`: descubrimiento y relaciones compartidos por CLI y Astro.
- `src/domain/`: corrección y sesiones sin DOM ni almacenamiento.
- `src/client/`: interacción y guardado local con recuperación en memoria.
- `scripts/content/`: herramientas para el agente.
- `scripts/build.ts` y `scripts/check.ts`: secuencias con Bun Shell que se detienen ante cualquier error.
- `scripts/serve-built.ts`: servidor local de previsualización y E2E con `Bun.serve`.
- `tests/`: unitarias y E2E Firefox.

La versión de TypeScript está fijada en 6.0.3, compatible con `astro check`. Las dependencias se fijan en `bun.lock` y Bun 1.4.4 en `.bun-version` y `package.json`. `bunfig.toml` fuerza el motor de Bun para Astro, Playwright y sus procesos hijos. Las unitarias usan `bun:test`; `bun test` solo descubre `tests/unit/`.

Las herramientas locales usan `Bun.file`, `Bun.spawnSync` y Bun Shell. Las escrituras de autoría siguen usando `node:fs`, implementado por Bun, para conservar la creación exclusiva de archivos y evitar sobrescrituras. Los contratos y correctores permanecen independientes del motor de ejecución.
