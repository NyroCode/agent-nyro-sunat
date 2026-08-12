# ADR-0004: cadena de proveedores y procedencia

- Estado: Accepted
- Fecha: 2026-08-08
- Relacionado: [NYR-231](https://linear.app/nyro/issue/NYR-231/disenar-sunat-core-contratos-adapters-e-inyeccion-de-credenciales), [NYR-233](https://linear.app/nyro/issue/NYR-233/consulta-ruc-multi-proveedor-con-fallback-al-padron-local)

## Contexto

Las consultas RUC y de tipo de cambio pueden depender de proveedores privados o datasets locales
porque no todas tienen una API oficial en vivo. Confundir una fuente privada, un padrón desactualizado
y una respuesta oficial produciría resultados difíciles de auditar. Un proveedor externo también puede
fallar o aplicar rate limiting sin que eso convierta el dato en inexistente.

## Decisión

El core define puertos estrictos y una cadena de fallback sin red, filesystem, entorno ni SDKs. La
cadena devuelve el primer resultado concluyente, incluido `found: false`, y conserva intacta la
procedencia aportada por el adapter: `source`, `fetchedAt`, `isOfficial` y, cuando corresponda,
`datasetVersion`.

La política predeterminada sólo continúa ante errores transitorios tipados:
`ProviderUnavailableError` y `RateLimitError`. Autenticación, validación y drift de contrato detienen la
cadena para no ocultar una mala configuración o interpretar una respuesta desconocida. El punto de
composición puede inyectar otra política explícita cuando exista una justificación documentada.

El modo `auto` resuelve la disponibilidad de credenciales en la capa de composición antes de crear la
cadena: un proveedor no configurado se omite, pero un proveedor configurado que responde `401/403`
produce `AuthenticationError` y detiene la consulta. Elegir un proveedor explícitamente también falla
si su credencial no está configurada. De este modo, conveniencia local y autenticación rechazada no
comparten la misma semántica de fallback.

Los adapters concretos de red y padrón local viven fuera del core. Las credenciales se resuelven en el
borde y nunca forman parte de los inputs del puerto.

## Consecuencias

- una caída del proveedor primario puede usar un fallback configurado sin alterar el caso de uso;
- un resultado “no encontrado” no se convierte silenciosamente en una búsqueda indiscriminada;
- cada consumidor puede distinguir dato oficial, privado u offline y su vigencia;
- agregar un proveedor exige normalización, límites de red y contract tests en su paquete adapter;
- los errores no transitorios permanecen visibles en vez de quedar enmascarados por otra fuente.
