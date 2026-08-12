# `@nyro-sunat/providers`

Adaptadores read-only para consulta RUC y datasets oficiales locales.

- API Perú y Decolecta se consideran fuentes privadas (`isOfficial=false`).
- El Padrón Reducido conserva `isOfficial=true`, pero siempre expone su fecha como
  `datasetVersion` y advierte que no es tiempo real.
- Los tokens se inyectan mediante `ApiTokenProvider`; nunca forman parte del input de una consulta.
- No se reintenta el mismo proveedor para no duplicar consumo de cuota. La continuidad se obtiene con
  la cadena de fallback tipada del core.

El padrón se descarga a un archivo temporal con límites, se procesa por streaming y se importa a una
base SQLite temporal. La base activa solo se reemplaza después de validar completamente el ZIP, la
cabecera y todas las filas.

El formato vigente contiene excepcionalmente separadores adicionales en campos de dirección que este
adapter no persiste. Se aceptan como máximo 17 columnas siempre que los cuatro campos consumidos sean
válidos. Las filas cuyo RUC no tiene exactamente 11 dígitos se omiten, se cuentan en
`skippedRowCount` y quedan visibles mediante un warning en cada consulta local.
