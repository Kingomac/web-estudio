# Guía de diseño

Interfaz sobria para estudiar: fondo neutro, un color de acento y dos estados de resultado. Cada página nueva se monta con las piezas de esta guía; si algo no encaja, se amplía la guía antes de inventar estilos sueltos.

## Principios

- **Jerarquía con tamaño y peso, no con color.** El acento marca lo interactivo y lo activo; el verde y el rojo solo indican acierto y error.
- **Un único botón primario por bloque.** El resto, `button--secondary` o `button--ghost`.
- **Texto legible.** Mínimo 13 px (`--text-xs`), lecturas a 17 px con columna de `--measure` (70ch). Contraste AA en texto secundario.
- **Mayúsculas por CSS.** Los textos se escriben en minúscula normal; `.eyebrow` los transforma.
- **Accesible e imprimible.** Foco visible, objetivos táctiles de 40–44 px en móvil, `prefers-reduced-motion`, y todo lo que no sea contenido lleva `.no-print`.

## Tokens

`src/styles/tokens.css` es el único archivo con colores, tamaños y fuentes literales; `print.css` solo los redefine para papel. Fuera de ellos se usa `var(--…)`.

| Grupo | Tokens | Uso |
| --- | --- | --- |
| Superficies | `--color-bg`, `--color-surface`, `--color-surface-muted` | Fondo de página, tarjetas y zonas secundarias (barra lateral, código, cabeceras de tabla). |
| Bordes | `--color-border`, `--color-border-strong`, `--color-border-input` | Separadores, bordes de controles y de campos (3:1 de contraste). |
| Texto | `--color-text`, `--color-text-muted` | Principal y secundario. |
| Acento | `--color-accent`, `-hover`, `-soft`, `--color-on-accent` | Enlaces, botones, elemento activo y fondos suaves de selección. |
| Estados | `--color-success(-soft)`, `--color-danger(-soft)` | Solo corrección de respuestas. |
| Diagramas | `--color-packet-*`, `--color-seg-1` … `-6`, `--color-zone-1/2` | Tipos de paquete NDP, segmentos de bytes y enlaces de red. |
| Tipo | `--text-xs` … `--text-2xl`, `--weight-*`, `--leading-*` | 13, 14, 16, 17, 19, 24 y 34 px. |
| Espacio | `--space-1` … `--space-8` | 4, 8, 12, 16, 24, 32, 48 y 64 px. |
| Forma | `--radius-sm` (controles), `--radius` (tarjetas), `--radius-pill` (chips), `--shadow`, `--shadow-raised` | |

La fuente es Inter, servida desde el paquete `@fontsource-variable/inter` (sin peticiones externas).

## Estructura del CSS

- **Entrada a una asignatura:** abre la sección Apuntes. La navegación ofrece secciones por tipo de recurso, sin un listado combinado de todos los materiales.
- **Lectura en escritorio:** menú principal plegable, índice pegado al margen izquierdo y columna de texto de ancho legible. Con el menú oculto y espacio suficiente, el texto se centra en la pantalla; título, herramientas y fuentes se alinean con él. La preferencia del menú se conserva entre páginas y no cambia el menú móvil.
- **Tests en móvil:** preguntas como secciones a todo el ancho, separadas por líneas, sin marco ni sombra de tarjeta. Enunciados, opciones y correcciones pueden partir palabras largas; los controles de respuesta aprovechan el ancho disponible.

`src/styles/global.css` declara las capas en orden; cada capa posterior gana a la anterior:

```text
tokens → base → components → layout → prose → print     (luego los <style> de componentes, sin capa)
```

| Archivo | Contiene |
| --- | --- |
| `base.css` | Estilos de elementos (`h1`, `a`, `pre`…) y ayudas de accesibilidad. Sin clases de diseño. |
| `components.css` | Primitivas compartidas (tabla siguiente). |
| `layout.css` | Barra lateral, columna principal, migas, cabecera de página y pie. |
| `prose.css` | Cuerpos de lectura dentro de `.prose`. |
| `print.css` | A4 y `.no-print`. |

Los estilos propios de un componente van en su `<style>` (con ámbito de Astro) y solo usan tokens. Sus ajustes de impresión, en un `@media print` dentro del mismo componente.

## Primitivas

