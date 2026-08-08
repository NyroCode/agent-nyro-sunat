# Changelog

Los cambios relevantes se documentan aquí siguiendo categorías compatibles con Semantic Versioning.

## Unreleased

### Added

- Documentación inicial de arquitectura, seguridad y roadmap.
- Base del monorepo con Node.js, pnpm, TypeScript, Biome y Vitest.
- Verificación continua para formato, lint, tipos y pruebas.
- Núcleo read-only con value objects, contratos, procedencia, errores tipados y puertos.
- Casos de uso read-only y adapters simulados para probar flujos sin red ni credenciales.
- Adaptador oficial de consulta integrada CPE con OAuth, allowlist y normalización segura.
- Perfiles locales, Secret Service y CLI read-only para validación CPE.
- Capacidad fija `cpe-validation-read-only`, diagnóstico OAuth sin exposición del token y protocolo para pruebas controladas con un RUC empresarial real.
- Pruebas de allowlist que bloquean explícitamente rutas de emisión de SUNAT y SUNAT Beta.
- Cadena configurable de fallback para consultas RUC, con procedencia preservada y política segura
  para fallas transitorias.
- Evidencia actualizada sobre la vigencia del Padrón Reducido oficial para preparar NYR-233.
- Escaneo bloqueante de secretos en pre-commit y CI, incluido un canary sintético, junto con avisos
  explícitos de privacidad, riesgo tributario y ausencia de garantías.

### Fixed

- Compatibilidad OAuth con `token_type` `JWT`, observado en la respuesta actual de SUNAT,
  conservando soporte para `Bearer`.
- Cobertura de regresión para refresh anticipado del token y respuestas contractuales de CPE
  aceptado, inexistente, anulado y con RUC no habido.
- La CLI conserva en errores JSON únicamente detalles tipados y controlados como `provider`,
  `external_code` o `field`, facilitando el diagnóstico sin exponer respuestas externas.
