# @nyro-sunat/core

Dominio puro, casos de uso y puertos de Agent Nyro SUNAT.

Este paquete no puede acceder a red, filesystem, variables de entorno, SDK MCP ni gestores de secretos. Los adapters dependen de sus contratos, nunca al revés.

`FallbackTaxpayerLookup` compone providers sin acoplar el dominio a ellos. Por defecto sólo avanza
ante indisponibilidad o rate limit; conserva la procedencia del primer resultado concluyente.

Durante `0.x` permanece privado para evitar una publicación accidental mientras se estabiliza la API.
