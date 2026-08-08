# Paquetes

Aquí viven el dominio, los puertos y sus adaptadores. La dirección de dependencias siempre apunta hacia el core y ningún paquete externo puede introducir I/O dentro del dominio.

La estructura se creará de manera incremental para evitar paquetes vacíos o APIs prematuras.

Paquetes actuales:

- `core`: tipos, errores y puertos read-only sin I/O.
- `testing`: adapters simulados y fixtures exclusivamente sintéticos.
- `sunat`: adaptadores para APIs y servicios oficiales, aislados del core.
- `security`: perfiles no secretos y resolución de credenciales fuera del agente.
