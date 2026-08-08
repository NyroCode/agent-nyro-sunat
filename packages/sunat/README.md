# @nyro-sunat/sunat

Adaptadores para servicios oficiales de SUNAT.

La implementación actual cubre la consulta integrada de validez CPE y su token OAuth `client_credentials`. Los endpoints están fijados mediante allowlist y las credenciales se obtienen desde un provider inyectado; nunca son argumentos del caso de uso ni del futuro MCP.

Contrato oficial: [Manual de consulta integrada de comprobante de pago por servicio web](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual-de-Consulta-Integrada-de-Comprobante-de-Pago-por-ServicioWEB_v2.pdf).
