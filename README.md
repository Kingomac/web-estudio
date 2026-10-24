# Cuaderno IoT

Web estática de estudio para el máster MUIoT 2026/27: lecturas, tests aleatorios y ejercicios con citas a los PDF originales. El contenido lo prepara un agente LLM a partir de las rutas locales que indique el usuario.

- [Arquitectura y decisiones](docs/arquitectura.md)
- [Manual de autoría](docs/autoria.md) e [instrucciones del agente](AGENTS.md)
- [Catálogo académico 2026/27](docs/catalogo-academico-2026-27.md)

## Ejecutar

Requiere la versión de Bun de `.bun-version`.

```bash
bun install --frozen-lockfile
bun run dev          # http://127.0.0.1:4321/web-estudio/
bun run build && bun run preview   # sitio compilado, servido con Bun.serve
```

## Verificar

```bash
bun run test:install       # una vez; añade --with-deps en Linux sin bibliotecas de Firefox
bun run check:content      # cambios solo en content/ o public/materiales/
bun run check              # cualquier otro cambio; es lo que ejecuta CI
```

`check:content` ejecuta unitarias, validación de contenido y PDF, compilación y revisión de enlaces y anclas del HTML. `check` añade `astro check` y las E2E en Firefox. `bun check` es un comando de Bun, no el del proyecto. La impresión paginada y la exactitud académica se revisan a mano.

## Publicación

**Pendiente (24/10/2026):** de momento la web se usa en local. Se desplegará de forma privada en Cloudflare Pages con Cloudflare Access (acceso por cuenta autorizada), subiendo `dist/` desde el PC con `wrangler pages deploy`. No se publica en GitHub Pages porque los PDF originales son material docente.

Falta: compilar con `BASE_PATH` adecuado, añadir el script de despliegue, retirar la publicación del workflow y configurar Access para producción y previsualizaciones. Pages limita cada archivo a 25 MiB.

`BASE_PATH` (por defecto `/web-estudio`) y `SITE_URL` configuran la base y el origen. La compilación solo depende del repositorio.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `content/` | Entidades JSON y cuerpos de lectura; una fuente editable por recurso. |
| `content/assets/` | Copia de calendarios para agentes; no entra en el sitio. |
| `public/materiales/` | Copias íntegras de los PDF originales. |
| `src/schemas/` | Contratos Zod; única definición de tipos. |
| `src/lib/` | Catálogo, rutas y registros compartidos por CLI y Astro. |
| `src/domain/` | Corrección y sesiones, funciones puras. |
| `src/client/` | Interacción en el navegador y guardado local. |
| `src/pages/`, `layouts/`, `components/` | Plantillas; no contienen temario. |
| `scripts/content/`, `scripts/calendar/` | CLI para agentes. |
| `tests/unit/`, `tests/e2e/` | `bun:test` y Playwright con Firefox. |
