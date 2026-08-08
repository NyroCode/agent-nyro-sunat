# Cómo contribuir

Gracias por contribuir a Agent Nyro SUNAT. El software tributario exige una barra de evidencia más alta que una integración ordinaria.

## Antes de abrir un cambio

- Busca un issue existente o abre uno con problema, alcance y evidencia reproducible.
- Para reglas fiscales, enlaza la norma, manual, catálogo o esquema oficial aplicable y su fecha.
- Para cambios arquitectónicos relevantes, crea o actualiza un ADR.
- Nunca publiques credenciales, certificados ni datos reales de contribuyentes.

## Flujo esperado

1. Crea una rama pequeña y enfocada.
2. Añade pruebas antes o junto con el comportamiento.
3. Ejecuta lint, typecheck y la suite correspondiente.
4. Ejecuta `pre-commit run --all-files`; Gitleaks es bloqueante.
5. Documenta el riesgo, la evidencia y las limitaciones conocidas en el PR.
6. Usa datos sintéticos y elimina contenido sensible de logs y capturas.

Los mantenedores pueden pedir una prueba contra el ambiente beta de SUNAT. Esas pruebas se ejecutan únicamente en flujos protegidos, nunca desde PR de forks ni con secretos expuestos al código del contribuidor.

## Compatibilidad pública

Los nombres y esquemas de herramientas MCP, comandos CLI, errores y artefactos forman parte de la interfaz pública. Los cambios incompatibles requieren migración documentada y versión mayor cuando corresponda.

## Dónde colocar el código

- reglas y tipos puros: `packages/core`;
- orquestación y puertos: `packages/core` o el paquete de aplicación definido al iniciar el código;
- APIs oficiales de SUNAT: `packages/sunat`;
- proveedores no oficiales/padrones: `packages/providers`;
- secretos, aprobaciones y auditoría: `packages/security`;
- traducción de casos de uso a MCP: `packages/mcp`;
- ejecutables: `apps/`;
- fixtures y utilidades comunes de pruebas: `packages/testing`.

Lee [AGENTS.md](AGENTS.md) y [la arquitectura](docs/architecture.md) para las restricciones completas.
