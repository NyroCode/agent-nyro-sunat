# Roadmap por fases

Este roadmap prioriza evidencia y seguridad sobre cantidad de integraciones. Las duraciones son bandas de planificación para un equipo pequeño y empiezan cuando las dependencias y accesos estén disponibles; no son compromisos de calendario.

## Vista general

| Fase | Hito | Resultado | Banda orientativa |
|---|---|---|---:|
| 0 | Fundaciones | ADR, threat model, contratos y CI | 1–2 semanas |
| 1 | `v0.1` local read-only | Core + CLI + MCP stdio con cuatro consultas | 3–5 semanas |
| 2 | `v0.2` remoto read-only | Streamable HTTP, identidad y operación segura | 2–3 semanas |
| 3 | `v0.3` preparación/beta | UBL, firma, artefactos y envío beta | 4–8 semanas |
| 4 | `v0.5` CPE productivo | Emisión controlada, aprobación y reconciliación | 3–5 semanas |
| 5 | `v0.6` GRE | Flujo asíncrono completo y CDR | 3–5 semanas |
| 6 | `v0.8` SIRE | Lectura primero, escrituras separadas y aprobadas | 5–8 semanas |
| 7 | `v1.0` estable | Compatibilidad, hardening y comunidad | 2–4 semanas |

No se deben ejecutar todas las fases como una cascada cerrada. Cada una termina en una versión utilizable y un gate de continuar/no continuar.

## Fase 0 — Fundaciones y decisiones

Objetivo: convertir la investigación en contratos verificables antes de escribir integraciones difíciles de reemplazar.

Entregables:

- aceptar o ajustar los ADR iniciales;
- decidir Node/pnpm, librería decimal, validación de esquemas y soporte MCP;
- crear workspaces, configuración TypeScript, lint, tests y CI;
- activar Dependabot, CodeQL, secret scanning/push protection y protección de rama;
- publicar `SECURITY.md`, `CONTRIBUTING.md`, licencia y plantillas de issue/PR;
- definir esquemas JSON de las cuatro consultas de `v0.1`;
- definir taxonomía de errores, `Provenance` y política de versiones;
- implementar puertos falsos y fixtures completamente sintéticos;
- ejecutar spike comparativo de motor TS, Greenter y build mínimo propio;
- validar la redistribución de esquemas/catálogos/padrones.

