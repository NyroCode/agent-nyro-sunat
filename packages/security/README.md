# @nyro-sunat/security

Perfiles locales y resolución de credenciales.

El archivo de perfiles contiene únicamente configuración no secreta. En Linux, las credenciales productivas se consultan mediante Secret Service (`secret-tool`). Las variables de entorno están disponibles solo como mecanismo de desarrollo o CI controlado.

Cada perfil queda fijado a la capacidad `cpe-validation-read-only`; un archivo que solicite una capacidad de escritura es rechazado al cargarlo.
