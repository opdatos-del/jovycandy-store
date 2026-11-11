# Validación del entorno — primera entrega

**Fecha de ejecución:** 2026-11-11

## COMPLETADO Y VALIDADO

| Comprobación | Comando o evidencia | Resultado |
| --- | --- | --- |
| Workspace pnpm | `pnpm install --frozen-lockfile` | Correcto; 3 proyectos de workspace y lockfile vigente |
| Storefront lint | `pnpm --dir apps/storefront lint` | Correcto |
| Storefront typecheck | `pnpm --dir apps/storefront typecheck` | Correcto |
| Storefront build | `pnpm --filter storefront build` | Correcto; ruta estática `/` generada |
| Storefront HTTP | Arranque temporal y consulta a `http://127.0.0.1:3000/` | HTTP 200 y contenido `Storefront técnico preparado` |
| Backend typecheck | `pnpm --dir apps/backend typecheck` | Correcto |
| Medusa backend/Admin build | `pnpm --filter @dtc/backend build` | Backend y frontend Admin compilados correctamente |
| Build raíz | `pnpm build` | Correcto: Medusa/Admin y Next.js compilaron desde la raíz |
| Lint raíz | `pnpm lint` | Correcto en storefront y Medusa |
| Typecheck raíz | `pnpm typecheck` | Correcto en ambas aplicaciones |
| Test raíz | `pnpm test` | Correcto; no se ejecutan suites porque aún no hay script `test` en las aplicaciones base |
| Aislamiento | Inspección de Git y rutas | `prototipo` tiene Git propio; no se modificaron originales |

El build de Medusa informa que, sin `REDIS_URL`, usa una instancia fake. Esto es esperado y compatible con la restricción de no introducir Redis en la primera etapa.

Durante la validación, `medusa lint` reveló que el wrapper DTC del generador contenía `@medusajs/eslint-plugin`, `eslint`, `jiti` y la configuración de hoisting pnpm que el backend extraído necesita. Se repusieron esas dependencias con las versiones del starter oficial y el `.npmrc` oficial de Medusa; `pnpm --filter @dtc/backend lint` y el lint raíz quedaron correctos.

## BLOQUEADO

| Comprobación requerida | Evidencia | Dependencia para desbloquear |
| --- | --- | --- |
| Publicación Store API con Publishable API Key | No configurada en esta fase | Configurar una clave de Store API antes de validar contenido público con HTTP 200 |


## COMPLETADO Y VALIDADO DESPUÉS DE LA INSTALACIÓN

| Comprobación | Evidencia | Resultado |
| --- | --- | --- |
| Conexión PostgreSQL desde el contexto de Medusa | Carga de `apps/backend/.env` mediante `loadEnv`, seguida de una consulta de lectura con el driver `pg` resuelto desde las dependencias de Medusa | Conexión autenticada correcta a `jovycandy_prototipo_medusa` con el rol local `postgres` |
| Migraciones oficiales de Medusa | `pnpm --dir apps/backend exec medusa db:migrate` | Correcto; módulos base y la migración `jovy_content/Migration20261111174909.ts` aplicados |
| Medusa runtime | Instancia temporal del servidor compilado | `/health` devolvió HTTP 200 y el proceso se detuvo controladamente |
| Medusa Admin y autenticación | Instancia temporal + cuenta local ignorada | `/app` 200, login `user/emailpass` 200 y API CMS autenticada 200 |

Las comprobaciones de conexión y login no imprimieron `DATABASE_URL`, contraseñas ni secretos. Las migraciones y la prueba técnica CMS sí escribieron exclusivamente en la base aislada; el registro técnico de contenido se eliminó mediante soft delete al terminar.

## IMPLEMENTADO SIN VALIDAR EN RUNTIME

- Plantillas `.env.example` para ambas aplicaciones.
- Scripts raíz de desarrollo, lint, typecheck, build y test.
- Estructura feature-first vacía del storefront.

## Advertencias conocidas

- `create-next-app` dejó `apps/storefront/pnpm-lock.yaml`. El lockfile raíz ya contiene el importer del storefront; el archivo redundante requiere eliminación, bloqueada por la política de operaciones destructivas hasta recibir autorización explícita.
- `NUL` es un archivo vacío creado accidentalmente por una redirección de shell durante la inspección. Requiere eliminación autorizada; no afecta el runtime.
- `pnpm peers check` finaliza con código 1 por peers transitivos del starter oficial Medusa 2.22.6: OpenTelemetry con `@opentelemetry/api@1.10.0`, `fdir@6.1.1` con `picomatch@3.x`, y `cva@1.0.0-beta.12` con TypeScript `>=6.0.0`. Las incompatibilidades de Medusa UI y ESLint se resolvieron durante la actualización.
- `pnpm audit --prod` informa 3 vulnerabilidades transitivas del árbol Medusa: 2 moderadas (`ajv`, `uuid`) y 1 baja (`deepmerge`), sin altas ni críticas. No se aplicaron overrides no validados.

La instalación, typecheck y build sí fueron correctos. Los riesgos restantes deben revisarse con una actualización oficial compatible de Medusa, no mediante `--force`, overrides especulativos ni ignorando peer dependencies.

## Próximo paso reproducible

1. Configurar una Publishable API Key local durante la fase Store para verificar una respuesta Store API publicada con HTTP 200.
2. Añadir pruebas HTTP automatizadas del CRUD, auditoría y filtro de publicación CMS.
3. Añadir E2E de navegador para la ruta **Contenido Jovy** cuando se incorporen los siguientes módulos editoriales.
