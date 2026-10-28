# Cloud Computing: trabajo del agente

## Alcance del examen indicado por el profesor

- Las pruebas del lunes 2 de noviembre son de prácticas a las 18:00 y de teoría a las 19:00. Cada una tiene 10 preguntas tipo test de respuesta única, se realiza en Moovi y no permite consultar materiales.
- En teoría se excluyen el apartado «La iniciativa Cloud-Edge-IoT continuum de la UE» del tema 1 y «Servicios de análisis de datos» del tema 4 (la última parte, pp. 94-98; no generes contenido ni preguntas de ella). Del tema 2 solo entra «Introducción», aunque los servicios AWS del resto del tema pueden preguntarse si se deducen de lo aprendido en las prácticas.
- La prueba de prácticas incluye tanto las prácticas como las actividades adicionales. Puede preguntar conceptos y formatos, como sintaxis de temas MQTT, políticas IoT, temas reservados de AWS, mensajes de sombras y documentos de definición de trabajos.
- El profesor ha remarcado como probables:
  - **Motor de reglas de AWS IoT Core** (T4, pp. 41-51): estructura de una regla, SQL (`SELECT`/`FROM`/`WHERE`), acciones, plantillas de sustitución y Basic Ingest.
  - **Políticas IoT**: hay que entender bien su formato JSON (`Version`, `Statement`, `Effect`, `Action`, `Resource` y sus ARN, variables de política). Prioriza preguntas que obliguen a leer e interpretar documentos de política.
  - **Sombras de dispositivo** (T4, pp. 53-60): importantes. Uso de `desired`/`reported`/`delta`, temas MQTT reservados, sombras clásicas y con nombre, documentos JSON y control de versiones.
  - **Certificados X.509 y certificado de la CA**: casi seguro que entran, aunque es una parte breve. Autenticación mutua TLS: el dispositivo presenta su certificado X.509 (emitido por AWS IoT o por otra CA registrada, no revocado ni caducado) y valida el de IoT Core con el certificado raíz de la CA de Amazon (endpoints ATS) (T4, p. 33). En el aprovisionamiento: certificado y clave privada en el dispositivo, política asociada al certificado y PKI con CA de AWS, propia o de terceros (T4, pp. 62 y 65). Cúbrelo con precisión pero sin extenderte.
  - **Tunelización segura** (T4, pp. 82-85): importante. Acceso a dispositivos tras un firewall sin cambiar sus reglas, proxy local en cada extremo por un puerto abierto (p. ej. 443) con TLS, agente IoT suscrito a `$aws/things/thing-name/tunnels/notify` para recibir el token de acceso cliente (CAT) y arrancar el proxy, y multiplexación de flujos y conexiones TCP.
- Con menor prioridad, el resto del **aprovisionamiento** (T4, pp. 63-69): plantillas, métodos automáticos (individual, en masa, JITP/JITR, flota).
- **No entra el código de los scripts de prácticas.** No añadas comandos, fragmentos de código ni detalles internos de implementación como material de memorización. Sí puede explicarse su función global, por ejemplo preparar el SDK, obtener el endpoint o ejecutar el cliente.
