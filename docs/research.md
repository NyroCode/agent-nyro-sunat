# Investigación y decisiones informadas

Fecha de corte: 2026-08-08. Este documento separa evidencia interna, fuentes oficiales y conclusiones de arquitectura. Los enlaces internos pueden requerir acceso a la organización Nyro.

## 1. Lo que Nyro ya había definido

### Producto open source

La página [Agent Nyro SUNAT — Open Source](https://app.notion.com/p/3aeab1dc9e0c812aa30ef613061151c8) ya proponía separar un core, CLI y MCP; empezar por consultas, seguir con emisión y terminar con SIRE. También establecía que el core no maneje credenciales, que la CLI resuelva secretos fuera del modelo y que las acciones productivas tengan aprobación y auditoría.

La misma investigación identifica restricciones importantes:

- no existe una API oficial live y uniforme para toda consulta RUC, por lo que se necesita una cadena de proveedores y padrón local con procedencia explícita;
- CPE combina autenticación, UBL/XML, firma, ZIP, SOAP y CDR;
- GRE es un flujo REST separado y asíncrono;
- SIRE usa tickets y credenciales sensibles;
- Formulario 621 no tiene una API oficial que el proyecto deba prometer;
- DNI/RENIEC tiene riesgo legal y de tratamiento de datos suficiente para excluirlo inicialmente.

### Implementación privada existente

[Nyro SUNAT MCP](https://app.notion.com/p/3a0ab1dc9e0c81069cb7d32fa240235b) documenta un MCP privado en beta dentro de `nyro-integrations`, con perfil, validación, preparación, prueba beta, emisión, consulta de estado y artefactos. Ya hubo aceptación técnica en beta y la emisión productiva exige aprobación/token.

Esto es evidencia de que la secuencia general funciona, pero no convierte automáticamente el código privado en una base publicable. Además, la página contiene una discrepancia entre propiedades y cuerpo sobre el estado de un usuario SOL secundario; debe verificarse en el sistema real y no copiarse como hecho.

### Política de repositorios y agentes

La decisión [Integraciones reusable dentro de nyro-integrations](https://app.notion.com/p/3a0ab1dc9e0c8181bdc3cd9824a7e974) reserva ese repositorio privado para conectores pequeños. Un producto/agente con ciclo de vida propio debe tener repositorio independiente, por lo que `agent-nyro-sunat` es la ubicación correcta.

Las políticas [Nyro Agent Template & Policy](https://app.notion.com/p/0b38323e333f431281192daad57e9dd7) y [Plan de proyecto del cliente](https://app.notion.com/p/39aab1dc9e0c81dfb9cacfbd39d59d82) refuerzan mínimo privilegio, lectura antes que escritura, aprobación explícita, trazabilidad y la prohibición de guardar secretos en Notion, tickets o repositorios.

Los documentos locales de `nyro-hq` añaden que el repositorio es la fuente de verdad técnica, Linear gestiona ejecución, los agentes empiezan read-only y la automatización llega después de repetir correctamente el flujo manual.

### Estado en Linear

El proyecto [Agent Nyro SUNAT (Open Source)](https://linear.app/nyro/project/agent-nyro-sunat-open-source-9d1836ad68a9) está en desarrollo. Las decisiones de lenguaje, repositorio público, core, validación CPE y exclusión de DNI ya fueron cerradas; la consulta RUC multi-proveedor corresponde a NYR-233.

Issues relevantes:

- [NYR-228](https://linear.app/nyro/issue/NYR-228/decidir-lenguaje-y-estrategia-reutilizacion-vs-desde-cero): lenguaje y reutilización;
- [NYR-229](https://linear.app/nyro/issue/NYR-229/credenciales-apis-y-accesos-para-desarrollo-y-beta): accesos y beta;
- [NYR-230](https://linear.app/nyro/issue/NYR-230/crear-repo-publico-agent-nyro-sunat-y-politica-de-secretos): repositorio/política de secretos;
- [NYR-231](https://linear.app/nyro/issue/NYR-231/sunat-core-contratos-de-adapters-y-provenance): contratos y procedencia;
- [NYR-232](https://linear.app/nyro/issue/NYR-232/validacion-cpe-autenticacion-consulta-y-normalizacion): validación CPE;
- [NYR-233](https://linear.app/nyro/issue/NYR-233/consultar-ruc-chain-de-proveedores-y-fallback): RUC/proveedores;
- [NYR-234](https://linear.app/nyro/issue/NYR-234/dni-reniec-decision-legal-y-de-producto): decisión DNI;
- [NYR-235](https://linear.app/nyro/issue/NYR-235/mcp-server-v01-tools-read-only): MCP read-only;
- [NYR-236](https://linear.app/nyro/issue/NYR-236/sire-consultar-obligacion-y-periodos-read-only): SIRE read-only.

## 2. Fuentes oficiales vigentes

### SUNAT y UBL

- El [manual oficial de consulta integrada de CPE](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual-de-Consulta-Integrada-de-Comprobante-de-Pago-por-ServicioWEB_v2_0.pdf) define el flujo de credenciales/token y la consulta del comprobante.
- La sección [Guías y manuales de SUNAT](https://cpe.sunat.gob.pe/guias-y-manuales) concentra reglas de validación, XSD/XSL, catálogos y guías UBL que deben fijarse por versión.
- El [manual del programador del SEE del contribuyente](https://cpe.sunat.gob.pe/sites/default/files/inline-files/manual_programador%20%281%29.pdf) describe XML/ZIP, WS-Security, `sendBill`, resúmenes, tickets y CDR.
- Los [comunicados CPE](https://cpe.sunat.gob.pe/comunicados) publican cambios operativos y el endpoint productivo; deben monitorearse antes de releases con escritura.
- SUNAT documenta los [sistemas de emisión de GRE](https://cpe.sunat.gob.pe/node/116), incluyendo validaciones y la necesidad operativa de contar con una guía aceptada.
- La página oficial de [acceso y formularios SIRE](https://cpe.sunat.gob.pe/node/158) describe credenciales, descarga, aceptación/reemplazo, registro y tickets; la [orientación general SIRE](https://orientacion.sunat.gob.pe/05-registros-electronicos-sire) aporta el contexto del sistema.
- La descarga oficial del [Padrón Reducido del RUC](https://www.sunat.gob.pe/descargaPRR/mrc137_padron_reducido.html) mostraba actualización al 08/08/2026 en la revisión del mismo día. Sigue sin publicarse un SLA de actualización, por lo que el adapter expone siempre la fecha/versión del dataset y no lo presenta como consulta en vivo.
- [API Perú](https://docs.apiperu.dev/referencia/consultar-ruc) documenta `POST https://api.apiperu.dev/ruc` con Bearer token y [Decolecta](https://decolecta.gitbook.io/docs/servicios/integrations) documenta `GET https://api.decolecta.com/v1/sunat/ruc`. Ambos se tratan como proveedores privados, nunca como respuestas oficiales de SUNAT.
- [UBL 2.1 de OASIS](https://docs.oasis-open.org/ubl/prd4-UBL-2.1/UBL-2.1.html) es la base estándar, pero las reglas y personalizaciones de SUNAT siguen siendo obligatorias.

Conclusión: “XML válido UBL” no equivale a “comprobante aceptable por SUNAT”. El producto necesita validación en capas: esquema, reglas SUNAT versionadas, firma/ZIP, beta y CDR.

### MCP

La revisión final [MCP 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) cambió supuestos anteriores: el núcleo del protocolo es stateless por solicitud, las tareas duraderas pasaron a una extensión y varios mecanismos anteriores quedaron obsoletos. El [transporte Streamable HTTP vigente](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/transports/streamable-http.mdx) usa solicitudes HTTP independientes.

El [SDK oficial TypeScript](https://github.com/modelcontextprotocol/typescript-sdk) permite servidores Node y adaptadores web, pero su transición de versiones exige fijar dependencias. Su [guía de versiones de protocolo](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md) muestra que puede ser necesario atender clientes modernos y heredados de forma explícita.

Conclusión: las operaciones asíncronas de GRE/SIRE no deben depender de sesión. Deben persistir un handle y usar la extensión oficial de Tasks. La versión MCP y el SDK forman una decisión de release, no una dependencia flotante.

### Runtime

La [matriz oficial de releases de Node.js](https://nodejs.org/en/about/previous-releases) confirma que Node 24 está en LTS a la fecha de corte. Se toma como baseline por estabilidad; la matriz de CI podrá añadir versiones LTS compatibles sin convertir “latest” en una dependencia implícita.

## 3. Evaluación del ecosistema open source

### Proyecto TypeScript existente

[facturacion-electronica-sunat](https://github.com/MiguelVivar/facturacion-electronica-sunat) tiene licencia MIT y una separación útil entre core, XML, firma, cliente y CLI. Es la opción más cercana al lenguaje objetivo, pero la revisión de código encontró límites que impiden convertirlo de inmediato en dependencia crítica:

- usa `number` y redondeo de JavaScript en partes del cálculo fiscal;
- su generador XML declara validación SUNAT aún incompleta;
- contiene avances de firma/envío posteriores a partes del README, por lo que documentación y código no siempre coinciden;
- la integración GRE todavía no demuestra pruebas reales suficientes;
- su distribución por GitHub Packages añade fricción para consumidores open source.

Decisión: contactar/colaborar y crear un adapter spike, no hacer fork o dependencia rígida antes de contract tests.

### Greenter

[Greenter](https://github.com/thegreenter/greenter) es una implementación PHP madura, MIT y con soporte amplio de creación, firma, envío y CDR. Es una referencia fuerte y posible adaptador local, aunque introducir un runtime/servicio PHP aumenta despliegue y observabilidad.

Decisión: usarlo como benchmark de comportamiento y alternativa de adapter, no colocarlo dentro del core.

### Otras referencias

[OpenUBL/ublhub](https://github.com/project-openubl/ublhub) aporta patrones de ecosistema UBL y servicios, pero tampoco elimina la necesidad de validar reglas específicas de SUNAT ni los controles de aprobación del agente.

## 4. Conclusiones de arquitectura

1. **TypeScript para orquestación y MCP.** Es coherente con el SDK oficial, despliegue local/remoto y activos ya existentes de Nyro.
2. **Arquitectura hexagonal.** SUNAT, proveedores, secretos, motor documental, tareas y auditoría son puertos intercambiables.
3. **No reescribir el motor fiscal como primer paso.** Primero se define una suite de conformidad y se decide entre colaborar, adaptar o completar lo faltante.
4. **Decimales exactos.** Los límites encontrados en el proyecto TS refuerzan que `number` no sea el tipo monetario del dominio público.
5. **Local y read-only primero.** CLI y MCP `stdio` reducen superficie de ataque y permiten validar el producto sin operar un SaaS.
6. **Producción como capacidad separada.** Beta y producción tienen perfiles, permisos, endpoints y gates independientes.
7. **Tareas persistidas.** GRE/SIRE devuelven handles explícitos y sobreviven reinicios.
8. **Procedencia obligatoria.** Especialmente para RUC/padrones, el usuario debe saber fuente, fecha y oficialidad.
9. **DNI y Formulario 621 fuera de `v1`.** No hay evidencia suficiente para incorporarlos de forma responsable.
10. **Single-tenant remoto primero.** Multi-tenant requiere un threat model y aislamiento adicionales.

## 5. Preguntas abiertas que requieren evidencia

- ¿El mantenedor del proyecto TypeScript acepta colaboración y un contrato de precisión/compatibilidad?
- ¿Qué librería decimal y combinación de validador/firma pasan todos los fixtures SUNAT en Node 24?
- ¿Qué XSD, catálogos y padrones pueden redistribuirse y cuáles deben descargarse en instalación?
- ¿Qué versión del SDK MCP está estable al iniciar código y hasta cuándo se soportarán clientes 2025?
- ¿Qué fuentes RUC y de tipo de cambio tienen términos compatibles con uso open source/comercial?
- ¿Qué mecanismo de auditoría local ofrece integridad verificable sin complejidad operativa excesiva?
- ¿Qué casos de timeout de cada servicio SUNAT permiten consulta determinista antes de reenvío?
- ¿Qué partes del MCP privado pueden generalizarse legal y técnicamente sin publicar secretos ni lógica de cliente?

Estas preguntas son tareas de fase 0; ninguna debe resolverse copiando código privado o suponiendo contratos no documentados.
