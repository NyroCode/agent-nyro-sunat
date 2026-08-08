# ADR-0001: TypeScript y arquitectura hexagonal

- Estado: Proposed
- Fecha: 2026-08-08
- Relacionado: [NYR-228](https://linear.app/nyro/issue/NYR-228/decidir-lenguaje-y-estrategia-reutilizacion-vs-desde-cero)

## Contexto

El agente necesita CLI, MCP local/remoto, consultas REST, servicios SOAP, XML/UBL, firma, archivos y tareas asíncronas. Existe trabajo previo TypeScript y una alternativa PHP madura, pero ninguna debe definir el dominio ni el modelo de seguridad.

## Decisión propuesta

Usar TypeScript estricto/ESM sobre Node.js 24 LTS y pnpm workspaces para la orquestación. Organizar el sistema con arquitectura hexagonal: dominio y casos de uso puros, puertos explícitos y adaptadores para SUNAT, proveedores, motores documentales, secretos, aprobación, tareas y almacenamiento.

El motor UBL/firma/envío no se decide por adelantado. Se selecciona después de ejecutar una suite de conformidad contra el proyecto TypeScript existente, Greenter y el mínimo interno necesario.

## Consecuencias

Positivas:

- CLI y MCP comparten casos de uso y tipos;
- proveedores y motores se pueden sustituir;
- el SDK oficial MCP y despliegues web tienen integración natural;
- el dominio se prueba sin red, secretos ni XML libraries.

Costos:

- más interfaces y contract tests al inicio;
- un adapter Greenter agregaría runtime/proceso PHP;
- el ecosistema Node para firma/XML debe comprobarse con fixtures reales de beta;
- la versión MCP/SDK deberá fijarse y mantenerse conscientemente.

## Condiciones para aceptar

- spike ejecutable de los motores candidatos;
- librería decimal y stack XML/firma seleccionados con pruebas;
- build mínimo CLI + MCP `stdio` en Node 24;
- confirmación de licencia/distribución de cada dependencia y esquema.
