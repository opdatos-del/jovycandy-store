# PostgreSQL aislado para integración

**Estado: PREPARADO PARCIALMENTE. No ejecutar las suites de integración todavía.**

El entorno local creado para esta investigación es un cluster PostgreSQL 18.6
independiente en `127.0.0.1:55432`, con usuario exclusivo `jovy_test` y
SCRAM-SHA-256. El servicio de desarrollo en el puerto 5432 no forma parte de
este entorno. La carpeta del cluster está fuera del repositorio:

```text
%LOCALAPPDATA%\JovyCandy\integration-postgres-f002598ccccd4f44b0f0a066e00fe7ad\data
```

El archivo de credenciales se creó junto a `data`, fuera de Git y con ACL
restringida al usuario actual. No imprimirlo ni incorporarlo al repositorio.

## Estado de seguridad

La existencia de este cluster **no autoriza ejecutar Jest aún**: las suites
actuales usan nombres de base fijos y falta implementar un preflight obligatorio
que valide identidad y directorio de datos, rechace otras instancias y asegure
nombres únicos tanto para bases como para plantillas y hooks de módulos.
Tampoco se ha verificado la interacción de `DATABASE_URL` con todas las rutas
que usan los runners. No utilizar la base de desarrollo ni el puerto 5432.

El preflight experimental `integration-tests/isolation-preflight.cjs` confirmó
por consulta de lectura `cluster_name`, directorio, usuario y puerto del cluster
anterior y rechaza `DB_PORT=5432` antes de conectarse. La exclusión de ejecuciones
sigue pendiente: una implementación experimental se descartó tras una revisión
que detectó una carrera al liberar un lock sustituido. **No está conectado a
Jest ni controla el entorno que usa Medusa**, por lo que no habilita las pruebas.
La auditoría `node apps/backend/integration-tests/audit-suites.cjs` detectó 20
suites pendientes; utiliza búsqueda textual, no demuestra la seguridad de los
runners ni autoriza ninguna operación de limpieza.

El paquete provisional descargado pasó su comprobación CRC y sus siete pruebas
puras. No se integró como launcher: su excepción de CI y el helper de nombres
son incompatibles entre sí, la auditoría textual no certifica los nombres reales,
y un prechequeo de colisiones no es atómico con las operaciones destructivas de
Medusa. Las bases y plantillas deben protegerse también ante interrupciones.

En Medusa 2.22.6, `configLoaderOverride` activa SSL para URLs que no contienen
`localhost`; una URL con `127.0.0.1` activa esa rama aunque sea local. Antes de
usar el runner hay que resolver esta incompatibilidad sin debilitar la validación
de destino ni modificar la instalación de Medusa.

## Arranque y parada del cluster creado

Desde PowerShell, con el usuario propietario del cluster:

```powershell
$pg = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$root = Join-Path $env:LOCALAPPDATA 'JovyCandy\integration-postgres-f002598ccccd4f44b0f0a066e00fe7ad'

# Arranque: primero comprobar que 55432 no está ocupado por otro proceso.
& $pg -D (Join-Path $root 'data') -l (Join-Path $root 'postgres.log') `
  -o '-p 55432 -c listen_addresses=127.0.0.1 -c cluster_name=jovy_disposable_f002598ccccd4f44b0f0a066e00fe7ad' -w start

# Parada: afecta únicamente el directorio de datos indicado.
& $pg -D (Join-Path $root 'data') -m fast -w stop
```

No borrar el directorio ni bases existentes sin verificar su procedencia y
obtener la autorización correspondiente. La ejecución y validación de pruebas
se documentarán cuando estén implementadas las protecciones.
