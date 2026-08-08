# Instrucciones de trabajo

Estas reglas aplican a todo el repositorio.

## Antes de cambiar código

1. Leer `README.md`, `docs/architecture.md`, `docs/roadmap.md` y `docs/security.md`.
2. Leer los ADR pertinentes en `docs/adr/`.
3. Vincular el cambio con un issue de Linear cuando exista.
4. Confirmar si el cambio toca solo lectura, preparación o una operación fiscal productiva.

## Fuentes de verdad

- El repositorio es la fuente de verdad técnica del producto.
- Linear registra ejecución, responsables y estado.
- Notion conserva contexto, investigación y decisiones de negocio.
- `nyro-hq` define las políticas transversales de Nyro.
- La documentación oficial vigente de SUNAT y MCP prevalece ante discrepancias técnicas.

## Límites de arquitectura

- `packages/core` debe ser puro: sin red, filesystem, variables de entorno, SDK MCP ni SDK de proveedores.
- Las dependencias apuntan hacia el dominio; los adaptadores implementan puertos definidos por la aplicación.
- CLI y MCP llaman los mismos casos de uso. No deben contener reglas tributarias.
- Dinero y porcentajes se modelan con decimales exactos o unidades menores, nunca con `number` de JavaScript.
- Fechas tributarias se modelan como fecha local explícita, no como instantes UTC implícitos.
- Toda respuesta externa se valida en el borde y se transforma a tipos internos.
- Una integración nueva debe incluir timeout, política de reintento, clasificación de errores y trazabilidad.

## Seguridad y datos

- Prohibido versionar `.env*`, PFX/P12, PEM, llaves, tokens, cookies, dumps o respuestas con datos personales.
- Usar únicamente fixtures sintéticos. Sanitizar cualquier captura antes de almacenarla.
- No aceptar secretos como flags de CLI, parámetros MCP, prompts ni cuerpos de log.
- Una acción fiscal productiva requiere un `ApprovalPort`; no se puede omitir desde un adaptador.
- No reintentar automáticamente una operación fiscal cuyo resultado sea desconocido.
- No incorporar RPA, scraping autenticado ni evasión de controles de SUNAT.

## Calidad mínima

- TypeScript estricto, lint, formato, typecheck y pruebas antes de integrar.
- Pruebas unitarias del dominio, contract tests por adaptador y fixtures dorados para XML/CDR.
- Cambios de esquema público requieren compatibilidad o una versión mayor documentada.
- Todo bug fiscal corregido debe añadir una prueba de regresión.
- No se mezclan refactors amplios con cambios de comportamiento fiscal.

## Git y revisión

- Ramas: `feat/NYR-123-descripcion`, `fix/NYR-123-descripcion` o equivalente documentado.
- Los PR deben explicar riesgo, evidencia, pruebas y eventual rollback.
- No se habilitan secretos de producción en PR de forks.
- Cambios en emisión productiva, autenticación, aprobación o criptografía requieren revisión adicional.
