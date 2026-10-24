# Web de estudio: trabajo del agente

El usuario indica en su prompt una ruta de su PC y un objetivo de estudio. El agente lee esos archivos, organiza el catálogo, escribe lecturas y preguntas y verifica el resultado. El usuario no prepara JSON ni mueve materiales.

## Contenido

- Lee `docs/autoria.md` y consulta `bun run content:list --json` antes de crear contenido.
- Las rutas externas son entradas de autoría: no modifiques los originales. Incorpora los PDF con `content:import`; la web solo depende del repositorio.
- Lee y comprueba el material antes de redactar. Cita páginas físicas reales, contadas desde 1. Nunca inventes citas, explicaciones o guías para superar la validación.
- Reutiliza IDs y tags existentes. No reutilices el ID de una pregunta para otra distinta. Consulta `content:impact` antes de cambiar recursos compartidos.
- Cada alternativa necesita una explicación. Los tests guardan una selección explícita de preguntas.
- Declara en `componentIds` los componentes de una lectura; las relaciones inversas se calculan solas.
- Antes de planificar por fechas, ejecuta `bun run calendar:sync` y consulta `calendar:query`. Una consulta vacía no demuestra ausencia de entregas (ver `docs/autoria.md`).

## Código

- `content/` es contenido editable y `src/` la aplicación. Nunca edites `dist/`.
- `src/schemas/content.ts` es la única definición de contratos; CLI y Astro comparten `src/lib/catalogo.ts`.
- `src/domain/` contiene funciones puras: sin Astro, DOM, archivos ni almacenamiento.
- TypeScript estricto con tipos derivados de Zod. Sin `any` ni desactivar el comprobador.
- Usa Bun (`.bun-version`) e instala con `bun install --frozen-lockfile`; `bun.lock` es el único bloqueo. Conserva las escrituras exclusivas (`wx`, `COPYFILE_EXCL`) que evitan sobrescribir contenido.

## Verificación

- Solo cambios en `content/` o `public/materiales/`: `bun run check:content`.
- Cualquier otro cambio: `bun run check` (añade tipos y E2E en Firefox bajo `/web-estudio/`).
- La revisión académica y la impresión paginada requieren inspección manual.
