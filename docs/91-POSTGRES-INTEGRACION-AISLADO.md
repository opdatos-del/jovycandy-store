# PostgreSQL efímero para integración local

**Estado: VALIDADO — primera suite HTTP ejecutada el 2026-11-26.**

Las pruebas de integración locales no usan PostgreSQL de desarrollo (`5432`) ni
el clúster de laboratorio anterior (`55432`). Cada ejecución local crea un
clúster PostgreSQL 18.6 nuevo, exclusivo y descartable.

## Uso

Desde `apps/backend`:

```powershell
pnpm test:integration:http:contacts
```

Por ahora ejecuta únicamente
`integration-tests/http/contacts-rate-limit.spec.ts`, en modo serial. No cambia
los nombres fijos de las demás suites ni ejecuta todas las pruebas HTTP.

`test:integration:http` y `test:integration:modules` siguen siendo los comandos
de GitHub Actions: el workflow declara explícitamente
`JOVY_CI_POSTGRES_SERVICE=1` junto al servicio PostgreSQL efímero. Una ejecución
local sin launcher se rechaza antes de que Jest cargue las suites; `CI=true` por
sí solo no autoriza ninguna conexión.

## Flujo del launcher

`integration-tests/run-ephemeral-postgres.cjs` es exclusivo de Windows y:

1. Genera UUID y crea exactamente
   `%LOCALAPPDATA%\JovyCandy\integration-runs\<UUID>`. Si ya existe, falla; no
   reutiliza directorios.
2. Ejecuta `initdb` de PostgreSQL 18.6 con rol y contraseña criptográfica
   exclusivos. El archivo temporal requerido por `initdb` se elimina de
   inmediato; la contraseña no se guarda ni se imprime.
3. Fuerza `scram-sha-256`, `listen_addresses = '127.0.0.1'`, un `cluster_name`
   asociado al UUID y un puerto IPv4 libre distinto de `5432` y `55432`.
4. Inicia y detiene PostgreSQL con `pg_ctl`; conserva PID, marcador de propiedad
   y directorio de datos mientras dura la ejecución.
5. Antes de Jest, resuelve `localhost`, acepta solamente `127.0.0.1`/`::1`,
   conecta con `@medusajs/framework/pg` usando `localhost` y comprueba por
   consultas de lectura usuario, dirección IPv4 efectiva, puerto,
   `data_directory`, `cluster_name` y `listen_addresses`.
6. Construye el entorno del hijo con `DATABASE_URL`, `DB_HOST`, `DB_PORT`,
   `DB_USERNAME`, `DB_PASSWORD` y `DB_WAITINGROOM_DATABASE` coherentes. Elimina
   variables heredadas `PG*` y `DB_*`; `jest.config.js` vuelve a restaurar esos
   valores después de cargar `.env`, para impedir sustituciones silenciosas.

El uso de `localhost` es intencional: en Medusa 2.22.6,
`configLoaderOverride` activa SSL cuando la URL del cliente no contiene esa
cadena. No se desactiva TLS de forma global ni se usa
`rejectUnauthorized: false`.

## Controles y limpieza

- `jest.config.js` y `integration-tests/setup.js` exigen el marcador del
  launcher antes de importar `@medusajs/test-utils`.
- El marcador enlaza UUID, raíz, `data`, usuario, puerto, nombre de clúster y
  PID. Un directorio, puerto, URL o identidad distintos detienen el proceso
  antes de Jest.
- La limpieza exige volver a comprobar propiedad y PID. Tras un Jest exitoso,
  detiene solo ese `pg_ctl`, verifica que dejó de ejecutarse y elimina únicamente
  la raíz del UUID actual.
- Si el launcher o Jest fallan, detiene el servidor conocido cuando puede
  comprobarlo y conserva el directorio para inspección. Nunca borra un
  directorio previo o desconocido.
- Informes y logs sanitizados se conservan fuera del repositorio en
  `%LOCALAPPDATA%\JovyCandy\integration-runs\reports\<UUID>.json`.

## Validación ejecutada

| Comprobación | Resultado |
| --- | --- |
| Unitarias de launcher/preflight | 7/7 correctas (`pnpm test:integration:launcher`) |
| Negativa local sin launcher | Rechazada antes de cargar Jest; sin conexión a `5432`/`55432` |
| Clúster exclusivo y verificación Medusa | Correcta mediante cliente `@medusajs/framework/pg` |
| Suite HTTP serial | `contacts-rate-limit.spec.ts`: 1 suite, 1 prueba correcta, 59.865 s |
| Limpieza del runner | Base y plantilla eliminadas por Medusa |
| Limpieza PostgreSQL | `pg_ctl stop` correcto; directorio de ejecución exitoso eliminado |

Evidencia de ejecución exitosa:

```text
run id:       706f4239-fd26-4410-b52d-02ff876b83d9
port:         55240
user/cluster: jovy_it_706f4239fd264410b52d
postgres PID: 15844
database:     medusa-jovy-http-contacts-rate-limit
template:     medusa-jovy-http-contacts-rate-limit-template
report:       %LOCALAPPDATA%\JovyCandy\integration-runs\reports\
              706f4239-fd26-4410-b52d-02ff876b83d9.json
```

El directorio de ese UUID ya no existe. Las ejecuciones fallidas de desarrollo
del launcher quedaron detenidas y conservadas bajo `integration-runs` para no
eliminar evidencia automáticamente; no corresponden a los puertos `5432` ni
`55432`.

## Antecedente histórico

El clúster de laboratorio en `55432` se usó solo para investigación anterior.
No forma parte del launcher, no recibe operaciones de Jest y no debe usarse
para nuevas ejecuciones de integración local.
