# Pruebas reales de solo lectura

Este procedimiento permite comprobar la autenticación OAuth y la Consulta Integrada de CPE con un RUC empresarial autorizado. **No autoriza ni prueba emisión, anulación, baja, GRE, SIRE o envío UBL.** Las credenciales son reales aunque el uso se limite a una consulta.

## Límite de seguridad

La versión actual sólo contiene la capacidad `cpe-validation-read-only`. Su allowlist de red admite el endpoint OAuth previsto y `validarcomprobante`; rechaza los servicios de emisión de SUNAT y SUNAT Beta. No existe un caso de uso, comando o adapter para emitir comprobantes.

Esto reduce el riesgo de una acción fiscal accidental, pero no sustituye la autorización de la empresa, la custodia de secretos ni la revisión de los datos usados en la prueba.

## Antes de empezar

- Obtén autorización del responsable del RUC para crear y usar una aplicación API exclusiva de pruebas.
- Crea una aplicación separada, por ejemplo `Agent Nyro SUNAT OSS Read-only Test`. No reutilices credenciales de ERP, facturación, SIRE u otra integración.
- Guarda `client_id` y `client_secret` fuera de Git. Secret Service es el mecanismo recomendado para uso local habitual; `.env.local` está soportado para desarrollo read-only controlado. No compartas Clave SOL, token, secretos, capturas o archivos de credenciales por chat, Notion, Linear, GitHub o logs.
- Selecciona un CPE ya existente, emitido o recibido legítimamente por la empresa, cuyo estado esperado pueda comprobar el responsable. No inventes una serie/número ni uses comprobantes de terceros al azar.
- Ejecuta primero toda la suite automatizada sin red.

La CLI obtiene internamente un token de corta duración a partir de `client_id` y `client_secret`. No necesitas generar ni copiar un `access_token` al proyecto o a este chat.

## Secuencia controlada

### 1. Verificación local

```bash
pnpm check
```

### 2. Perfil sin secretos

```bash
node apps/cli/dist/main.js perfil-configurar \
  --profile empresa_prueba \
  --ruc-consultante RUC_AUTORIZADO \
  --credenciales secret-service
```

El archivo de perfiles sólo conserva RUC, fuente de credenciales y la capacidad de solo lectura. Para
desarrollo con variables de entorno usa `--credenciales environment`; el secreto tampoco se guarda en
el perfil.

### 3A. Secret Service (recomendado)

Ejecuta cada comando y escribe el valor cuando `secret-tool` lo solicite por la entrada estándar:

```bash
secret-tool store --label="Nyro SUNAT client ID" \
  application agent-nyro-sunat profile empresa_prueba field client-id

secret-tool store --label="Nyro SUNAT client secret" \
  application agent-nyro-sunat profile empresa_prueba field client-secret
```

### 3B. `.env.local` (desarrollo local)

Copia las claves vacías de `.env.example` a un archivo `.env.local` ignorado por Git, asigna permisos
restrictivos y completa los valores directamente en tu equipo:

```bash
chmod 600 .env.local
```

```dotenv
SUNAT_CLIENT_ID=
SUNAT_CLIENT_SECRET=
```

No ejecutes `git add -f`, no adjuntes el archivo a issues y no lo uses para un MCP remoto. Node no lo
carga implícitamente: el comando debe usar `--env-file=.env.local` o recibir las variables desde el
proceso supervisor.

### 4. Diagnóstico OAuth sin consulta tributaria

```bash
node apps/cli/dist/main.js perfil-verificar \
  --profile empresa_prueba \
  --json
```

Si el perfil usa `environment`, ejecuta en su lugar:

```bash
node --env-file=.env.local apps/cli/dist/main.js perfil-verificar \
  --profile empresa_prueba \
  --json
```

Este comando solicita el token, comprueba la autenticación, lo descarta y devuelve únicamente perfil,
capacidad, fecha y `requestId`. No consulta ningún comprobante y nunca imprime el token.

### 5. Una consulta conocida

Con los datos exactos del CPE autorizado:

```bash
node apps/cli/dist/main.js validar-comprobante \
  --profile empresa_prueba \
  --ruc-emisor RUC_DEL_EMISOR \
  --tipo TIPO_CPE \
  --serie SERIE \
  --numero NUMERO \
  --fecha AAAA-MM-DD \
  --monto TOTAL_EXACTO \
  --moneda PEN \
  --json
```

Agrega `--env-file=.env.local` después de `node` cuando el perfil use `environment`.

Realiza primero una sola consulta y compara el estado normalizado con el estado esperado. Una prueba negativa sólo debe hacerse después, modificando un dato controlado y sin introducir información de terceros.

### 6. Cierre

- Conserva únicamente evidencia sanitizada: `requestId`, fecha, fuente y estado normalizado.
- No guardes headers, tokens, secretos, Clave SOL, cuerpos completos ni datos personales.
- Al terminar, rota o elimina la aplicación API de prueba en SOL si ya no será utilizada. Si conservas
  `.env.local`, mantenlo con permisos `0600`; elimínalo cuando deje de ser necesario.

## Condiciones de aborto

Detén la prueba si aparece una URL que no sea la de autenticación o `validarcomprobante`, si la respuesta no coincide con el contrato conocido, si un secreto aparece en pantalla/logs, si falta autorización o si la autenticación falla repetidamente. No pruebes otra API para “ver si funciona”.

Referencia: [Manual de Consulta Integrada de Comprobante de Pago por Servicio Web de SUNAT](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual-de-Consulta-Integrada-de-Comprobante-de-Pago-por-ServicioWEB_v2.pdf).
