# `@nyro-sunat/contracts`

Contratos JSON públicos y versionados compartidos por CLI y MCP.

- Los nombres de tools permanecen en español y `snake_case`.
- Los campos JSON usan `camelCase`, igual que MCP y TypeScript.
- Cada tool declara `inputSchema` y `outputSchema` en JSON Schema 2020-12.
- El dominio no depende de este paquete; el mapper transforma resultados internos en DTO públicos.
- Una respuesta pública incluye `schemaVersion`, `data`, `provenance`, `warnings` y `requestId`.

El futuro servidor MCP devolverá el DTO en `structuredContent` y una copia JSON en `content` para
compatibilidad con clientes anteriores.
