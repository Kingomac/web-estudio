# Web de estudio: trabajo del agente

El usuario proporciona en su prompt una ruta de su PC y el objetivo de estudio. El agente lee esos archivos, organiza el catálogo, escribe lecturas y preguntas y verifica el resultado. El usuario no prepara JSON ni mueve materiales manualmente.

- Lee `docs/autoria.md` y consulta `bun run content:list --json` antes de crear contenido.
- Los calendarios son contexto para agentes; Google Calendar sigue siendo la agenda del usuario. Antes de planificar por fechas, ejecuta `bun run calendar:sync` y consulta `calendar:query --from AAAA-MM-DD --to AAAA-MM-DD --json`. Usa `calendar:sources --json` para conocer IDs, alcance y vigencia. Si una fuente falla, indica la última sincronización; no deduzcas ausencia de entregas, disponibilidad personal ni tareas completadas a partir de una consulta vacía.
- Las rutas externas son entradas de autoría. Conserva intactos los originales. Copia los PDF incorporados mediante `content:import`; la web y la compilación solo dependen del repositorio.
- `content/` contiene el contenido editable; `src/` contiene la aplicación. Nunca edites `dist/`.
- Reutiliza IDs y tags existentes. No reutilices el ID de una pregunta para una pregunta distinta. Consulta `content:impact` antes de cambiar recursos compartidos.
- Cita páginas físicas reales, contadas desde 1. Lee y comprueba el material antes de redactar. Nunca inventes citas, explicaciones o guías para superar la validación.
- Cada alternativa necesita una explicación. Los tests guardan una selección explícita de preguntas y se mezclan al iniciar.
- Declara los componentes de una lectura en `componentIds`; las relaciones inversas se calculan automáticamente.
- Los esquemas de `src/schemas/content.ts` son la única definición de contratos. CLI y Astro comparten `src/lib/catalogo.ts`.
- Los correctores de `src/domain/` son funciones puras. No importan Astro, DOM, archivos ni almacenamiento.
- Usa la versión de Bun de `.bun-version` y `bun install --frozen-lockfile`. `bun.lock` es el único archivo de bloqueo; actualízalo con Bun cuando cambien las dependencias.
- `bunfig.toml` fuerza Bun también para Astro y Playwright. En herramientas locales, aprovecha Bun Shell, `Bun.file` y `Bun.spawn` cuando simplifiquen el trabajo. Conserva las escrituras exclusivas (`wx` y `COPYFILE_EXCL`) para no sobrescribir contenido.
- Ejecuta `bun run check` antes de dar por válido un cambio. Incluye tipos estrictos, unitarias, validación, compilación y E2E con Firefox bajo `/web-estudio/`. `bun test` ejecuta solo las unitarias; `bun run check` es la comprobación completa del proyecto.
- La revisión académica y la impresión paginada requieren inspección adicional; las pruebas automáticas no las sustituyen.

- Usa TypeScript estricto; deriva los tipos desde Zod. No uses `any` ni desactives el comprobador para resolver errores.