Issues de origen: [NYR-228](https://linear.app/nyro/issue/NYR-228/decidir-lenguaje-y-estrategia-reutilizacion-vs-desde-cero), [NYR-230](https://linear.app/nyro/issue/NYR-230/crear-repo-publico-agent-nyro-sunat-y-politica-de-secretos), [NYR-231](https://linear.app/nyro/issue/NYR-231/sunat-core-contratos-de-adapters-y-provenance).

Criterios de salida:

- el CI detecta secretos, lint, type errors y tests;
- el dominio compila sin adaptadores ni acceso a I/O;
- los cuatro contratos públicos tienen ejemplos válidos/inválidos;
- existe una matriz escrita del motor documental con evidencia ejecutable;
- no queda una decisión bloqueante de licencia o distribución.

## Fase 1 — Core de consultas y MCP local (`v0.1`)

Objetivo: entregar valor real sin riesgo fiscal de escritura.

### 1A. Dominio y aplicación

- value objects: RUC, fechas, periodos, monedas, importes y procedencia;
- casos de uso y puertos para RUC, validación CPE, padrón y tipo de cambio;
- exactitud decimal y normalización de errores;
- timeouts, cancelación y presupuestos de reintento solo para lecturas seguras;
- resultados deterministas con `request_id` y warnings.

### 1B. Adaptadores

- autenticación y consulta oficial de validación CPE;
- cadena configurable de fuentes RUC;
- descarga/verificación/consulta de padrón local;
- fuente de tipo de cambio con fecha y oficialidad;
- caché con TTL y clave que incluya proveedor/versión;
- circuit breaker y rate limit por proveedor.

La ausencia de una API oficial live de RUC debe ser visible: nunca se presenta un proveedor privado como SUNAT ni se oculta la antigüedad del padrón.

### 1C. Interfaces

- CLI humana y salida `--json` estable;
- servidor MCP `stdio` con `consultar_ruc`, `validar_comprobante`, `consultar_padron` y `tipo_cambio`;
- configuración por archivo/perfil y referencias opacas de secretos;
- documentación de instalación y ejemplos con datos sintéticos.

Issues de origen: [NYR-232](https://linear.app/nyro/issue/NYR-232/validacion-cpe-autenticacion-consulta-y-normalizacion), [NYR-233](https://linear.app/nyro/issue/NYR-233/consultar-ruc-chain-de-proveedores-y-fallback), [NYR-235](https://linear.app/nyro/issue/NYR-235/mcp-server-v01-tools-read-only).

Criterios de salida:

- contract tests pasan para cada adaptador habilitado;
- fallas de red/proveedor no se confunden con “no existe”;
- ninguna herramienta acepta o devuelve secretos;
- fixtures, documentación y logs contienen solo datos sintéticos;
- una instalación limpia puede ejecutar las cuatro herramientas localmente;
- release `v0.1.0` firmada con changelog y checksums.

## Fase 2 — MCP remoto de solo lectura (`v0.2`)

Objetivo: permitir despliegues remotos sin mezclar identidad MCP con credenciales tributarias.

Entregables:

- servidor Streamable HTTP stateless;
- autenticación del cliente, autorización por herramienta y rate limits;
- configuración single-tenant documentada;
- almacén remoto de configuración/secretos administrado;
- compatibilidad de protocolo fijada y probada;
- límites de payload, timeouts, CORS/origin validation cuando aplique;
- observabilidad sanitizada y runbook de incidentes;
- despliegue de referencia reproducible.

Criterios de salida:

- pruebas de aislamiento de identidad y perfiles;
- threat model remoto revisado;
- pentest ligero de autenticación, SSRF y filtración de logs;
- ninguna función fiscal de escritura expuesta;
- rollback y rotación de secretos ensayados.

## Fase 3 — Preparación documental y beta (`v0.3`)

Objetivo: construir, validar, firmar y probar comprobantes sin habilitar todavía producción.

Entregables:

- decisión final e integración del `DocumentEnginePort`;
- facturas y boletas UBL 2.1 mínimas, luego notas de crédito/débito;
- cálculo decimal exacto y reglas configurables/versionadas;
- validación XSD y reglas vigentes de SUNAT antes de firmar;
- firma XML con certificado resuelto desde `SecretPort`;
- ZIP determinista, parser de CDR y almacén de artefactos con hashes;
- cliente SOAP beta, incluyendo `sendBill`, tickets y consulta de estado según operación;
- comandos/herramientas de preparación y prueba beta separados;
- corpus de rechazos beta sanitizado y pruebas de regresión.

Criterios de salida:

- fixtures representativos validan contra esquemas y reglas fijadas;
- cálculos monetarios pasan tests de propiedades y casos de borde;
- certificados nunca persisten en logs ni artefactos temporales inseguros;
- una prueba beta protegida produce evidencia reproducible y CDR parseado;
- ninguna ruta de código puede apuntar a producción en esta versión.

## Fase 4 — Emisión CPE productiva (`v0.5`)

Objetivo: habilitar emisión directa únicamente después de probar la cadena completa y los controles humanos.

Entregables:

- perfil de producción separado de beta;
- resumen preflight legible y digest canónico del payload;
- aprobación humana ligada a acción, identidad, perfil, ambiente, TTL y nonce;
- consumo atómico y de una sola vez del token de aprobación;
- idempotencia local y reconciliación ante timeouts ambiguos;
- auditoría append-only con hashes de XML/ZIP/CDR;
- allowlist exacta de endpoints oficiales;
- runbooks: caída SUNAT, rechazo, duplicidad, certificado vencido, revocación;
- feature flag de producción deshabilitada por defecto.

Criterios de salida:

- al menos dos ciclos manuales/beta completos y auditados antes de automatizar;
- revisión de seguridad específica para secretos, firma y aprobación;
- simulaciones demuestran que replay, aprobación vencida o payload modificado fallan;
- un timeout posterior al envío entra a reconciliación, no a reintento ciego;
- piloto productivo autorizado, de alcance acotado y con rollback operativo.

## Fase 5 — Guía de Remisión Electrónica (`v0.6`)

Objetivo: incorporar GRE como capacidad separada, no como una variación superficial de factura.

Entregables:

- tipos, reglas, endpoints y autenticación propios de GRE;
- preparación, validación, firma y envío por API oficial;
- `TaskHandle` persistido para operaciones asíncronas;
- polling con backoff, timeout total y cancelación cuando sea posible;
- descarga/verificación de CDR y gate de “aceptada antes del traslado”;
- aprobación productiva y auditoría equivalentes a CPE.

Criterios de salida:

- estados de tarea sobreviven reinicios y no dependen de sesión MCP;
- una GRE no se declara lista sin CDR aceptado;
- pruebas beta cubren éxito, observación, rechazo, ticket vencido y servicio caído;
- soporte productivo tiene runbook propio.

## Fase 6 — SIRE (`v0.8`)

Objetivo: soportar libros electrónicos con separación estricta entre consulta, preparación y aceptación/reemplazo.

### 6A. Solo lectura

- consultar obligaciones/periodos disponibles;
- descargar propuestas y archivos;
- consultar tickets y normalizar estados;
- validar localmente integridad y periodo.

### 6B. Escrituras controladas

- registrar preliminares, aceptar o reemplazar propuestas solo con aprobación específica;
- artefactos y diff legible antes de aprobar;
- tareas persistidas y reconciliación;
- límites de tamaño y procesamiento seguro de archivos.

Issue de origen: [NYR-236](https://linear.app/nyro/issue/NYR-236/sire-consultar-obligacion-y-periodos-read-only).

Criterios de salida:

- la lectura opera independientemente de cualquier permiso de escritura;
- cada aprobación muestra periodo, operación, conteos, totales y hash;
- archivos grandes, maliciosos o inesperados se rechazan de forma segura;
- aceptación/reemplazo se prueba en entorno y procedimiento oficialmente admitidos;
- Formulario 621 y RPA permanecen fuera de alcance.

## Fase 7 — Estabilización y `v1.0`

Objetivo: convertir las capacidades probadas en una plataforma mantenible para terceros.

Entregables:

- matriz de compatibilidad: Node, SO, MCP, tipos de comprobante y servicios SUNAT;
- política de soporte/deprecación y SemVer;
- documentación de despliegue local y remoto;
- SBOM, procedencia de builds, releases firmadas y verificación reproducible;
- auditoría de dependencias, licencias y superficie de supply chain;
- benchmark de rendimiento y límites documentados;
- guía de creación de adaptadores y suite pública de conformidad;
- ejemplos end-to-end sintéticos;
- triage, plantillas, gobernanza y calendario de mantenimiento.

Criterios de salida:

- cero hallazgos críticos abiertos en seguridad;
- APIs públicas congeladas y documentadas para `1.x`;
- restauración, rotación y respuesta a incidentes ensayadas;
- un contribuidor externo puede implementar un adaptador usando solo documentación y tests;
- cada capacidad productiva tiene propietario, runbook y señal de salud.

## Gates transversales

Una fase no avanza por “código terminado” solamente:

1. **Legal/datos:** derecho a usar y redistribuir fuentes y fixtures.
2. **Contrato:** esquemas, errores y compatibilidad definidos.
3. **Seguridad:** amenazas nuevas evaluadas y controles probados.
4. **Evidencia:** pruebas automatizadas y, cuando corresponde, evidencia beta.
5. **Operación:** métricas, alertas, rollback y responsable.
6. **Documentación:** límites y riesgos visibles para usuarios.

## Backlog explícitamente fuera de `v1`

- consulta DNI/RENIEC hasta resolver base legal, acceso y tratamiento de datos ([NYR-234](https://linear.app/nyro/issue/NYR-234/dni-reniec-decision-legal-y-de-producto));
- automatización o presentación del Formulario 621 sin API oficial;
- RPA de SOL o scraping de portales autenticados;
- plataforma SaaS multi-tenant general;
- asesoría tributaria automática o interpretación normativa sin revisión humana;
- soporte de todos los comprobantes y regímenes desde la primera versión.

## Riesgos que cambian el orden

- Si el motor TypeScript no alcanza precisión, firma o mantenimiento aceptables, la fase 3 usará un adaptador maduro antes de una reescritura total.
- Si MCP/SDK mantiene APIs inestables, `v0.1` fijará una versión y el CLI seguirá siendo interfaz de referencia.
- Si no hay acceso oficial reproducible a una fuente, se publica la limitación y se prioriza padrón/proveedor con procedencia; no se simula oficialidad.
- Si beta no representa una operación real suficiente, producción permanece deshabilitada.
- Si una operación no permite reconciliar ambigüedad, no se automatiza hasta diseñar un control operativo aceptable.

## Relación con el plan original de Nyro

- Macrofase 1, lectura/consulta: fases 0–2 de este documento.
- Macrofase 2, emisión CPE/GRE: fases 3–5.
- Macrofase 3, libros/SIRE: fase 6.
- La fase 7 añade los requisitos de estabilidad propios de un proyecto open source y no de un desarrollo puntual para un cliente.
