# Autoría con agentes a partir del PC

El agente realiza la catalogación, la creación de archivos y la redacción. El usuario indica una ruta local, la asignatura y el trabajo deseado en su prompt. Las rutas pueden apuntar a archivos o carpetas externas al repositorio.

## Flujo de trabajo

1. Leer `AGENTS.md` y consultar el catálogo: `bun run content:list --json`.
2. Inventariar la ruta con `content:inspect --source RUTA --json`. El inventario no modifica ni publica los originales.
3. Leer los archivos relevantes con las herramientas del agente. En PDF, verificar páginas físicas y figuras. La extracción de texto por sí sola puede perder información gráfica.
4. Reutilizar la asignatura y tags existentes. Crear sus fichas si faltan. Una asignatura necesita una guía docente real del curso 2026/27.
5. Incorporar los originales PDF relevantes con `content:import`. Leer otros formatos como fuentes de autoría y convertir el material pertinente en lecturas. La incorporación automática de originales descargables está limitada a PDF en este incremento.
6. Crear y editar lecturas, preguntas y ejercicios. Completar alcance, soluciones, explicaciones y citas verificadas.
7. Ejecutar `content:check --json`, reparar errores y ejecutar `bun run check`.
8. Revisar suficiencia de las explicaciones, exactitud académica y presentación; la compilación no demuestra que una cita respalde realmente una afirmación.

El agente puede escribir los archivos directamente. La CLI facilita las operaciones repetibles y valida los contratos. No hay servicio LLM en la web, clave de API, cola de ingesta ni dependencia de una carpeta personal durante la compilación.

## Incorporar un original

```bash
bun run content:import \
  --source '/ruta/local/Tema 3 - IP en IoT.pdf' \
  --subject protocolos \
  --slug tema-3-ip-en-iot \
  --title 'Tema 3 · IP en IoT' \
  --scope 'Documento original completo del tema 3.' \
  --tags protocolos.tags.ipv6,protocolos.tags.ndp \
  --json
```

El comando copia el archivo a `public/materiales/<asignatura>/`, crea su ficha y obtiene páginas y SHA-256. Mantiene el nombre original y una procedencia legible. La ruta absoluta de entrada no se incluye en la ficha publicada. Si el mismo PDF ya existe en la asignatura, devuelve su ID. Nunca sobrescribe un original o manifiesto existente. Una edición diferente requiere otro ID y revisión de sus citas.

Las citas usan `materialId` y `pdfPages`. La portada cuenta como página 1. El texto de `scope` delimita qué parte del material utiliza cada recurso.

## Crear y consultar contenido

```bash
bun run content:new --kind apuntes --subject protocolos --slug mi-lectura \
  --title 'Mi lectura' --scope 'Apartados concretos que cubre.' \
  --tags protocolos.tags.ipv6 --json

bun run content:new --data /ruta/a/manifiesto-completo.json --json
bun run content:show protocolos.preguntas.longitud-ipv6 --json
bun run content:impact protocolos.apuntes.ipv6-y-vecinos --json
bun run content:impact component:protocolos.ndp --json
bun run content:report --json
bun run content:schema --json
```

Tipos de `new`: `bimestre`, `asignatura`, `tag`, `apuntes`, `resumen`, `pregunta`, `test`, `ejercicio`. Los materiales se crean con `import`. Una plantilla nueva contiene campos `PENDIENTE`; deben completarse antes de que pase `check`. No se inventan fuentes para producir una plantilla aparentemente válida. La autoría puede añadir varios archivos relacionados antes de validar el conjunto.

Con `--data`, el manifiesto se valida antes de escribirlo. Si es una lectura, se crea también un cuerpo pendiente. Todos los comandos aceptan `--json` y `--root RUTA`; el código de salida es 0 en éxito y 1 en error. Para consumir exclusivamente JSON sin el anuncio del comando, usa `bun run --silent content:check --json` o `bun scripts/content/cli.ts check --json`.

## Contratos y ejemplos reales

Los tipos TypeScript se derivan de `src/schemas/content.ts`. `content:schema` emite el esquema JSON; las reglas entre recursos y los refinamientos siguen comprobándose con `content:check`.

