# ADR-0002: local-first y aprobación productiva

- Estado: Accepted
- Fecha: 2026-08-08

## Contexto

Las credenciales SOL y certificados tienen alto impacto, y varias acciones producen efectos fiscales difíciles de revertir. Un agente puede recibir instrucciones ambiguas o maliciosas y no debe ser el único control de autorización.

## Decisión

El modo predeterminado es local y read-only. La primera interfaz MCP usa `stdio`; HTTP remoto llega después y comienza también read-only.

Toda escritura fiscal productiva requiere aprobación humana externa al modelo, específica para un digest, acción, perfil, ambiente e identidad. La aprobación expira y se consume una sola vez. Los secretos se resuelven mediante referencias opacas en keychain o secret manager y nunca forman parte de schemas MCP/CLI.

## Consecuencias

- la experiencia productiva requiere un paso adicional deliberado;
- beta no concede permiso para producción;
- automatizaciones unattended de emisión quedan fuera del alcance inicial;
- el control funciona igual para CLI, MCP y futuros clientes;
- es necesario persistir nonces, auditoría e idempotencia.
