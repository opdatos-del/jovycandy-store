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
| Conexión PostgreSQL autenticada | `psql -w -h 127.0.0.1 -p 5432 -U postgres -d postgres ...` respondió `fe_sendauth: no password supplied` | Credencial local autorizada para crear/consultar la base aislada |
| Creación de `jovycandy_prototipo_medusa` | No ejecutada para no adivinar ni extraer credenciales | Sesión PostgreSQL local autorizada |
| Migraciones oficiales | No ejecutadas sin base nueva confirmada | Base y `DATABASE_URL` válidos |
| `GET /health` | No iniciado sin migración | Migraciones y backend configurado |
| Medusa Admin en `/app` | No iniciado sin migración | Migraciones, admin local y backend configurado |
| Login/reinicio/persistencia Admin | No ejecutados | Elementos anteriores |

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

1. Obtener una contraseña local autorizada de PostgreSQL o un rol local autorizado, sin revelar credenciales en Git o documentación.
2. Verificar la inexistencia de la base nueva y crear exclusivamente `jovycandy_prototipo_medusa`.
3. Actualizar el `.env` local de Medusa desde la plantilla con secretos nuevos.
4. Ejecutar migraciones y crear un administrador local usando el CLI oficial.
5. Arrancar Medusa, comprobar `/health`, `/app`, login, reinicio y persistencia.
6. Actualizar este documento con los comandos y resultados reales, y detener la fase de cimientos.
