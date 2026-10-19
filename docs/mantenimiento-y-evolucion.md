# Mantenimiento y evolución de la web durante el curso

Plan de mantenimiento actualizado con las decisiones del usuario. Complementa el [diseño principal](diseno-arquitectura.md). Este documento define la arquitectura y su verificación; no implementa herramientas ni funcionalidades.

La prioridad durante 2026/27 es añadir y corregir contenido con agentes, mantener claras sus relaciones y ofrecer práctica con preguntas y opciones aleatorias. La conservación del progreso es secundaria. Se mantiene un único repositorio y una web estática con Astro, MDX, JavaScript vanilla y CSS vanilla.

## Prioridades acordadas

| Prioridad | Capacidad | Resultado esperado |
| --- | --- | --- |
| Esencial | Herramientas para agentes | Crear, consultar dependencias y validar contenido sin modificar el motor. |
| Esencial | Relaciones de contenido | Identificar qué usa cada recurso y mostrar fuentes y relaciones útiles en la UI. |
| Esencial | Aleatoriedad | Barajar preguntas y opciones al iniciar o resetear, sin alterar soluciones ni explicaciones. |
| Esencial | Unitarias y E2E en Firefox | Detectar fallos de lógica y de los flujos reales antes de desplegar. |
| Esencial | Alcance explícito | Mostrar qué cubre cada recurso mediante `scope`. |
| Simple | Organización | Varios tags por recurso; un único tag activo en el filtro. |
| Simple | Publicación | Todo el material incorporado se utiliza, sin estados editoriales. |
| Secundaria | Guardado local | Estado actual mínimo; una actualización puede reiniciar el test completo. |

No se incorporan migraciones de progreso, historial de intentos, exportación/importación, marcador de dudas, filtros combinados ni un flujo de borrador y publicado.

## Herramientas para agentes desde el inicio

La CLI de autoría y su documentación son entregables principales del proyecto. El primer incremento funcional incluirá esquemas compartidos, plantillas verificadas, instrucciones operativas y ejemplos pequeños completos. No se dejan para después de migrar el temario.

| Comando previsto | Contrato |
| --- | --- |
| `npm run content:new` | Crear una lectura, pregunta, test, ejercicio o ficha de material; generar IDs y estructura sin sobrescribir archivos. |
| `npm run content:check` | Validar esquema, alcance, tags, fuentes, páginas, explicaciones, composición de tests y contenido compatible con la mezcla. |
| `npm run content:impact` | Consultar usos directos e indirectos por ID o archivo, con campos y rutas afectadas. |
| `npm run content:report` | Mostrar cobertura por tags, posibles duplicados y problemas del catálogo. |
| `npm run test:unit` | Ejecutar las pruebas unitarias. |
| `npm run test:e2e` | Ejecutar las E2E en Firefox sobre el sitio compilado. |
| `npm run check` | Validar contenido, ejecutar unitarias, compilar y ejecutar E2E. |

Estos comandos aún no existen. Su implementación ofrecerá salida legible y una opción JSON, códigos de salida fiables y errores con archivo, campo y causa. Crear un recurso debe producir una plantilla coherente y señalar los datos editoriales que falten; no inventar fuentes para hacerla pasar por completa.

`AGENTS.md` será breve y operativo: dónde trabajar, qué contratos conservar y cómo verificar. `docs/autoria.md` desarrolla ejemplos y formatos. Los esquemas de `src/schemas/` son la única definición de datos; la CLI, Astro y las plantillas los reutilizan. Los esquemas del editor se generan o derivan, no se mantienen como una definición contradictoria.

Los ejemplos abarcan una lectura MDX, otra Astro con visual e impresión, los tres tipos de pregunta, un test con grupos y un ejercicio con varios campos. Un agente que añada contenido normal no debería tocar las rutas, el motor ni CSS global. Un comportamiento nuevo sí se incorpora al código compartido con pruebas y un ejemplo de uso.

## Identidad y relaciones de contenido