| Tipo | Ejemplo completo |
| --- | --- |
| Lectura Astro | `content/asignaturas/protocolos/apuntes/ipv6-y-vecinos/` |
| Lectura MDX | `content/asignaturas/protocolos/resumenes/ipv6-esencial/` |
| Respuesta única | `content/asignaturas/protocolos/preguntas/longitud-ipv6.json` |
| Respuesta múltiple | `content/asignaturas/protocolos/preguntas/tipos-ipv6.json` |
| Ordenar | `content/asignaturas/protocolos/preguntas/intercambio-ndp.json` |
| Test con grupos | `content/asignaturas/protocolos/tests/repaso-ipv6.json` |
| Formulario | `content/asignaturas/protocolos/ejercicios/tamano-ipv6/recurso.json` |
| Taller | `content/asignaturas/protocolos/ejercicios/explorar-ndp/recurso.json` |

`kind` es obligatorio en todas las entidades, incluidas preguntas, tags, asignaturas y bimestres. Los IDs son globales y estables. Los slugs pueden repetirse entre asignaturas; no pueden colisionar las rutas resultantes. En lecturas, cambiar el slug no exige mover el cuerpo. Añade la ruta anterior completa a `aliases`, relativa a la raíz del sitio y sin la base de despliegue.

## Lecturas y componentes

Cada lectura contiene `recurso.json` y exactamente un `body.mdx` o `body.astro`. El cuerpo no define metadatos, navegación, `html`, `head` ni `h1`. El layout genera el índice a partir del HTML durante la construcción, conservando las anclas explícitas.

Los apartados citados deben tener IDs explícitos, por ejemplo `<h2 id="direcciones">Direcciones</h2>`. Retitular un apartado conserva su ID. La validación posterior a la compilación comprueba anclas en ambos formatos y enlaces internos.

Declara `componentIds` para los componentes interactivos utilizados. El registro declarativo está en `src/lib/registro.ts`; los módulos de talleres se registran también en `src/lib/talleres.ts`. Las declaraciones alimentan el análisis de impacto. La comprobación actual detecta la importación directa por nombre de archivo de componentes registrados; no analiza toda la cadena de imports de un componente envoltorio. Si se añade un envoltorio, declara también sus dependencias registradas.

Los visuales contienen su explicación estática en el HTML, controles de teclado y alternativa impresa. Usa IDs distintos para varias instancias del mismo componente. El índice y los textos funcionan sin JavaScript.

## Preguntas y sesiones

- `single`: `answer` es el ID de una opción.
- `multiple`: `answer` es una lista de IDs; exige todas las correctas y ninguna incorrecta.
- `ordering`: `answer` contiene todos los IDs en el orden correcto; cada elemento tiene `placementExplanation`.

Cada alternativa necesita `explanation`; cada pregunta, una explicación general y `originalReferences` con páginas reales que expliquen la solución. No utilices letras posicionales, «la anterior» ni «todas las anteriores». La interfaz mezcla opciones y preguntas, manteniendo el contexto de cada grupo.

El subconjunto de formato implementado en enunciados y explicaciones JSON admite texto, `código`, **negrita** y saltos de línea. El HTML se escapa. Las fórmulas y las imágenes dentro de preguntas quedan para ampliar este contrato; las lecturas MDX/Astro ya permiten composición enriquecida.

Los tests enumeran las preguntas explícitamente y no admiten repeticiones. Sus tags temáticos deben ser la unión de los de sus preguntas; los tags de estudio se eligen editorialmente. Añadir una pregunta al banco no modifica los tests existentes.

El progreso guarda únicamente la sesión actual y se invalida cuando cambian los datos de la actividad. Se conserva el orden al reanudar. El reset afecta solo a esa actividad y los fallos de almacenamiento permiten continuar en memoria.

## Qué valida cada fase

| Fase | Comprobación |
| --- | --- |
| `content:check` | Esquemas, referencias, pertenencia, tags, soluciones, grupos, cuerpos, hash y páginas de PDF. |
| `typecheck` | TypeScript estricto en código, herramientas y componentes Astro. |
| `build` | Validación previa, generación y comprobación de enlaces, assets y anclas de `dist/`. |
| `test:unit` | Dominio, aleatoriedad, catálogo, autoría y errores relevantes. |
| `test:e2e` | Firefox sobre el resultado compilado: interacción, accesibilidad básica, móvil, persistencia y fuentes. |

El agente revisa además la exactitud del contenido. Los cambios de impresión requieren examinar la salida paginada de Firefox, que no queda demostrada por emular el medio `print`.
