# Arquitectura y decisiones

Registro de qué se decidió y por qué. El uso diario está en el [README](../README.md) y los formatos en el [manual de autoría](autoria.md). Diseño acordado el 19/10/2026; implementación desde el 22/10/2026.

## Objetivo

Estudiar el máster MUIoT 2026/27 con lecturas, tests y ejercicios generados por agentes a partir de los materiales del usuario. Añadir una lectura, una pregunta o un PDF debe ser una tarea local y predecible: archivos pequeños con contratos claros, validados, que generan sus páginas y enlaces automáticamente.

**Fuera de alcance:** cuentas, sincronización, CMS, corrección con IA, temporizadores, buscador, SPA, varios cursos, flujo borrador/publicado, historial de intentos y migración de progreso. Todo el contenido incorporado se publica; sus límites se expresan en `scope`.

## Tecnología

| Decisión | Motivo |
| --- | --- |
| Astro estático | Plantillas y páginas derivadas del contenido sin servidor. HTML, CSS y JS sin compilar obligaría a mantener índices y navegación a mano. |
| TypeScript estricto, JS vanilla en el navegador, CSS vanilla | Ningún framework de interfaz aporta valor aquí. Los componentes interactivos son Custom Elements. |
| CSS por capas con tokens | Tokens, primitivas compartidas y estilos con ámbito por componente mantienen la coherencia sin un framework CSS ([guía de diseño](diseno.md)). Inter se sirve desde el propio sitio. |
| Zod como única definición de contratos | Astro, la CLI y las pruebas validan lo mismo; los tipos se derivan de los esquemas. |
| Bun para scripts y herramientas, versiones fijadas | Un solo motor y un solo bloqueo (`bun.lock`). |

## Capas

```text
content/ + PDF → catálogo validado (src/lib/catalogo.ts) → páginas estáticas → JS por actividad → dominio puro + localStorage
```

| Capa | Responsabilidad | No depende de |
| --- | --- | --- |
| Contenido | Textos, preguntas, datos de ejercicios, citas. | Código ejecutable, DOM. |
| Catálogo | Carga, validación cruzada, relaciones directas e inversas, rutas. | Astro (lo comparten CLI y Astro). |
| Dominio | Corrección, mezcla y sesiones. | DOM, Astro, almacenamiento, red. |
| Componentes | HTML accesible y presentación de resultados. | Reglas de corrección propias. |
| Cliente | Leer controles, llamar al dominio, guardar estado. | El catálogo completo o todos los talleres. |

Los laboratorios de lectura siguen un patrón fijo: cálculo puro en `src/domain/`, vistas HTML compartidas por Astro (estado inicial, imprimible) y cliente (actualización), y un `details` con los casos completos como alternativa estática. No hay sistema de plugins ni lenguaje de ejercicios en JSON. Los comportamientos nuevos son módulos concretos registrados explícitamente (`registro.ts`, `talleres.ts`) y se extraen a compartidos solo cuando hay reutilización real.

## Modelo de contenido

- **Organización.** Asignaturas agrupadas por bimestre. Los archivos van por asignatura, sin bimestre en la ruta, para que cambiarla de bimestre no rompa nada. Dentro de cada asignatura, secciones por tipo (apuntes, resúmenes, tests, ejercicios, material original) y tags de tema o estudio. El filtro es «Todos» o un único tag (`?tag=`), sin combinaciones.
- **Lecturas.** Metadatos en `recurso.json` y cuerpo MDX (prosa) o Astro (HTML complejo, visuales). Así los metadatos no se definen de dos formas. Los cuerpos se resuelven con `import.meta.glob` porque el cargador de contenido de Astro no carga `.astro`.
- **Preguntas y tests.** Banco de preguntas en archivos independientes y tests con listas explícitas. La composición es fija y revisable; añadir preguntas al banco no altera tests existentes.
- **Materiales.** Los PDF se copian íntegros con hash y número de páginas. Una edición distinta recibe otro ID para que las citas antiguas sigan apuntando al documento correcto.
- **Relaciones.** Solo explícitas por ID: tests → preguntas, citas → materiales, `readingReferences`, `relatedResourceIds`, `componentIds`. Las inversas («Utilizado en») se calculan, nunca se mantienen a mano. `content:impact` recorre el grafo con nodos visitados para admitir ciclos.

## Práctica

- **Mezcla obligatoria.** Al iniciar o reiniciar se barajan grupos, preguntas y opciones (Fisher–Yates sin mutar el banco, aleatoriedad inyectable para pruebas). En ordenar, la disposición inicial nunca coincide con la solución. El orden se mantiene durante la sesión. Todo se asocia por ID, nunca por posición.
- **Corrección completa.** Al comprobar se muestra la explicación general y la de cada alternativa, se acierte o no, con enlace a la página del original. Solo cuenta como acierto la respuesta completa; reintentos ilimitados sin penalización.
- **Ejercicios.** Formularios declarativos con corrección por campo (tolerancias numéricas explícitas, normalización de texto declarada) o talleres programados. Sin `eval` ni funciones en los datos.
- **Progreso.** Secundario. `localStorage` guarda solo la sesión actual por actividad, con una revisión derivada de su contenido: si cambia, se descarta. Si el almacenamiento falla, se practica en memoria.

## Lectura e impresión

Scroll continuo, columna de 65–75 caracteres e índice lateral ocultable generado desde los encabezados, accesible por teclado y sin JavaScript. Interfaz responsive; un visual complejo puede tener ancho mínimo dentro de su contenedor. Las animaciones son paso a paso, respetan `prefers-reduced-motion` y tienen explicación textual.

Todas las lecturas se imprimen con `print.css`: A4, sin navegación ni controles, `details` abiertos con `beforeprint`, y cada visual con una alternativa estática ya presente en el HTML. `printIntent: paper` indica que la densidad está revisada para papel. La paginación real de Firefox se revisa a mano.

## Pruebas

| Nivel | Cubre |
| --- | --- |
| `content:check` | Esquemas, referencias, tags, soluciones, grupos, cuerpos, hash y páginas de PDF. |
| Unitarias (`bun:test`) | Corrección, mezcla, sesiones, catálogo, autoría, calendarios y recarga en `dev`. |
| `check-built` | Enlaces, assets y anclas del HTML bajo la base de despliegue. |
| E2E (Playwright, Firefox) | Navegación, filtro, índice, los tres tipos de pregunta, formularios, reset, almacenamiento roto, móvil, sin JS e impresión emulada. |

No se escribe una prueba por pregunta: la validación cubre todo el banco. Los enlaces externos (guías docentes) se revisan aparte. Los cambios solo de contenido usan `check:content`; CI ejecuta siempre `check`.

## Pendiente

- **Despliegue privado** en Cloudflare Pages con Access (ver README). Sustituye a GitHub Pages porque los PDF originales no deben quedar públicos.
- **Revisión manual de Protocolos** (migrada el 24/10/2026): impresión paginada de los apuntes con laboratorios y exactitud de las 256 explicaciones por alternativa redactadas en la migración.
- **Guías docentes** marcadas como no verificadas en el [catálogo académico](catalogo-academico-2026-27.md).
- **Ampliaciones previstas, sin implementar:** fórmulas e imágenes en enunciados, «Ver todos» en listas largas de relaciones, PDF derivados de las lecturas en `public/descargas/`.
