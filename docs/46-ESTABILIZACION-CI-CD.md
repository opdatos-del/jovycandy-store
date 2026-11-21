# Estabilización de CI/CD

**Corte:** 2026-11-21
**Base:** `56acad01ba93d36d203b6c6c3afb6f7cb874b132`
**Ejecución de referencia:** [CI run 44811214971](https://github.com/opdatos-del/jovycandy-store/actions/runs/44811214971)

## 1. Objetivo

Dejar el pipeline obligatorio en verde sin cambiar reglas de negocio ni refactorizar la arquitectura. El alcance es exclusivamente:

- generación de tipos de Medusa antes de `typecheck`;
- corrección de la prueba editorial no determinista;
- separación de jobs para que un fallo no oculte otros resultados;
- clasificación de los dos avisos moderados de dependencias;
- verificación desde un checkout limpio.

## 2. Estado inicial comprobado

| Job | Resultado | Causa |
|---|---|---|
| Tipos, lint y unitarias | FAIL | 126 errores TS18046; `typecheck` se ejecutaba antes de generar `.medusa/types` |
| Integración de módulos y HTTP | FAIL | 46/47 pruebas; orden no determinista en `product-editorial.integration.test.ts` |
| Secretos y dependencias | PASS | gitleaks sin hallazgos; `pnpm audit` informativo con 2 moderados |

El job de integración mezclaba módulos y HTTP: el fallo de módulos impedía obtener el resultado de la matriz HTTP.

## 3. Diagnóstico de tipos

### Causa

`apps/backend/tsconfig.json` incluye `.medusa/types/*`. Ese directorio está en `.gitignore` y solo lo genera `medusa build` (o `medusa start --types`). En un checkout limpio no existe, por lo que `resolve(JOVY_*_MODULE)` devuelve `unknown` y aparecen 125 errores TS18046 más un TS2345.

### Evidencia reproducible

En un worktree limpio en `HEAD`, sin `.medusa/types`:

```text
pnpm --filter @dtc/backend typecheck
→ 126 errores (125 × TS18046 + 1 × TS2345)
```

Tras `pnpm --filter @dtc/backend build` (con variables de build sin base de datos real):

```text
Types generated successfully
pnpm --filter @dtc/backend typecheck
→ 0 errores
```

No se usó `any`, no se relajó `strict`, no se excluyeron archivos y no se añadieron casts.

### Solución

El job `build` ejecuta el mecanismo oficial (`medusa build`), publica `apps/backend/.medusa/types` como artefacto y el job `static` lo descarga antes de `typecheck`.

También se detectó que el storefront no compila en limpio: `layout.tsx` usa `LayoutProps<"/">`, un tipo generado por Next. La solución oficial es `next typegen`; se incorporó al script:

```json
"typecheck": "next typegen && tsc --noEmit"
```

Verificado en el worktree limpio: storefront `typecheck` = 0.

## 4. Corrección de la prueba editorial

El test creaba tres fichas en un mismo lote y asumía un orden entre las dos con `sort_order = 1`. Sus `created_at` podían coincidir y el `id` es aleatorio, así que el orden esperado no estaba garantizado.

La regla de negocio no se tocó. El test ahora:

1. verifica `sort_order` ascendente;
2. calcula el orden esperado del empate con `created_at` y, si persiste, `id`;
3. comprueba que ordenar dos veces produce la misma secuencia.

La prueba unitaria con fixtures controlados (`product-editorial.test.ts`) sigue cubriendo los tres criterios: `sort_order` → `created_at` → `id`.

Resultado local: **47/47 pruebas de módulos**.

## 5. Estructura de CI

`.github/workflows/ci.yml` queda así:

| Job | Contenido | Dependencia |
|---|---|---|
| `build` | `medusa build` + artefacto `.medusa/types` | — |
| `static` | typecheck backend/storefront, lint, unitarias | `build` |
| `integration-modules` | PostgreSQL propio + `test:integration:modules` | — |
| `integration-http` | PostgreSQL propio + `test:integration:http` | — |
| `security` | gitleaks + `pnpm audit --prod --audit-level high` | — |

Decisiones:

- Cada integración tiene su propia base PostgreSQL; no comparten estado.
- Módulos y HTTP corren en paralelo: un fallo de módulos no oculta la matriz HTTP.
- `build` es el único lugar que genera tipos.
- La auditoría falla solo ante vulnerabilidades altas o críticas; los moderados se clasifican aquí.
- E2E del Admin queda **PENDIENTE** hasta disponer de base de staging, credenciales DEMO y navegador en el runner.

## 6. Vulnerabilidades clasificadas

`pnpm audit --prod` reporta **2 moderadas, 0 altas, 0 críticas**.

### VUL-01 · ajv ReDoS con `$data`

| Campo | Valor |
|---|---|
| Aviso | GHSA-2g4f-4pwh-qvx6 |
| Paquete | `ajv` |
| Rango afectado | `>=7.0.0-alpha.0 <8.18.0` |
| Versión corregida | `>=8.18.0` |
| Tipo | Transitiva |
| Rutas principales | `@medusajs/framework` → tooling de migraciones (`umzug`/`@rushstack/node-core-library`); `@hookform/resolvers` |
| Explotabilidad aquí | Baja. Requiere compilar esquemas con la opción `$data` y entrada controlada por atacante. El proyecto valida con Zod y no expone compilación de esquemas AJV. |
| Decisión | **Aceptada temporalmente.** No se fuerza un override mayor porque Medusa 2.22.6 fija sus árboles y un override global de AJV puede romper tooling de migraciones o el dashboard. Revisar al actualizar Medusa. |

### VUL-02 · uuid sin comprobación de límites en v3/v5/v6 con `buf`

| Campo | Valor |
|---|---|
| Aviso | GHSA-w5hq-g745-h8pq |
| Paquete | `uuid` |
| Rango afectado | `<11.1.1` |
| Versión corregida | `>=11.1.1` |
| Tipo | Transitiva |
| Rutas principales | `bullmq` (event bus / workflow engine Redis) y `exceljs` |
| Explotabilidad aquí | Baja. El fallo aplica a v3/v5/v6 con buffer; `bullmq` y `exceljs` usan generación v4 sin buffer en los flujos del proyecto. |
| Decisión | **Aceptada temporalmente.** Un override de `uuid` a la rama 11 cruza un cambio mayor bajo `bullmq`; no se aplica sin probar Redis. Revisar al actualizar Medusa o al habilitar Redis. |

El resultado de `pnpm audit` no se oculta: el umbral de fallo es `high`, y ambos avisos quedan documentados con su justificación.

## 7. Verificación

### Checkout limpio

Worktree en `HEAD`, sin `.medusa` ni `.next`:

| Paso | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `typecheck` antes de generar tipos | FAIL esperado: 126 errores |
| `medusa build` | PASS; genera `.medusa/types` |
| `typecheck` backend | PASS |
| `next typegen` + `typecheck` storefront | PASS |
| `test:integration:modules` | PASS 47/47 |

### Regresión local

| Check | Resultado |
|---|---|
| Typecheck backend | PASS |
| Typecheck storefront | PASS |
| Lint | PASS (0 errores; 2 warnings preexistentes) |
| Unitarias | 39 suites / 376 pruebas |
| Integración de módulos | 7 suites / 47 pruebas |
| Integración HTTP | 12 suites / 93 pruebas |
| Build | PASS |
| Gitleaks | PASS (sin hallazgos en la ejecución de referencia) |
| Vulnerabilidades | 2 moderadas clasificadas; 0 altas/críticas |

### GitHub Actions

Ejecución verificada: **[CI run 44906197461](https://github.com/opdatos-del/jovycandy-store/actions/runs/44906197461)** sobre `e15d6f0`.

| Job | Resultado |
|---|---|
| Tipos Medusa y build | PASS |
| Tipos, lint y unitarias | PASS |
| Integración de módulos | PASS |
| Integración HTTP | PASS |
| Secretos y dependencias | PASS |

**Todos los jobs obligatorios verdes.** Queda una anotación no bloqueante de GitHub sobre acciones que aún declaran Node 20; se resolverá al actualizar las versiones de las acciones, no afecta al resultado.

## 8. Archivos modificados

- `.github/workflows/ci.yml`
- `apps/storefront/package.json`
- `apps/backend/src/modules/jovy-product-editorial/__tests__/product-editorial.integration.test.ts`
- `docs/46-ESTABILIZACION-CI-CD.md`

## 9. Riesgos abiertos

- Los avisos moderados siguen presentes en dependencias transitivas.
- No hay job E2E en CI.
- La instalación limpia se validó en Windows con el mismo lockfile; Linux queda cubierto por la ejecución verde de GitHub Actions.
- `medusa build` en CI usa variables ficticias; no conecta a base de datos, pero cualquier cambio futuro que introduzca conexión en build rompería el job.
- GitHub muestra una anotación de deprecación de Node 20 en las acciones; no es un fallo del pipeline.

## 10. Siguiente entrega

1. Mantener el pipeline verde y actualizar las acciones a versiones con Node 24 cuando sea compatible.
2. Continuar con staging (`docs/47`) y el inventario de APIs públicas del storefront.
