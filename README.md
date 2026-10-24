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

`check:content` es la comprobación para cambios que solo afectan a `content/` o `public/materiales/`: unitarias, validación de contenido y PDF, compilación y revisión del HTML, sin `astro check` ni E2E.

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

## Calendarios como contexto para agentes

Google Calendar sigue siendo la agenda del usuario. El repositorio conserva los 16 calendarios de Google y la exportación de Moovi como conocimiento temporal para agentes: permiten consultar clases, entregas y fechas al organizar el estudio. No hay una vista de calendario en la web ni un servicio de actualización en el navegador.

`content/assets/calendario-fuentes.json` registra las fuentes; `content/assets/calendario.json` contiene su última copia normalizada, con procedencia y fechas de sincronización. Son datos auxiliares, separados del catálogo académico y no incluidos en el sitio compilado. Los contratos se definen en `src/schemas/content.ts`.

```bash
bun run calendar:sync
bun run calendar:sources --json
bun run calendar:query --from 2026-10-26 --to 2026-11-01 --json
bun run calendar:query --from 2026-10-26 --to 2026-11-01 --search protocolos --json
bun run calendar:check
bun run check
```

El agente sincroniza cuando necesita usar fechas para planificar y después consulta la copia local. No hay sincronización periódica ni es necesario compilar o publicar para actualizar este contexto. La consulta no accede a la red; devuelve los eventos, las fuentes, su alcance y avisos de datos antiguos, fallos o detalles limitados. Las fechas del filtro son inclusivas y se interpretan en Madrid. Sin filtros temporales se consultan hoy y los 13 días siguientes. `--source ID,ID` filtra por IDs de fuente; `--search TEXTO` busca en título, nombre de fuente y lugar, sin distinguir mayúsculas ni tildes. `--root RUTA` permite consultar otra copia del repositorio.

El enlace privado de Moovi está únicamente en `MOOVI_CALENDAR_URL`, dentro de `.env.local` (ignorado por Git, permisos locales restringidos) o en el entorno del agente. No uses un prefijo `PUBLIC_`. Nunca guardes el enlace en JSON, HTML ni documentación. Los ICS originales solo se inspeccionan en `.cache/`, también ignorada. El contexto conserva título, fecha, horario, lugar y enlaces de actividad permitidos; omite descripciones, asistentes y organizadores. No almacena credenciales. Los eventos se modifican en sus fuentes originales.

Si una fuente falla, se conserva su última copia y se marca como no actualizada; una descarga válida vacía elimina sus eventos. La escritura del conjunto es atómica. El comando devuelve código 1 si alguna fuente falla, sin imprimir URLs privadas ni errores que puedan contenerlas. Los eventos recurrentes se expanden dentro del curso 2026/27, con sus excepciones y zonas horarias declaradas; una zona desconocida falla en vez de inventar un horario.

Moovi ofrece eventos recientes y próximos 60 días desde la sincronización, no todo el curso. Una consulta vacía no demuestra que no haya obligaciones. Google debe permitir acceso público; para obtener títulos, el permiso debe ser «Ver todos los detalles de los eventos». Consulta [el uso del contexto temporal por agentes](docs/autoria.md#contexto-temporal-del-máster) antes de formular planes con estos datos.

## Publicación

**Decisión pendiente de implementar (24/10/2026):** la web se usará en local y, cuando se despliegue, será de forma privada en Cloudflare Pages protegida con Cloudflare Access (acceso por cuenta autorizada), subiendo `dist/` desde el PC con `wrangler pages deploy`. No se publicará en GitHub Pages: los PDF originales son material docente y no deben quedar públicos. Falta adaptar `BASE_PATH`, añadir el script de despliegue, retirar la publicación del workflow y configurar Access para el dominio de producción y las previsualizaciones. Pages limita cada archivo a 25 MiB. Mientras tanto, lo que sigue describe el estado actual.

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
