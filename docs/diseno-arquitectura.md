# Diseño de arquitectura de la web de estudio

Diseño de referencia, con decisiones acordadas y propuestas pendientes. Revisión inicial: 19 de octubre de 2026. Implementación iniciada el 22 de octubre de 2026; se adopta TypeScript estricto por decisión del usuario. El alcance ejecutable actual se describe en README.md y docs/autoria.md.

La tecnología acordada es **Astro con generación estática, cuerpos MDX o Astro, TypeScript compilado a JavaScript vanilla y CSS vanilla**. También queda acordado que cada pregunta debe ofrecer una corrección completa: explicar la solución y justificar todas las alternativas. El contenido se organiza por asignaturas; los bimestres son una clasificación del catálogo. Los apuntes y resúmenes producen HTML completo, los tests utilizan preguntas declarativas y los talleres permiten código específico. Los PDF originales se conservan como materiales propios de cada asignatura y sirven como fuentes citables.

El objetivo es que añadir una lectura, una pregunta o un PDF sea una tarea local y predecible para una persona o un agente LLM: crear archivos pequeños con contratos claros, validarlos y obtener automáticamente sus páginas y enlaces. La lógica compartida, la presentación y el contenido deben poder evolucionar por separado.

El [plan de mantenimiento y evolución](mantenimiento-y-evolucion.md) concreta las prioridades acordadas: herramientas para agentes, dependencias de contenido accesibles en la interfaz, aleatoriedad y pruebas unitarias y E2E en Firefox. La conservación del progreso es secundaria y no requiere migraciones.

## Alcance y decisiones principales

| Necesidad | Decisión propuesta |
| --- | --- |
| Sitio estático en GitHub Pages | Generar HTML, CSS, JS y archivos descargables en compilación; sin servidor de aplicación. |
| Asignaturas clasificadas por bimestres | Catálogo de bimestres y ficha de asignatura con referencia a su bimestre. |
| Organización interna | Tags múltiples por recurso, incluidos tags de tema y de preparación de exámenes. |
| Lectura continua | Scroll normal, sin paginación, y tabla de contenido siempre disponible en un menú lateral ocultable. |
| Guía docente por asignatura | Enlace obligatorio para publicar la asignatura; edición académica identificada. |
| Apuntes y resúmenes | Documentos con una única fuente editable y un layout común de lectura. |
| Apuntes vivos | Componentes interactivos independientes, con explicación estática equivalente. |
| Clasificación de impresión | `printIntent: paper` o `screen`; ambos deben imprimirse correctamente. |
| Tests sin tiempos | Comprobación por pregunta, explicaciones, reintentos y grupos opcionales. |
| Corrección completa | Explicar por qué cada alternativa es correcta o incorrecta, tanto si el usuario acierta como si falla. |
| Respuestas fallidas | Enlace visible a la referencia concreta en los apuntes originales. |
| Puntuación | Un acierto solo si la respuesta completa es correcta; sin puntuación parcial. |
| Reintentos y progreso | Reintentos ilimitados; guardado local mínimo de baja prioridad, reiniciable por test o ejercicio y descartable tras cambios. |
| Orden de los tests | Preguntas y opciones aleatorias en cada nueva sesión; asociación por ID y orden estable durante esa sesión. |
| Dependencias de contenido | Referencias explícitas, relaciones inversas calculadas y enlaces contextuales accesibles desde la interfaz. |
| Alcance | Campo `scope` obligatorio que delimita qué cubre cada recurso. |
| Publicación | Todo el material incorporado forma parte del sitio; sin estados editoriales de publicación. |
| Pruebas | Unitarias y E2E en Firefox obligatorias antes de desplegar. |
| Curso académico | Únicamente 2026/27, sin selector de cursos ni gestión de ediciones académicas. |
| Búsqueda | No se incluye buscador; navegación mediante tags y tipos de recurso. |
| Tipos de pregunta | Respuesta única, respuesta múltiple y ordenar. |
| Ejercicios abiertos | Formularios declarativos y talleres programados como dos modalidades. |
| Material proporcionado | Catálogo de PDF originales con apertura, descarga, procedencia y citas por página. |
| Autoría con LLM | Parte esencial de la arquitectura: CLI de creación, consulta de dependencias, validación, esquemas únicos, ejemplos y documentación operativa. |

El alcance no incluye cuentas, sincronización, un CMS, corrección mediante IA, temporizadores, buscador ni una aplicación de página única. El guardado local se mantiene mínimo y secundario; no condiciona el diseño del motor ni exige conservar respuestas tras actualizar el contenido. Las consultas al código y contenido del repositorio mediante agentes quedan fuera de la interfaz de la web. El funcionamiento sin conexión después de cerrar el navegador y la apertura directa con `file://` no se presuponen: el destino es una web servida por HTTP, localmente o en Pages.

## Elección tecnológica

| Alternativa | Ventajas para este proyecto | Coste y limitaciones |
| --- | --- | --- |
| HTML, CSS y JS sin compilación | Inicio sencillo; máxima cercanía al proyecto de Protocolos. | Hay que mantener navegación, índices, layouts y validación con convenciones o herramientas propias. La duplicación aumenta con las asignaturas. |
| Astro estático y JS vanilla | Plantillas comunes, páginas generadas desde contenido, componentes de lectura y scripts por página. | Utiliza Bun y un proceso de compilación durante el desarrollo y despliegue. |

