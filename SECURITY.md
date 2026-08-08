# Política de seguridad

## Reporte responsable

No abras un issue público con detalles explotables, credenciales, certificados o datos personales. Usa el reporte privado de vulnerabilidades de GitHub del repositorio. Si esa función no está disponible, solicita a los mantenedores un canal privado sin incluir todavía el detalle sensible.

Incluye, cuando sea seguro:

- componente y versión afectados;
- impacto y condiciones necesarias;
- pasos mínimos de reproducción con datos sintéticos;
- mitigación temporal conocida;
- indicación expresa de cualquier secreto o dato que deba rotarse/eliminarse.

## Material que nunca debe publicarse

- claves SOL, contraseñas, tokens OAuth, cookies o credenciales de proveedores;
- certificados PFX/P12 y sus contraseñas;
- XML, CDR, padrones o logs con datos reales no autorizados;
- URLs firmadas, identificadores de vault o trazas que permitan reconstruir secretos.

Si un secreto entra en el historial, considera que fue comprometido: revócalo o rótalo y coordina la limpieza del historial. Borrar solamente el archivo en un commit posterior no es suficiente.

## Versiones soportadas

Durante la etapa `0.x`, solo la última versión publicada recibe correcciones. Antes de `v1.0` se publicará una matriz de versiones, runtimes y protocolos MCP soportados.

El modelo detallado de amenazas y los controles de operación están en [docs/security.md](docs/security.md).
