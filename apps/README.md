# Aplicaciones

Aquí viven las interfaces ejecutables. Se incorporarán por bloques:

- `cli`: interfaz local;
- `mcp-stdio`: MCP local;
- `mcp-http`: MCP remoto, posterior y read-only al inicio.

Las aplicaciones traducen entrada/salida y llaman casos de uso. No contienen reglas tributarias.

## CLI

Después de compilar, configura un perfil sin secretos:

```bash
node apps/cli/dist/main.js perfil-configurar \
  --profile empresa_demo \
  --ruc-consultante 20000000000 \
  --credenciales secret-service
```

En Linux, almacena cada valor directamente en Secret Service. Los comandos leen el valor desde la entrada estándar; el secreto no forma parte de los argumentos:

```bash
secret-tool store --label="Nyro SUNAT client ID" \
  application agent-nyro-sunat profile empresa_demo field client-id

secret-tool store --label="Nyro SUNAT client secret" \
  application agent-nyro-sunat profile empresa_demo field client-secret
```

Luego consulta un comprobante:

```bash
node apps/cli/dist/main.js perfil-verificar \
  --profile empresa_demo \
  --json
```

`perfil-verificar` comprueba OAuth y descarta el token sin mostrarlo ni consultar un CPE. Sólo después, con un comprobante conocido y autorizado, ejecuta:

```bash
node apps/cli/dist/main.js validar-comprobante \
  --profile empresa_demo \
  --ruc-emisor 20000000000 \
  --tipo 01 \
  --serie F001 \
  --numero 1 \
  --fecha 2026-08-08 \
  --monto 118.00 \
  --moneda PEN \
  --json
```

Los RUC y comprobantes de los ejemplos son sintéticos. El modo `environment` usa `SUNAT_CLIENT_ID` y `SUNAT_CLIENT_SECRET` únicamente para desarrollo/CI controlado.

Para una cuenta empresarial real sigue el [protocolo de pruebas de solo lectura](../docs/live-readonly-testing.md). No envíes el token, el secreto ni la Clave SOL a otra persona o sistema.