**Se acuerda Astro**, conservando TypeScript compilado a JavaScript vanilla para el navegador. No son opciones excluyentes: Astro genera los documentos y los módulos de JS aportan la interacción. Astro permite crear componentes interactivos con elementos personalizados sin añadir un framework de interfaz. [Documentación de scripts de Astro](https://docs.astro.build/en/guides/client-side-scripts/).

Se acuerda CSS vanilla con variables de diseño, sin un framework de estilos. La implementación usa TypeScript estricto en esquemas, lógica, herramientas y scripts del navegador; los tipos de contenido se derivan de Zod. TypeScript comprueba el código y Zod valida los archivos de contenido en ejecución. No se propone incorporar React o Vue.

La configuración es explícitamente estática. Las versiones de Astro, Bun y las dependencias están fijadas en `package.json`, `.bun-version` y `bun.lock`. Los ejemplos de este documento describen contratos de la aplicación, no una configuración lista para ejecutar.

## Organización de la información

La navegación principal es:

```text
Inicio
└── Bimestre
    └── Asignatura
        ├── Guía docente
        ├── Apuntes
        ├── Resúmenes
        ├── Tests
        ├── Ejercicios
        └── Material original
```

Dentro de cada asignatura, el catálogo se recorre mediante **tags**, con selección de una etiqueta cada vez y accesos por tipo de recurso. Los temas son tags, no carpetas ni pasos obligatorios de un itinerario. Cada apunte, resumen, test, ejercicio o material puede llevar varios tags y conservar una única página y un único estado de progreso. Los recursos de varios temas, parciales o asignatura completa son casos habituales de autoría.

Los tags pertenecen a la asignatura y tienen ID estable, título, tipo (`topic` o `study`) y orden. `topic` representa un tema; `study` permite etiquetas como «Primer parcial» o «Repaso final». Un resumen de IPv6 y LoWPAN lleva ambos tags de tema y, si corresponde, el del parcial. Las etiquetas temáticas de un test reflejan la unión de las de sus preguntas; sus tags de estudio se declaran en el test. Ninguna pregunta pierde sus propios tags al formar parte de un grupo.

El modelo de filtrado es simple: **Todos** o **un tag activo**. Pulsar otro tag sustituye al anterior; no hay selección múltiple ni operadores AND/OR. La navegación por tipo se resuelve con las secciones existentes, sin un constructor de filtros. Los recursos siguen admitiendo múltiples tags: un resumen de varios temas aparece al consultar cualquiera de sus etiquetas, con una única página. Los listados se ordenan por `order` y después por título; esta ordenación del catálogo es independiente del orden aleatorio de los tests. Un recurso global declara los tags que realmente cubre y describe sus límites en `scope`.

Los archivos se agrupan físicamente por asignatura, sin introducir el bimestre en sus rutas. Así, cambiar una asignatura de bimestre no obliga a mover sus materiales ni rompe enlaces. La ficha del bimestre contiene identificador, nombre y orden; las fechas son opcionales. No se deduce el bimestre a partir del mes actual.

El único curso del sitio es **2026/27**. Se registra una vez en la configuración del catálogo y se conserva en la procedencia de materiales y guías cuando sea necesario. No se introducen rutas por año, selector de curso ni una entidad de ediciones. Las asignaturas y enlaces oficiales recopilados están en [Catálogo académico 2026/27](catalogo-academico-2026-27.md); Protocolos pertenece al primer bimestre. Una eventual ampliación a otro curso se decidirá si llega a necesitarse.

### Identificadores y rutas

Cada entidad tiene un identificador estable para referencias y progreso; cada recurso publicable tiene además un `slug` para su URL. Cambiar el título o el orden no cambia el identificador. Si cambia el `slug`, se registra la ruta anterior en `aliases` y se genera una página estática de redirección. Los aliases son rutas completas relativas a la raíz del sitio, sin la base de despliegue, y se validan contra colisiones.

Rutas propuestas, relativas a la base de despliegue:

```text
/
/bimestres/b1/
/asignaturas/protocolos/
/asignaturas/protocolos/apuntes/
/asignaturas/protocolos/apuntes/ip-en-iot/
/asignaturas/protocolos/resumenes/ipv6-esencial/
/asignaturas/protocolos/tests/repaso-ipv6/
/asignaturas/protocolos/ejercicios/cabeceras/
/asignaturas/protocolos/materiales/
/asignaturas/protocolos/materiales/tema-3-ip-en-iot/
```

Cada una de las cinco secciones de contenido tiene su índice y permite activar un único tag, igual que el catálogo de la asignatura. La etiqueta activa puede reflejarse en `?tag=tema-3`, sin generar combinaciones de filtros. Las lecturas tienen anclas estables por apartado. Una pregunta dentro de un test se puede enlazar con `#pregunta-<id-local>` y abrir directamente, conservando el contexto del grupo.

## Estructura del repositorio

La siguiente estructura es una propuesta; este documento no crea esos archivos.

```text
docs/
  diseno-arquitectura.md
  autoria.md                         # manual esencial de trabajo con contenido
AGENTS.md                            # instrucciones operativas para agentes
content/
  bimestres/
    b1.json
  asignaturas/
    protocolos/
      asignatura.json
      tags/
        ip-iot.json
      apuntes/
        ip-en-iot/
          recurso.json
          body.astro                 # HTML enriquecido del apunte
          assets/
      resumenes/
        ipv6-esencial/
          recurso.json
          body.mdx
      preguntas/
        ipv6-longitud.json
        tipos-de-direccion.json
        secuencia-mensajes.json
      tests/
        repaso-ipv6.json              # grupos y referencias a preguntas
      ejercicios/
        calcular-tamano/
          recurso.json               # campos, correctores y solución
        cabeceras/
          recurso.json               # referencia a taller programado
      materiales/
        tema-3-ip-en-iot.json         # ficha del PDF original
src/
  content.config.ts                  # colecciones y conexión con esquemas
  schemas/                           # contratos de contenido
  layouts/                           # sitio, asignatura y lectura
  components/
    lectura/                         # avisos, figuras, tablas, citas
    tests/                           # interfaz de los tres tipos
    ejercicios/                      # campos y devolución por campo
    materiales/                      # ficha, enlaces y visor opcional
    relaciones/                      # fuentes, utilizado en y lecturas relacionadas
  domain/
    evaluacion/                      # funciones puras de corrección
    sesiones/                        # estados de práctica
    protocolos/                      # reglas específicas de IPv6, etc.
  interactive/
    compartidos/                     # controles de pasos y reproducción
    protocolos/
      ndp/
      cabeceras/
  client/                            # adaptadores DOM y almacenamiento
  lib/
    catalogo.ts                      # consultas y relaciones directas e inversas
    dependencias.ts                  # análisis de impacto y proyección para la UI
    rutas.ts                         # URLs, base y anclas
    cuerpos.ts                       # descubrimiento de body.mdx y body.astro
    talleres.ts                      # registro explícito de talleres
  styles/                            # variables, lectura, componentes e impresión
  pages/                             # plantillas de rutas, sin temario incrustado
public/
  materiales/
    protocolos/
      tema-3-ip-en-iot.pdf
  descargas/                         # PDF derivados, si se ofrecen
templates/                           # ejemplos mínimos válidos para autoría
scripts/
  content/                           # CLI esencial de autoría, validación e impacto
tests/
  unit/                              # dominio, aleatoriedad, esquemas y dependencias
  e2e/                               # pruebas con Firefox sobre el sitio compilado
  fixtures/                          # casos pequeños reproducibles
.github/workflows/                   # validación y publicación futuras
```

`content/` contiene el temario y sus metadatos. `src/` contiene el sistema que lo representa y ejecuta. Los originales binarios se guardan en `public/materiales/`, separados de los PDF derivados y de los recursos visuales de las lecturas. `dist/` es resultado de compilación y no se edita ni se mantiene como una segunda fuente.

Un recurso habitual no requiere modificar `src/pages/`, registrar una tarjeta manualmente ni añadir una entrada en un índice global. Un taller nuevo con comportamiento propio sí incorpora código y una entrada en el registro de talleres; ese cambio debe ser visible y revisable.

## Contratos de contenido

### Catálogo y metadatos

| Entidad | Datos principales |
| --- | --- |
| Bimestre | `id`, `title`, `order`. |
| Asignatura | `id`, `slug`, `title`, `bimesterId`, `teachingGuide`, `order`; curso heredado del catálogo. |
| Tag | `id`, `slug`, `subjectId`, `title`, `type` (`topic` o `study`), `order`. |
| Recurso | `id`, `subjectId`, `kind`, `slug`, `title`, `description`, `scope`, `tagIds`, `order`. |
| Lectura | Recurso de tipo `apuntes` o `resumen`, más `body`, `printIntent`, `sources` y relaciones opcionales. |
| Material | Recurso de tipo `material`, más `file`, `format`, `origin`, `providedName`, `pageCount` cuando sea PDF. |
| Pregunta | `id`, `subjectId`, `tagIds`, `type`, enunciado, alternativas o elementos, solución, explicación, `originalReferences`, fuentes complementarias y enlaces opcionales a lecturas. |
| Test | Recurso de tipo `test`, más grupos y listas explícitas de preguntas; mezcla obligatoria al iniciar. |
| Ejercicio | Recurso de tipo `ejercicio`, más modalidad `form` o `workshop` y sus datos específicos. |

Los valores de `kind` son discriminantes del esquema; las rutas visibles usan los plurales de la navegación. **Todo el contenido incorporado al catálogo se utiliza y se incluye en el sitio**, sin campo `status` ni flujo de borrador/publicado. La compilación exige contenido válido y referencias resolubles. Los archivos de documentación y pruebas no forman parte del catálogo.

`scope` es texto editorial obligatorio en apuntes, resúmenes, tests, ejercicios y fichas de material. Explica temas, apartados o páginas cubiertos y los límites relevantes; no sustituye las citas estructuradas. Ejemplo: «Temas 1–3 y tema 4 hasta la página 37, incluida». Se muestra en la cabecera del recurso y en su ficha, para distinguir cobertura parcial de un tema completo. No se deduce el alcance a partir de los tags.

Cada asignatura publicada debe tener `teachingGuide.url` real, título y curso académico de la guía. Puede enlazar además una copia local mediante `materialId`, conservando el enlace institucional como referencia. Se distingue un enlace localizado en muiot.es de una guía cuya asignatura y curso se han verificado. Si un enlace conduce a otro curso o materia, se conserva la incidencia en la documentación y se resuelve antes de presentarlo como guía 2026/27 de esa asignatura.

Los metadatos de cada lectura están en `recurso.json`; su cuerpo solo contiene contenido. Esta decisión añade un archivo pequeño por lectura, pero evita definir metadatos de maneras distintas en MDX y Astro. No se duplican en el frontmatter ni en índices manuales.

Ejemplo ilustrativo de una lectura:

```json
{
  "id": "protocolos.apuntes.ip-iot",
  "subjectId": "protocolos",
  "kind": "apuntes",
  "slug": "ip-en-iot",
  "title": "IP en IoT",
  "description": "Direccionamiento, rutas y autoconfiguración con ejemplos visuales.",
  "scope": "Direccionamiento IPv6, rutas y autoconfiguración; no desarrolla la compresión de 6LoWPAN.",
  "tagIds": ["protocolos.tags.ip-iot"],
  "order": 30,
  "body": "body.astro",
  "printIntent": "screen",
  "sources": [
    {"materialId": "protocolos.materiales.tema-3", "pdfPages": [2, 3, 4]}
  ]
}
```

### Apuntes y resúmenes como documentos HTML

Se proponen dos formatos de cuerpo con un único contrato de lectura:

- **MDX** para texto, tablas sencillas y composición de componentes existentes. Será el formato habitual para resúmenes y lecturas nuevas basadas en prosa.
- **Astro** para documentos con HTML muy personalizado, diagramas o una composición visual compleja. Será una vía natural para portar los HTML actuales de Protocolos.

Ambos generan HTML semántico y utilizan el mismo layout, estilos, citas e impresión. No se mantienen una versión Markdown y otra HTML editadas por separado. En MDX hay que respetar su sintaxis de componentes; no se trata de pegar cualquier HTML sin adaptación. Astro documenta la integración de MDX y su combinación con componentes. [Integración MDX](https://docs.astro.build/en/guides/integrations-guide/mdx/).

El cuerpo no incluye `html`, `head`, navegación global ni otro `h1`. El layout aporta esos elementos desde los metadatos. Los cuerpos usan `h2` y `h3`, tablas con encabezados y figuras con texto alternativo. Los apuntes desarrollan conceptos, ejemplos y razonamiento; los resúmenes seleccionan lo esencial y enlazan a la explicación completa. No se impone un límite artificial de páginas, pero un resumen no debe convertirse en otro apunte extenso.

Las colecciones de Astro cargarán los manifiestos JSON y validarán sus esquemas durante la compilación. Astro admite colecciones locales y rutas estáticas derivadas de sus entradas. [Colecciones de contenido](https://docs.astro.build/en/guides/content-collections/).

Los cuerpos `.astro` no se tratarán como entradas de esas colecciones: un mapa de módulos descubierto en compilación con patrones literales de `import.meta.glob` resolverá `body.mdx` y `body.astro`. El campo `body` solo selecciona un archivo permitido dentro de la carpeta del recurso. El compilador debe rechazar cuerpos ausentes, ambiguos y rutas que salgan de esa carpeta. Así se evita un registro manual para cada lectura sin asumir que Astro carga archivos `.astro` mediante su cargador de contenido.

El índice de lectura se obtendrá de los encabezados del HTML generado, con una comprobación de anclas únicas para ambos formatos. Las anclas citadas por otros recursos se fijan explícitamente y se conservan al retitular un apartado.

### PDF originales y material proporcionado

Cada asignatura tendrá una sección **Material original**, con filtros por tema y clase de material: apuntes del profesor, diapositivas, problemas, prácticas, exámenes, guía docente y otros documentos. Los PDF se conservarán completos; no se sustituirán por resúmenes o transcripciones.

Cada archivo tendrá una ficha con título legible, nombre original, procedencia, curso o edición, temas cubiertos y enlace al archivo local. El tamaño se calcula a partir del archivo; el número de páginas se extrae o comprueba durante la validación. La fecha de publicación solo se incorpora si se conoce. La procedencia puede ser una URL o una descripción como «material proporcionado en la asignatura».

```json
{
  "id": "protocolos.materiales.tema-3",
  "subjectId": "protocolos",
  "kind": "material",
  "slug": "tema-3-ip-en-iot",
  "title": "Tema 3 · IP en IoT",
  "description": "PDF original del material de la asignatura.",
  "scope": "Documento original completo del tema 3, IP en IoT.",
  "tagIds": ["protocolos.tags.ip-iot"],
  "order": 30,
  "category": "apuntes-profesor",
  "file": "materiales/protocolos/tema-3-ip-en-iot.pdf",
  "format": "pdf",
  "providedName": "Tema 3 - IP en IoT.pdf",
  "origin": {"label": "Material proporcionado en la asignatura"},
  "pageCount": 55
}
```

La ficha ofrece **Abrir PDF** y **Descargar original**, sin obligar a pasar por un visor propio. La primera versión puede usar el visor del navegador; cualquier incrustación futura tendrá siempre enlace directo alternativo. En móvil, la descarga y apertura directa deben seguir siendo visibles.

Las lecturas y correcciones citan `materialId` y `pdfPages`. Se cuentan las páginas físicas desde 1, incluida la portada. Cuando la numeración impresa difiera, se puede añadir una etiqueta como «diapositiva 12». El enlace generado añade `#page=N` para visores compatibles y muestra la referencia en texto aunque el visor no salte a esa página. La validación rechaza citas fuera de los límites del PDF.

Los originales se copian sin alterar su contenido; un hash permite comprobar la identidad con el archivo fuente durante la migración. Renombrar el archivo para una URL sencilla no altera el nombre original conservado en la ficha. Una edición distinta de un PDF recibe una ficha e identificador nuevos si cambia la paginación o el contenido: las citas antiguas deben seguir apuntando al documento correcto.

Los PDF originales se guardan directamente en `public/materiales/` y se publican con el resto del sitio. Cada original tiene su ficha y forma parte del catálogo; no hay proceso de selección por estado editorial ni copias intermedias de publicación. Las exportaciones de apuntes propios se distinguen en `public/descargas/` y se enlazan desde su lectura.

## Separación de código y lógica

El flujo principal será:

```text
Contenido y PDF → validación y catálogo → generación estática → HTML y archivos
                                                               ↓
                                                    JS de la actividad abierta
                                                               ↓
                                                   correctores y progreso local
```

| Capa | Responsabilidad | Dependencias que debe evitar |
| --- | --- | --- |
| Contenido | Explicaciones, preguntas, datos de ejercicios y referencias. | Selectores DOM, almacenamiento y funciones ejecutables en JSON. |
| Dominio | Corregir respuestas, normalizar formatos, calcular resultados. | DOM, Astro, `localStorage` y peticiones de red. |
| Componentes | Construir HTML accesible y presentar estados. | Copias de las reglas de corrección. |
| Cliente | Leer controles, invocar dominio, mostrar resultados y guardar estado. | Importar el catálogo completo o todos los talleres. |
| Generación | Resolver relaciones, rutas, cuerpos y recursos publicados. | Dependencia de un servidor en producción. |

Los correctores serán funciones puras: datos de pregunta y respuesta entran; un resultado estructurado sale. La interfaz decide cómo presentarlo. El almacenamiento guarda respuestas y resultados, pero no decide qué es correcto.

Los componentes interactivos pueden usar Custom Elements con DOM normal para compartir estilos y reglas de impresión. Cada instancia limita sus consultas a su propio elemento, tiene identificadores únicos y limpia sus eventos al desconectarse. Los módulos evitan variables globales como `window.PREGUNTAS`. Cada página carga solo las preguntas del test y los componentes que usa.

No se propone un sistema genérico de plugins ni un lenguaje para programar ejercicios desde JSON. Los nuevos comportamientos se implementan como módulos concretos y se extraen a compartidos cuando haya reutilización real.

## Tests y preguntas

### Banco de preguntas y agrupación

Una pregunta se guarda en un archivo JSON independiente y puede reutilizarse en varios tests. Un test contiene grupos con título, contexto opcional y una lista explícita de identificadores. Su composición es fija y revisable; su orden de presentación se aleatoriza al iniciar. Una herramienta puede ayudar a elegir preguntas por tags, pero guarda la selección en el test: añadir preguntas al banco no cambia automáticamente los tests existentes. Los mismos datos sirven para practicar una pregunta, recorrer un grupo o completar el test.

Ejemplo abreviado de pregunta de respuesta única:

```json
{
  "id": "protocolos.preguntas.ipv6-longitud",
  "subjectId": "protocolos",
  "tagIds": ["protocolos.tags.ip-iot"],
  "type": "single",
  "prompt": "¿Cuántos bits tiene una dirección IPv6?",
  "options": [
    {
      "id": "bits-32",
      "text": "32 bits",
      "explanation": "32 bits es la longitud de una dirección IPv4; no corresponde a IPv6."
    },
    {
      "id": "bits-128",
      "text": "128 bits",
      "explanation": "IPv6 utiliza ocho grupos de 16 bits: 8 × 16 = 128 bits."
    }
  ],
  "answer": "bits-128",
  "explanation": "Una dirección IPv6 tiene 128 bits, agrupables en ocho hextetos.",
  "originalReferences": [],
  "sources": []
}
```

Una pregunta publicada necesita explicación general, justificación de cada alternativa y al menos una referencia concreta a los apuntes originales. Declarar elaboración propia o citar solo un apunte generado no sustituye ese requisito. El ejemplo abreviado requiere completar `originalReferences` con las páginas reales verificadas antes de publicarse; no se inventa una página para hacer pasar la validación. Los enunciados admiten un subconjunto documentado de Markdown para formato, código, fórmulas e imágenes; se compila en construcción, sin scripts ni expresiones ejecutables en los datos.

| Tipo | Representación de solución | Regla inicial |
| --- | --- | --- |
| `single` | ID de una opción. | Coincidencia exacta. |
| `multiple` | Lista de IDs de opciones. | Igualdad de conjuntos: todas las correctas y ninguna incorrecta. |
| `ordering` | Secuencia de IDs de elementos. | Igualdad de secuencias; sin puntuación parcial inicialmente. |

### Orden aleatorio obligatorio

Cada nueva sesión baraja las preguntas del test y, de forma independiente, las opciones de cada pregunta de respuesta única o múltiple. Si hay grupos, se baraja el orden de los grupos y el de sus preguntas, conservando el contexto compartido junto a su grupo. Un test de un solo grupo equivale a barajar todas sus preguntas. Las preguntas deben poder resolverse sin depender de la respuesta dada a una pregunta anterior; las actividades secuenciales se modelan como ejercicios o talleres.

En preguntas de ordenar, se baraja la secuencia inicial de elementos. Con dos o más elementos distintos, la secuencia inicial no debe coincidir con la solución; si coincide, se vuelve a generar una permutación válida. La secuencia correcta almacenada no se modifica. Las preguntas cuya solución admita varios órdenes requieren modelar explícitamente las secuencias aceptadas o reformular el enunciado; no se introduce esa complejidad en el corrector inicial.

Las opciones y elementos tienen IDs propios; nunca se corrige usando su posición visual ni letras A/B/C. La explicación y las referencias permanecen asociadas al ID. Las letras, si se muestran, se asignan después de mezclar. Enunciados como «todas las anteriores» o explicaciones como «la opción B» deben reformularse para que la mezcla no cambie su significado; el PDF original se conserva intacto.

El orden permanece estable mientras se responde, comprueba o navega hacia atrás. Se vuelve a mezclar al empezar una sesión nueva o resetear el test, no después de cada respuesta. Si se reanuda un estado local compatible, se restaura también su orden. Una nueva mezcla puede coincidir por azar con la anterior; no se promete un orden siempre diferente.

El motor usará un algoritmo de permutación como Fisher–Yates, sin mutar el banco fuente, y admitirá una fuente aleatoria inyectable para las pruebas. En producción se obtiene una mezcla nueva; en unitarias y E2E se puede reproducir un escenario con datos y aleatoriedad controlados. Las comprobaciones no dependerán de que dos mezclas casuales tengan que salir diferentes.

### Corrección completa

La corrección explica el concepto o procedimiento que permite llegar a la solución y analiza todas las alternativas, no solo la elegida. Esta información se ofrece también cuando se acierta. Decir «es incorrecta porque la correcta es otra» no satisface el requisito: se debe identificar la confusión, condición incumplida o cálculo equivocado.

| Tipo | Devolución obligatoria |
| --- | --- |
| Respuesta única | Solución razonada y explicación individual de por qué cada opción es correcta o incorrecta. |
| Respuesta múltiple | Justificación de cada opción y distinción entre correctas seleccionadas, correctas omitidas, incorrectas seleccionadas e incorrectas descartadas. |
| Ordenar | Secuencia correcta, explicación de cada posición y sus dependencias, y comparación con la secuencia enviada. |

Para ordenar no se enumeran todas las permutaciones incorrectas. Cada elemento incluye `placementExplanation`, que justifica su posición o relación con los demás; el corrector identifica los elementos desplazados y la interfaz muestra esas razones junto a la comparación. Cuando una secuencia representa relaciones más complejas que un orden único, se reformula la pregunta o se diseña un taller específico.

En respuestas única y múltiple, `options[].explanation` es obligatorio; la condición de correcta se obtiene de `answer`, sin duplicar un booleano en cada opción. Las explicaciones permanecen unidas a su ID al barajar. La explicación general evita repetir literalmente todas las explicaciones particulares y desarrolla el razonamiento común.

Se recomienda mostrar la corrección completa al pulsar **Comprobar**, con una estructura fácil de recorrer y sin exigir fallar para ver detalles. Su contenido se escribe y revisa junto con la pregunta; no se genera mediante un LLM durante la práctica. La validación comprueba cobertura y campos no vacíos; la revisión editorial comprueba que las razones son suficientes y consistentes con la solución.

Cada pregunta tiene `originalReferences`, una lista de referencias con `materialId`, `pdfPages` y una etiqueta descriptiva opcional. Debe señalar las páginas originales que explican la solución, no limitarse al PDF donde se copió el enunciado. En una respuesta fallida se muestra de forma destacada **«Revisar en los apuntes originales · Tema 3, pág. N»**, enlazando directamente al archivo y su página. Se mantiene el progreso al abrirlo; cuando se abre otra pestaña, el enlace lo indica. En aciertos también pueden consultarse estas fuentes.

Las explicaciones de alternativas pueden concretar referencias adicionales cuando el error pertenezca a otro apartado. Un enlace al apunte propio, a un RFC o a una guía docente puede complementar la referencia original, pero no sustituirla. La validación de publicación exige referencias originales no vacías, materiales existentes y páginas válidas. Los ejercicios de respuesta comprobable aplican el mismo criterio a sus errores, con referencias por campo cuando aporten precisión.

### Interacción y estado

Cada pregunta muestra un botón **Comprobar** y, tras pulsarlo, el resultado, la corrección completa y referencias para estudiar el concepto. No hay tiempos ni bloqueo hasta terminar el grupo. Se puede avanzar y volver a las preguntas; el grupo organiza la navegación, pero no retrasa la corrección.

Estados de una respuesta: sin responder, editada sin comprobar y comprobada. Al modificar una respuesta corregida, el resultado anterior deja de representar la respuesta actual y se pide comprobar de nuevo. El resumen distingue correctas, incorrectas y pendientes; incluye como pendientes las editadas sin comprobar. Los reintentos son ilimitados y sustituyen el estado anterior, sin contador, historial ni distinción entre primer intento y siguientes. Una respuesta solo suma acierto cuando está completamente bien.

La selección múltiple se identifica expresamente. Las preguntas de ordenar ofrecen botones subir/bajar y teclado; arrastrar puede añadirse como alternativa, nunca como único control. El resultado se anuncia mediante una región accesible y no depende únicamente del color. Los grupos conservan su contexto; su presentación y la de sus preguntas siguen la mezcla obligatoria descrita arriba.

Un porcentaje de aciertos es opcional y se calcula sobre preguntas únicas del test según su estado actual. No hay penalización por fallo ni puntuación parcial. Mostrar una solución no completa una respuesta automáticamente; una respuesta comprobada correctamente cuenta igual independientemente de consultas o reintentos anteriores. Las respuestas y soluciones están en el cliente por tratarse de una herramienta estática de autoestudio.

## Ejercicios y talleres

### Formularios declarativos

Para ejercicios con resultados concretos, el manifiesto contiene enunciado, campos con IDs y etiquetas, correctores, pistas, solución razonada y referencias originales. Permite combinar números, texto, desplegables y varios campos en una misma actividad, con corrección individual y global. Se muestra el diagnóstico por campo, pero el ejercicio solo se considera correcto cuando todos los campos requeridos están bien.

| Entrada | Contrato de corrección |
| --- | --- |
| Número | Valor esperado, tolerancia absoluta y relativa explícitas, unidad y política decimal. |
| Texto | Respuestas aceptadas y normalización declarada de espacios, mayúsculas y tildes. |
| Desplegable | Opciones con IDs y uno o varios IDs esperados según el control. |
| Formato especializado | Identificador de un corrector registrado, por ejemplo `protocolos.ipv6-equivalent`. |

Para números, la regla puede ser `abs(valor - esperado) <= max(absTol, relTol * abs(esperado))`; si se exige exactitud, ambas tolerancias son cero. El analizador rechaza entradas parciales como `12abc`, infinitos y formatos ambiguos. La política inicial acepta coma o punto decimal sin separadores de miles. Unidades y conversiones se especifican por campo, no se adivinan.

No se eliminarán tildes o diferencias de mayúsculas indiscriminadamente: pueden ser significativas. Una respuesta abierta sin una solución comprobable se presenta como actividad de autoevaluación con pauta o solución, sin fingir corrección semántica automática. Los datos no contienen `eval`, funciones serializadas ni expresiones de corrección arbitrarias.

### Talleres programados

Un taller interactivo tiene su componente, datos, estilos específicos y lógica de dominio. Su manifiesto apunta a una clave conocida del registro `talleres.ts`; ese registro resuelve el módulo durante la compilación. Un ID desconocido hace fallar la validación. Los imports se mantienen por taller para no enviar todos sus scripts a todas las páginas.

El contrato mínimo incluye título, instrucciones, representación inicial útil, controles accesibles, reinicio, explicación y comportamiento sin JavaScript. Los talleres con ejercicios guardan su estado mediante el adaptador común y permiten resetear cada ejercicio; si no tienen respuestas calificables, pueden conservar el escenario explorado sin inventar una nota.

Los simuladores NDP, inspectores de cabeceras y actividades de compresión existentes encajan aquí. Los visuales incrustados dentro de apuntes pueden compartir sus componentes y cálculos con un taller completo, sin convertir la lectura en una actividad obligatoria.

## Lectura e impresión

### Experiencia de lectura

El diseño será sencillo y orientado a lectura fácil, con una columna de texto de unas 65–75 letras de ancho, interlineado cómodo, jerarquía tipográfica clara y tablas legibles. Los apuntes se leen completos con **scroll normal del documento**, aunque sean largos: sin paginación, carruseles ni divisiones automáticas. Los resúmenes comparten este comportamiento.

Toda lectura incluye **tabla de contenido en un menú lateral ocultable**, generada a partir de los apartados y siempre accesible mediante un control «Contenido». En escritorio puede permanecer abierta al lado del texto; en móvil se abre como panel lateral superpuesto y se cierra al elegir un apartado. Debe poder abrirse y cerrarse con teclado, devolver el foco al control y permitir navegar por anclas. El índice puede tener scroll propio si es largo; el cuerpo mantiene el scroll normal. Ocultar el menú no elimina las anclas ni el acceso al índice. Sin JavaScript se ofrece el índice mediante HTML navegable.

La interfaz general, los apuntes, resúmenes, tests, formularios y catálogo de materiales serán responsive. Un taller o animación cuya geometría sea difícil de adaptar puede mantener un ancho mínimo dentro de su contenedor desplazable, con una indicación de que se recomienda una pantalla mayor. La excepción se limita al visual: no debe desbordar la página completa ni impedir leer las instrucciones o acceder a controles básicos. Se conserva la alternativa textual y, si está en una lectura, la representación imprimible. Modo oscuro y ajustes tipográficos quedan como mejoras opcionales, no como requisitos de la primera versión.

Una lectura muestra título, asignatura, temas, alcance, fuentes y etiqueta de impresión. Las citas están junto al contenido al que corresponden. Al final se ofrecen resumen, preguntas y ejercicios relacionados. La guía docente permanece accesible desde la cabecera de la asignatura, también durante la lectura.

Las animaciones explican una secuencia o relación concreta. Deben permitir avanzar por pasos, pausar y reiniciar, respetar `prefers-reduced-motion` y conservar una explicación textual. La comprensión básica no depende de que el lector reproduzca una animación. Navegación, texto, referencias y PDF funcionan sin JavaScript; las actividades muestran instrucciones claras si no pueden ejecutarse.

### Intención de impresión y calidad de impresión

`printIntent` clasifica la intención editorial:

- `paper`: **Pensado para imprimir**. Organización y densidad revisadas para estudiar en papel.
- `screen`: **Pensado para pantalla**. Puede incluir exploración y animaciones; tiene una representación impresa legible y suficiente para entender su contenido.

Esta etiqueta no indica si el botón de imprimir está disponible. Todas las lecturas tienen estilos de impresión y se pueden imprimir con Ctrl+P. La clasificación se aplica a los apuntes y resúmenes propios; los PDF originales mantienen su formato y se imprimen desde su visor.

Se propone una hoja común `print.css`, cargada en todas las lecturas, y reglas de impresión dentro de cada componente. CSS permite definir estilos mediante `@media print` y dimensiones o márgenes con `@page`; los eventos de impresión pueden complementar la preparación del documento. [Impresión con CSS en MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing).

Contrato de impresión:

1. Fondo blanco, texto oscuro, tamaño legible, márgenes A4 razonables y contenido comprensible en escala de grises.
2. Ocultar navegación, controles y adornos. Conservar título, asignatura, fuentes y contenido docente.
3. Eliminar alturas fijas, contenedores con scroll y posicionamientos que corten contenido. Permitir partir código y direcciones largas sin cambiar su texto copiable.
4. Evitar títulos aislados y cortes dentro de figuras pequeñas. No aplicar `break-inside: avoid` a secciones más altas que una página. Repetir encabezados de tablas cuando el navegador lo permita.
5. Ofrecer tablas extensas y diagramas anchos en una representación impresa adaptada; no reducirlos hasta que resulten ilegibles.
6. Incluir el contenido docente de pestañas y desplegables. El sistema debe preparar también los elementos `details`, porque CSS por sí solo no garantiza que el navegador imprima su contenido cerrado. Se puede usar `beforeprint` y restaurar el estado con `afterprint`, con alternativa estática para la información esencial.
7. Cada visual vivo aporta un diagrama, secuencia o tabla estática que ya existe en el HTML. Imprimir no requiere capturar un canvas, esperar una petición ni acertar el instante de la animación. Si se imprime un escenario elegido por el usuario, se identifican sus parámetros.

Los componentes visuales deben compartir los datos que alimentan la animación y su alternativa impresa cuando sea posible. Así se evita que dos explicaciones del mismo fenómeno se contradigan.

El botón «Imprimir» llama al diálogo del navegador; Ctrl+P debe obtener el mismo resultado sin pasar por ese botón. No se promete paginación idéntica entre navegadores ni control sobre los encabezados del diálogo. Los materiales `paper` requieren revisión visual adicional. Un PDF descargable con paginación fija se puede añadir posteriormente como derivado de la fuente, sin sustituir la impresión del HTML.

## Progreso local mínimo

El progreso es secundario. Se conserva el guardado básico en `localStorage` previamente acordado, limitado al estado actual del test o ejercicio: respuestas, posición y orden aleatorio de esa sesión. No hay historial, marcador de dudas, exportación, sincronización ni migración de respuestas entre versiones.

Si cambia el contenido o el formato del estado, se puede descartar el test completo y empezar de nuevo. Una versión global del estado o del despliegue basta para invalidar lo guardado, sin `gradingRevision` ni reconciliación por pregunta. Al reanudar solo se acepta un estado compatible; nunca se muestran correcciones de contenido antiguo como actuales.

Cada test y ejercicio permite resetear su estado independientemente. Resetear un test crea una nueva mezcla; reiniciar un ejercicio dentro de un taller no reinicia los demás. Si el almacenamiento falla, se practica en memoria. Este adaptador debe ser pequeño y no retrasar el motor, las herramientas de autoría o las pruebas. No se usa `localStorage.clear()` ni se migra el progreso del sitio anterior.

## Herramientas para agentes como parte esencial

El usuario indica en su prompt una ruta local de su PC y el trabajo de estudio deseado. El agente puede leer archivos o carpetas externas al repositorio, organizar el catálogo, incorporar originales y generar todo el contenido. Las rutas locales son entradas de autoría: la compilación y la web dependen únicamente de lo incorporado al proyecto. Los originales externos permanecen intactos. `content:inspect` inventaría la ruta; `content:import` copia los PDF seleccionados y registra páginas e identidad; `content:list` y `content:show` permiten consultar las entidades existentes.

El primer incremento incluye tipos estrictos, CLI, esquemas compartidos y una muestra funcional completa. Las capacidades restantes del diseño se incorporarán sobre esa base; véase el manual de autoría para las limitaciones actuales.

**La autoría mediante agentes es una capacidad principal del proyecto**, junto con la lectura y la práctica. Se diseña desde el primer incremento funcional, no como una mejora futura. El repositorio incluirá `AGENTS.md`, `docs/autoria.md`, plantillas verificadas, ejemplos completos, esquemas únicos y una CLI de contenido en TypeScript.

| Comando previsto | Responsabilidad |
| --- | --- |
| `bun run content:new` | Crear un recurso del tipo elegido, con IDs y archivos coherentes, sin sobrescribir contenido existente. |
| `bun run content:check` | Validar formatos, alcance, tags, referencias, explicaciones, grupos y requisitos de mezcla. |
| `bun run content:impact` | Consultar qué recursos usan una pregunta, material, apartado o componente antes de modificarlo. |
| `bun run content:report` | Resumir cobertura por tags, referencias incompletas y posibles duplicados. |
| `bun run test:unit` | Ejecutar las pruebas unitarias del proyecto. |
| `bun run test:e2e` | Ejecutar los flujos E2E obligatorios en Firefox. |
| `bun run check` | Ejecutar la puerta de validación completa: contenido, unitarias, compilación y E2E. |

Estos comandos están disponibles en el primer incremento; el manual de autoría documenta el alcance y los comandos adicionales de incorporación desde rutas locales. Los comandos de contenido ofrecen salida legible y una opción JSON con IDs, rutas, errores y dependencias, para que los agentes puedan consumir resultados sin interpretar mensajes libres. Los códigos de salida distinguen éxito de errores. Los esquemas se definen una sola vez y los usan tanto Astro como la CLI y la validación de plantillas.

Flujo de autoría:

1. Consultar las instrucciones del repositorio, los tags existentes y los originales relevantes.
2. Crear o adaptar la plantilla adecuada, definir `scope` y citar páginas reales de los materiales.
3. Escribir contenido y explicaciones completas. Reutilizar componentes y correctores existentes.
4. Consultar dependencias antes de cambiar o retirar un recurso compartido.
5. Validar el contenido y ejecutar las pruebas requeridas. Revisar exactitud académica, lectura e impresión donde corresponda.

`AGENTS.md` indica dónde trabajar, qué contratos conservar y cómo verificarlo; `docs/autoria.md` explica los formatos y ejemplos. Añadir preguntas o lecturas normales no requiere modificar rutas, estilos globales ni el motor. Los recursos nuevos se descubren automáticamente. Cada capacidad nueva del motor o componente compartido incluye pruebas y un ejemplo de autoría.

## Dependencias de contenido y navegación relacionada

El catálogo mantiene relaciones explícitas por ID: un test contiene preguntas; una pregunta o lectura cita materiales originales; un resumen puede enlazar al apunte que desarrolla; un ejercicio puede enlazar a lecturas de apoyo; un taller utiliza un componente registrado. Las citas añaden página o ancla cuando corresponda. Los tags expresan clasificación, no una dependencia docente.

Se añaden referencias opcionales `readingReferences` para enlazar lecturas y apartados de apoyo, y `relatedResourceIds` para asociaciones editoriales adicionales. Las referencias a originales conservan `sources` y `originalReferences`. Las relaciones inversas se calculan a partir de los datos; no se mantiene una segunda lista manual `usedBy`.

| Lugar de la interfaz | Relaciones que muestra |
| --- | --- |
| Lectura o resumen | Fuentes originales y actividades que lo referencian explícitamente. |
| Corrección de pregunta | Referencia original obligatoria, lecturas de apoyo y explicaciones. |
| Ficha de material original | Apuntes, resúmenes, tests y ejercicios que lo citan, agrupados por tipo. |
| Ficha del test o ejercicio | Alcance y materiales o lecturas utilizados. |

Cuando el vínculo sea indirecto, se describe con precisión: «Este test contiene preguntas que citan este PDF». Se eliminan duplicados y se puede desplegar «Ver todos» si la lista es larga. La UI usa nombres comprensibles como **Fuentes**, **Lecturas de apoyo** y **Utilizado en**; los IDs, rutas de código y dependencias técnicas quedan en la CLI. No es necesario un grafo visual interactivo.

La validación rechaza IDs inexistentes y anclas o archivos rotos. `content:impact` informa de usos directos e indirectos, incluyendo archivo y campo; soporta referencias cíclicas legítimas entre lecturas mediante un recorrido con nodos visitados. El grafo completo se resuelve en compilación y cada página recibe solo sus enlaces necesarios.

## Validación y despliegue

### Pruebas unitarias y E2E obligatorias

| Nivel | Qué comprueba |
| --- | --- |
| Esquemas | Campos requeridos, tipos, discriminantes, URLs y valores permitidos. |
| Relaciones | IDs únicos, pertenencia a asignatura, tags existentes sin duplicados, cobertura temática de tests, referencias resolubles, relaciones inversas coherentes y slugs sin colisiones. |
| Lecturas y archivos | Cuerpo válido y único, assets existentes, anclas y enlaces internos, PDF reales y citas dentro de sus páginas. |
| Preguntas | Opciones únicas, respuesta referida existente, conjuntos sin duplicados, secuencias válidas, explicaciones completas y referencias concretas a originales para revisar fallos. |
| Unitarias | Corrección completa, límites numéricos, formatos, permutaciones sin duplicados, asociación respuesta/explicación por ID, estado y catálogo de dependencias. |
| E2E Firefox | Una ruta de cada tipo, filtro de un tag, índice lateral, teclado, mezcla de preguntas y opciones, corrección de los tres tipos, reintentos, reset, relaciones visibles, referencias originales y URL profunda. |
| Impresión | Lectura corta, lectura larga con tablas y apunte animado; revisar cortes, contenido oculto y alternativa estática. |
| Despliegue | Sitio bajo una subruta, acceso a todos los materiales catalogados, enlaces con anclas y assets. |

Las herramientas son `bun:test` para las funciones puras de TypeScript y Playwright Test con un proyecto **Firefox** para E2E. Bun ejecuta los scripts y las herramientas de desarrollo; `bunfig.toml` limita sus unitarias a `tests/unit/`. Playwright utiliza su propia compilación compatible de Firefox, instalada en desarrollo y CI. [Ejecutor de Bun](https://bun.sh/docs/test), [Firefox en Playwright](https://playwright.dev/docs/browsers#firefox).

Las E2E sirven `dist/` por HTTP bajo una subruta representativa de GitHub Pages. Cubren escritorio y viewport estrecho en Firefox, sin presentar esa emulación como prueba en un móvil físico. Usan fixtures con soluciones conocidas y aleatoriedad controlada; responden por ID o nombre accesible, no por la posición de las opciones. Comprueban mezclas esperadas para semillas concretas y que la corrección y las explicaciones sobreviven a la permutación, evitando pruebas probabilísticas frágiles.

Las unitarias comprueban además que barajar no muta los originales, no pierde ni duplica elementos y mantiene los grupos con su contexto. La validación de contenido comprueba todas las preguntas; no hace falta escribir un archivo de prueba por cada pregunta añadida. Los fallos E2E generan información de diagnóstico y capturas o trazas.

Las comprobaciones externas de guías docentes se ejecutan aparte para no depender de la disponibilidad de la universidad en cada ejecución. La revisión de impresión incluye el diálogo y la salida paginada de Firefox en A4; las capturas de pantalla o emular `print` no sustituyen esa comprobación. Chromium puede ser complementario, pero no sustituye las E2E requeridas en Firefox.

### GitHub Pages

GitHub Actions instalará las dependencias bloqueadas y Firefox para las pruebas, validará el contenido, ejecutará las unitarias, compilará y ejecutará las E2E de Firefox sobre el resultado. Solo después publicará `dist/`. Las pull requests pasan las mismas comprobaciones sin desplegar; la rama principal publica tras superar esa puerta. GitHub documenta el flujo de compilación, subida de artefacto y despliegue de Pages mediante acciones. [Workflows personalizados de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Se configurarán `site` y `base` según el dominio y repositorio definitivos. Si la web vive en `https://usuario.github.io/web-estudio/`, la base es `/web-estudio`; no se escribirán enlaces internos suponiendo que la web está en `/`. Astro requiere incorporar esa base a los enlaces internos. [Despliegue de Astro en GitHub Pages](https://docs.astro.build/en/guides/deploy/github/).

El módulo de rutas centraliza los enlaces a páginas y archivos de `public/`; los assets importados se resuelven con el compilador. Los autores citan materiales por ID y usan componentes de enlace para recursos internos. Una comprobación del HTML compilado detectará enlaces manuales que olviden la base. Las rutas generan directorios con `index.html`, por lo que abrir o recargar una URL profunda no depende de reglas de reescritura de un servidor.

Los PDF originales aumentan el tamaño del repositorio y del artefacto. Antes de cargar un volumen grande se comprobarán los límites vigentes de Pages y GitHub. Si algún archivo no cabe, su ficha podrá referenciar una URL externa estable; para el material actual se propone copia local y acceso directo desde el sitio.

## Migración del contenido de Protocolos

La fuente existente es `../../Protocolos/preparacion-examen/`, relativa a este documento. Tiene bancos de preguntas, un motor parcialmente separado de la interfaz, HTML de apuntes, visuales NDP y un taller de cabeceras con datos y comprobaciones propias.

El [README de los apuntes](../../Protocolos/preparacion-examen/apuntes/README.md) establece que la versión principal se edita en HTML, CSS y JavaScript; los Markdown conservan texto base sin sincronización automática. Por tanto, la migración debe partir de los HTML y sus dependencias, especialmente en los temas 3 y 4. El [generador existente](../../Protocolos/preparacion-examen/herramientas/generar-apuntes.py) crea HTML ausentes y evita sobrescribir los editados.

| Origen | Destino propuesto |
| --- | --- |
| `apuntes/*.html` | Cuerpos `body.astro`, conservando texto, enlaces, anclas y visuales. |
| `apuntes/*.md` | Referencia de migración; no una segunda fuente editable del nuevo sitio. |
| `material/*.pdf` | Originales en `public/materiales/protocolos/`, cada uno con ficha y comprobación de identidad. |
| `imprimibles/*.pdf` | Descargas derivadas, vinculadas al resumen correspondiente. |
| `datos.js` y bancos adicionales | Preguntas JSON con IDs de opciones, fuentes y explicaciones conservadas. |
| `motor.js` | Funciones puras revisadas de corrección y formatos específicos. |
| `visuales.js` y `ndp.js` | Componentes por visual con estado independiente y representación impresa. |
| Taller de cabeceras | Taller registrado, datos propios y lógica específica separada del DOM. |
| `herramientas/` | Casos y comprobaciones aprovechables, adaptados al nuevo entorno. |

Los actuales bancos corrigen opciones por índice de autoría; al migrarlos se convertirán a IDs estables y se activará la mezcla obligatoria de preguntas y opciones. No se trasladan modos de orden fijo del sitio anterior; se conserva la transcripción original en el PDF y se adapta la versión de práctica cuando sus referencias posicionales impidan barajar. Se conservarán las distinciones entre contenido del profesor, ejemplos propios, material complementario y correcciones orientativas. Los tests del nuevo sitio permitirán comprobar siempre por pregunta, aunque el original tenga modo examen. Las preguntas que solo incluyan una explicación general necesitarán justificaciones para todas sus opciones antes de publicarse; no bastará con copiar su banco actual.

La migración se hará por una muestra vertical: ficha de Protocolos con guía y bimestre reales, un PDF original, un apunte con visual, un resumen, un test y un ejercicio. Después se comprobarán sus relaciones, impresión y funcionamiento bajo la base de Pages antes de trasladar el resto. El proyecto original se mantiene disponible durante el proceso.

No se asignará automáticamente la etiqueta `paper` a un documento por ser estático ni se clasificará como resumen todo lo que el proyecto anterior llame «resumen»: se revisarán su extensión, función y composición. El PDF de repaso ya preparado para papel puede conservarse, pero la nueva lectura HTML deberá cumplir igualmente el contrato de impresión.

## Secuencia de implementación posterior

1. **Fundamentos y autoría:** esquemas únicos, catálogo de relaciones, CLI para agentes, documentación operativa, fixtures y estructura de pruebas unitarias y E2E en Firefox.
2. **Lectura:** rutas, layouts, guía docente, originales, alcance, tags con selección simple, cuerpos, índice lateral, relaciones visibles y estilos de impresión.
3. **Práctica básica:** los tres tipos de pregunta, grupos explícitos, mezcla obligatoria, corrección completa, referencias originales, formularios y reinicio; guardado local mínimo como apoyo secundario.
4. **Contenido vivo:** componentes visuales y talleres de Protocolos, con sus alternativas estáticas e impresas.
5. **Migración y publicación:** trasladar el resto del material, comprobar rutas con base y publicar mediante Actions.

Las plantillas y validaciones se construyen con cada fase, para que el contenido nuevo use desde el principio los mismos contratos. Los PDF derivados automáticos pueden añadirse después de comprobar el núcleo. No se incluye búsqueda en la web.

## Decisiones cerradas y detalles restantes

Quedan acordados Astro estático, cuerpos MDX o Astro, TypeScript compilado a JavaScript vanilla, CSS vanilla, tags múltiples, lecturas con scroll continuo e índice lateral ocultable, corrección completa con referencia original en los fallos, acierto solo por respuesta completa, reintentos ilimitados sin historial, mezcla obligatoria de preguntas y respuestas, guardado mínimo secundario en `localStorage` y reset por test o ejercicio. El sitio se centra en 2026/27, no incorpora buscador y prioriza lectura responsive con excepciones localizadas para talleres o animaciones complejas.

La composición exacta de las tarjetas, colores y tipografía se resolverá al diseñar la interfaz. El filtro queda limitado a Todos o un tag activo. Los tags no generan tests ni modifican sus listas de preguntas; solo clasifican recursos. Las herramientas de autoría, las relaciones visibles y las pruebas unitarias y E2E en Firefox son requisitos del núcleo.

El [catálogo académico](catalogo-academico-2026-27.md) recoge asignaturas, bimestres y enlaces localizados en muiot.es. Sigue pendiente verificar el destino y edición de las guías señaladas con incidencias. No se presupone qué especialidad ni optativa cursa el usuario: se documenta la oferta completa sin convertirla en una selección personal. Antes de publicar faltan el repositorio y, si se desea, el dominio propio.

La conservación del progreso entre cambios, las copias de progreso, el marcador de dudas y el flujo editorial por estados quedan fuera del alcance. Todo el material incorporado se utiliza. Los límites se expresan en `scope`, las relaciones se derivan del catálogo y la calidad se comprueba mediante validación, pruebas y revisión del contenido.