| Clase | Para |
| --- | --- |
| `.eyebrow` | Etiqueta superior o título de grupo pequeño. |
| `.meta` | Texto secundario: descripciones, recuentos, notas. |
| `.lead` | Primer párrafo o enunciado destacado. |
| `.button` + `--secondary`, `--ghost`, `--small` | Acciones. Un `<a>` con aspecto de botón también usa `.button`. |
| `.actions` | Fila de botones con su mensaje de estado. |
| `.chip-group`, `.chip[aria-pressed]` | Filtros conmutables. |
| `.tag-list`, `.tag` | Etiquetas de un recurso (enlace o texto). |
| `.badge` + `--neutral`, `--success`, `--danger` | Tipo de recurso, tipo de pregunta, resultado de una opción. |
| `.panel`, `.panel--muted` | Tarjeta blanca o bloque secundario (preguntas, formularios, visuales). |
| `.callout` | Nota destacada dentro de una lectura o una corrección. |
| `.row-list` | Lista de filas separadas por líneas. |
| `.empty-state` | Mensaje de lista vacía. |
| `.section`, `.section-title` | Bloque secundario al final de una página (fuentes, relaciones). |
| `.tabs` | Navegación entre páginas hermanas con `aria-current`. |
| `.field`, `.field-label`, `.field-hint`, `.input` | Campos de formulario. |
| `.status` + `is-correct` / `is-incorrect` | Mensaje de resultado que escribe el cliente. |
| `.visually-hidden`, `.no-print` | Solo para lectores de pantalla y oculto al imprimir. |

## Componentes Astro

| Componente | Uso |
| --- | --- |
| `layouts/Site.astro` | Toda página: barra lateral, migas (si hay asignatura) y pie. |
| `layouts/Resource.astro` | Página de un recurso: cabecera con vuelta a la sección, alcance y etiquetas. |
| `layouts/Reading.astro` | Lectura: barra de impresión, índice lateral, `.prose`, fuentes y relaciones. |
| `ui/PageHeader.astro` | Cabecera de cualquier página: `eyebrow`, `title`, `description`, `back` y contenido extra en el slot. |
| `ui/SectionTabs.astro` | Pestañas de las secciones de una asignatura. |
| `ui/TagList.astro` | Etiquetas de un recurso; con `linkTo` enlazan al filtro. |
| `ResourceList`, `ResourceRow`, `SubjectRow` | Listados de recursos y tarjetas de asignatura. |
| `Sources`, `Relations` | Fuentes originales (normal o `prominent` dentro de una corrección) y recursos relacionados. |
| `ui/HexDump.astro` | Volcado hexadecimal con inspector de offset, hex, decimal y binario. |
| `Practice`, `FormExercise`, `lectura/*` | Actividades y laboratorios interactivos. |

## Reglas para código nuevo

- **Página nueva:** `Site` (o `Resource`) + `PageHeader` + primitivas. Si una pieza se repite en dos páginas, se convierte en componente en `src/components/ui/`.
- **Nombres:** `bloque`, `bloque-parte`, `bloque--variante`; estados con `is-*` (`is-active`, `is-current`, `is-correct`, `is-incorrect`, `is-right`) o atributos ARIA (`aria-pressed`, `aria-current`). El JavaScript cambia estados, nunca estilos en línea.
- **Selectores de pruebas:** los E2E usan roles, textos, `data-*` y algunas clases (`.sources`, `.toc`, `.prose`, `.sidebar`…). Al renombrar, ejecuta `bun run check`.
- **Laboratorios de lectura** (`src/components/lectura/`): envolver en `ui/LabFrame.astro` y usar las primitivas `.lab-controls`, `.lab-output`, `.metrics`, `.byte-bar`, `.bit-fields` y `.lab-note`. Lo interactivo lleva `.no-print`; la alternativa estática es un `details.lab-all` con los casos completos (se abre al imprimir). El HTML que genera el cliente no recibe el ámbito de Astro: sus estilos van en `:global()` o en primitivas. Los colores de diagramas salen de `--color-packet-*`, `--color-seg-*` y `--color-zone-*`; solo las anchuras proporcionales se escriben en línea.

## Contenido

Los cuerpos `body.mdx` y `body.astro` usan HTML semántico (`h2`, `h3`, listas, `pre`, `table`, `details`) y solo estas clases: `lead` (párrafo inicial), `callout` (nota), `table-scroll` (envoltorio de tabla), `no-print` (referencias que solo se muestran en pantalla). Las citas independientes llevan `no-print` en el párrafo; si comparten párrafo con una explicación, se marca solo la cita con un `span` para conservar la explicación al imprimir. El listado final de fuentes de los apuntes también se oculta en papel. Nada de `style` ni colores. Lo que necesite más diseño se convierte en componente registrado.
