# ADR-0003: excluir DNI/RENIEC de v1

- Estado: Proposed
- Fecha: 2026-08-08
- Relacionado: [NYR-234](https://linear.app/nyro/issue/NYR-234/dni-reniec-decision-legal-y-de-producto)

## Contexto

La consulta de DNI involucra datos personales, condiciones de acceso y posibles restricciones legales/contractuales distintas a las consultas tributarias. La investigación disponible no demuestra una API y base jurídica que el proyecto open source pueda ofrecer responsablemente.

## Decisión propuesta

No incluir consulta DNI/RENIEC en `v1`. No se implementarán scraping, RPA ni integración con proveedores cuya autorización, procedencia o tratamiento de datos no estén documentados.

## Reconsideración

La decisión puede revisarse si existe:

- fuente oficial o proveedor con términos compatibles;
- revisión legal de finalidad, consentimiento, retención y redistribución;
- threat model de datos personales;
- contrato de procedencia y pruebas sin datos reales;
- aprobación explícita de producto y seguridad.
