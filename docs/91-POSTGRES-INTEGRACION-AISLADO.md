# PostgreSQL efímero para integración local

**Estado: VALIDADO — suites HTTP y de módulos ejecutadas el 2026-11-26.**

Las pruebas de integración locales no usan PostgreSQL de desarrollo (`5432`) ni
el clúster de laboratorio anterior (`55432`). Cada ejecución local crea un
clúster PostgreSQL 18.6 nuevo, exclusivo y descartable.

## Uso

Desde `apps/backend`:

```powershell
# Cualquier suite HTTP explícita, serial, en un clúster nuevo
pnpm test:integration:http:ephemeral -- integration-tests/http/legacy-import.spec.ts

# Una suite de módulos explícita, serial, en un clúster nuevo
pnpm test:integration:modules:ephemeral -- src/modules/jovy-catalogue/__tests__/catalogue.integration.test.ts

# Atajo conservado para la primera suite aprobada
pnpm test:integration:http:contacts
```

El launcher recibe una sola suite de integración explícita (HTTP o módulos) y la
ejecuta en modo serial. No cambia los nombres fijos de bases del runner ni
ejecuta implícitamente todas las pruebas HTTP o de módulos.

`test:integration:http` y `test:integration:modules` siguen siendo los comandos
de GitHub Actions: el workflow declara explícitamente
`JOVY_CI_POSTGRES_SERVICE=1` y la base esperada por suite junto al servicio
PostgreSQL. Jest exige siempre un `TEST_TYPE` reconocido: `unit`,
`integration:http` o `integration:modules`. Una configuración implícita, un
`TEST_TYPE` desconocido, `CI=true` aislado o una integración local sin launcher
se rechazan antes de descubrir suites.

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
7. Para CI, el `globalSetup` consulta el servicio PostgreSQL real antes de
   cargar suites: exige loopback, usuario `postgres`, base esperada por
   `TEST_TYPE`, puerto `5432` y PostgreSQL 16. El marcador de CI y variables
   coherentes por sí solos no autorizan una ejecución.

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
- Antes de detener PostgreSQL consulta **todas** las bases no predeterminadas
  del clúster. Cualquier base distinta de `postgres`, `template0` o `template1`
  hace fallar la ejecución y conserva su directorio para inspección.
- Si el launcher o Jest fallan, detiene el servidor conocido cuando puede
  comprobarlo y conserva el directorio para inspección. Nunca borra un
  directorio previo o desconocido.
- Informes y logs sanitizados se conservan fuera del repositorio en
  `%LOCALAPPDATA%\JovyCandy\integration-runs\reports\<UUID>.json`; el informe
  registra la suite ejecutada y las bases residuales encontradas.

## Validación ejecutada

| Comprobación | Resultado |
| --- | --- |
| Unitarias de launcher/preflight/CI | 12/12 correctas (`pnpm test:integration:launcher`) |
| Negativas de Jest | `TEST_TYPE` ausente y `integration:http` sin launcher rechazados antes de descubrir suites |
| Clúster exclusivo y verificación Medusa | Correcta mediante cliente `@medusajs/framework/pg` |
| Suite HTTP serial | `contacts-rate-limit.spec.ts`: 1 suite, 1 prueba correcta, 27.197 s |
| Importación histórica HTTP serial | `legacy-import.spec.ts`: 1 suite, 2 pruebas correctas |
| Manifiesto histórico completo | `legacy-import-full-manifest.spec.ts`: 1 suite, 1 prueba correcta, 35 productos y 61 variantes |
| Módulo de catálogo | `catalogue.integration.test.ts`: 1 suite, 6 pruebas correctas |
| Limpieza del runner | Base, plantilla y cualquier otra base no predeterminada ausentes |
| Limpieza PostgreSQL | `pg_ctl stop` correcto; directorio de ejecución exitoso eliminado |

Evidencia de ejecución exitosa:

```text
contacts run id: b211c631-254a-49d8-9efa-a097a824fd91
contacts port:   57671
legacy import run id: 15c3aab9-46a6-4fed-b96d-ec15b0cc4196
legacy import port:   55198
legacy full run id:   3ca985a4-884d-4999-9d28-09d26a667de0
legacy full port:     55541
modules run id:      0d3143f8-db18-4d1a-bc3a-51020be36db2
modules port:        56085
commerce run id:     f98754e2-f8a6-4468-a7c7-cee2328d793e
commerce port:       52793
editorial run id:    805ab97a-beb3-43e6-805a-1d6069c87f0c
editorial port:      49359
reports:             %LOCALAPPDATA%\JovyCandy\integration-runs\reports\
                     <run-id>.json
```

Los directorios exitosos ya no existen; sus informes indican salida `0`, sin
bases residuales y `stopped-and-removed`. Las ejecuciones fallidas de
desarrollo del launcher quedaron detenidas y conservadas bajo `integration-runs`
para no eliminar evidencia automáticamente; no corresponden a los puertos
`5432` ni `55432`.

## Antecedente histórico

El clúster de laboratorio en `55432` se usó solo para investigación anterior.
No forma parte del launcher, no recibe operaciones de Jest y no debe usarse
para nuevas ejecuciones de integración local.