Los IDs son estables e independientes del título, carpeta y URL. Nunca se reutiliza el ID de una pregunta para otra distinta. Se configurará explícitamente la identidad de las colecciones para que un `slug` como `repaso-final` pueda aparecer en dos asignaturas sin colisionar. Astro permite personalizar los IDs de sus colecciones. [IDs en Astro](https://docs.astro.build/en/guides/content-collections/#defining-custom-ids).

El catálogo recoge relaciones explícitas: preguntas incluidas en tests, citas de materiales y páginas, referencias a lecturas y apartados, recursos relacionados y componentes de talleres. Los tags son una clasificación; compartir un tag no prueba que una lectura sea fuente de una pregunta.

Las relaciones inversas se calculan en compilación. `content:impact` puede informar de que un PDF alimenta tres lecturas y preguntas utilizadas por dos tests, sin mantener a mano una lista inversa. Las referencias rotas hacen fallar la validación. Los ciclos legítimos entre lecturas se recorren sin bucles mediante un conjunto de nodos visitados.

La UI expone la parte útil para estudiar:

- **Fuentes**: originales y páginas utilizadas en una lectura o actividad.
- **Lecturas de apoyo**: apuntes y apartados enlazados explícitamente.
- **Utilizado en**: recursos que citan un material; un test se incluye si contiene preguntas que lo citan.
- **Práctica relacionada**: actividades vinculadas explícitamente a una lectura.

Las listas deduplican recursos, agrupan por tipo y pueden limitarse con «Ver todos». Las relaciones indirectas se identifican como tales. Las rutas de código, IDs internos y dependencias técnicas quedan en las herramientas del repositorio. No hace falta una visualización de nodos y aristas.

## Composición fija y presentación aleatoria

Cada test guarda listas explícitas de preguntas. Los agentes pueden preparar una selección consultando tags, pero el resultado se incorpora al archivo del test. Añadir preguntas al banco no amplía automáticamente tests existentes.

Al iniciar una sesión se mezclan las preguntas y, de forma independiente, las opciones de respuesta única o múltiple. En tests con grupos se barajan los grupos y sus preguntas, manteniendo junto a cada pregunta el contexto de su grupo. Ninguna pregunta debe exigir la respuesta de una anterior; una secuencia de trabajo dependiente corresponde a un ejercicio o taller.

En preguntas de ordenar se mezcla la disposición inicial de elementos, conservando intacta la secuencia solución. Con dos o más elementos distintos, se evita presentar inicialmente la secuencia correcta. Responder, comprobar y volver atrás no debe volver a barajar. Resetear crea una sesión nueva; si se reanuda una sesión compatible, se conserva su orden.

La corrección, explicaciones y referencias se asocian por IDs, nunca por letras ni índices visibles. Enunciados como «todas las anteriores» necesitan adaptación para admitir mezcla. El archivo original permanece intacto. Una permutación nueva puede coincidir casualmente con otra: las pruebas no deben considerar eso un fallo.

El motor recibe una fuente aleatoria inyectable para reproducir casos en pruebas. La función de mezcla no modifica sus entradas y produce una permutación completa sin pérdidas ni duplicados. Una implementación como Fisher–Yates es suficiente; no se necesita un servicio ni una dependencia de aleatoriedad.

## Filtro simple y alcance editorial

Cada recurso admite varios tags, pero el usuario elige **Todos** o **un tag**. Pulsar otro reemplaza al activo. Los tipos de recurso siguen siendo secciones de navegación. No hay selección múltiple, lógica AND/OR configurable ni buscador.

`scope` es obligatorio para apuntes, resúmenes, tests, ejercicios y fichas de materiales. Delimita qué se estudia: por ejemplo, «Temas 1–3 y tema 4 hasta la página 37». Los tags permiten localizar; el alcance indica los límites. Se presenta en la ficha y cabecera y no sustituye las citas a páginas.

Los agentes reutilizan los tags canónicos de la asignatura para evitar duplicados como «Tema 3» y «T3». La unión de tags temáticos de las preguntas permite comprobar la clasificación de un test. Los tags de estudio, como «Primer parcial», se asignan de forma explícita.

## Archivos originales y publicación

Los PDF permanecen en `public/materiales/`, con una ficha por original. Todo el material incorporado forma parte del sitio. No hay campo de estado editorial, selección de archivos por publicación ni copias intermedias administradas a mano.

La validación comprueba que cada material catalogado existe y que sus citas resuelven. Cambiar la edición o paginación de un original implica una nueva ficha y revisar sus referencias; no se sustituye silenciosamente el archivo citado. Los PDF derivados de apuntes propios se distinguen de los originales en `public/descargas/`.

## Estado de práctica mínimo

Se conserva un adaptador pequeño de `localStorage` para el estado actual y el orden de la sesión. Es una comodidad secundaria: si el contenido cambia, se puede descartar todo el test y volver a hacerlo. Una versión global de almacenamiento o despliegue permite invalidar estados antiguos sin migración por pregunta.

Resetear un test no borra los ejercicios ni otros tests. Resetear un ejercicio de un taller no afecta al resto. El almacenamiento deshabilitado o corrupto permite continuar en memoria. No se guardan historiales ni se introducen herramientas de recuperación de progreso.

## Pruebas obligatorias

Se propone `node:test` para unitarias y Playwright Test configurado con Firefox para E2E. Firefox es parte de la puerta de validación en desarrollo y CI. Playwright utiliza una compilación de Firefox compatible con su versión; se instala junto a las dependencias de pruebas. [Pruebas de Node](https://nodejs.org/api/test.html), [Firefox en Playwright](https://playwright.dev/docs/browsers#firefox).

| Nivel | Cobertura principal |
| --- | --- |
| Unitarias de dominio | Corrección de única, múltiple y ordenar, resultados completos, normalización, tolerancias y estados. |
| Unitarias de mezcla | Permutaciones conocidas con aleatoriedad controlada, preservación de IDs, contexto, explicaciones y entradas originales. |
| Unitarias de catálogo | Esquemas, scope, referencias directas e inversas, deduplicación y detección de dependencias rotas. |
| E2E Firefox | Lectura, índice lateral, filtro simple, relaciones visibles, preguntas y opciones mezcladas, corrección completa, enlace original al fallar y reset. |
| Despliegue | `dist/` servido bajo una subruta, URLs profundas, PDF, assets y referencias internas. |

Las E2E usan fixtures con respuestas conocidas y semillas o fuentes aleatorias controladas. Localizan controles por ID o nombre accesible; no asumen posiciones fijas ni comparan dos mezclas al azar esperando que siempre difieran. Cubren escritorio y viewport estrecho, respetando las excepciones previstas para visuales complejos.

Se valida el banco completo, pero no se escribe una prueba de software por cada pregunta. La exactitud académica y la suficiencia de las explicaciones requieren revisión de contenido. La impresión se comprueba también con la salida paginada de Firefox; emular CSS de impresión no demuestra por sí solo que los cortes de página sean correctos.

Las pull requests validan contenido, ejecutan unitarias, compilan y pasan E2E en Firefox. La rama de publicación despliega únicamente tras superar las mismas comprobaciones. Los enlaces externos se revisan por separado para no depender de que las universidades estén disponibles durante cada ejecución.

## Mantenimiento cotidiano

Se fija la versión de Node y el archivo de bloqueo, y las actualizaciones de dependencias se separan de los cambios de temario. La compilación usa contenido local y no necesita consultar muiot.es para reconstruir el sitio.

Un catálogo pequeño de componentes mantiene coherencia de lectura e impresión. Los nuevos visuales permanecen en su asignatura hasta que exista reutilización real. Las animaciones costosas pueden inicializarse al acercarse a la zona visible, manteniendo todo el texto y alternativas impresas en el HTML inicial.

Antes de migrar todo Protocolos se valida una muestra que atraviese las capas: autoría, relaciones, lectura, impresión, práctica aleatoria y E2E. El objetivo es que el trabajo habitual posterior consista en añadir contenido y ejecutar las herramientas, con pocas modificaciones en el núcleo.
