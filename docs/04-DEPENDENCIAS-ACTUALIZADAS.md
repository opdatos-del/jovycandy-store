# Dependencias actualizadas y compatibilidad

**Fecha de verificación:** 2026-11-11

Las versiones se contrastaron contra el registro npm y la documentación oficial de Next.js, Medusa y pnpm. Se actualizaron a la versión publicada más reciente cuando era compatible; las restricciones explícitas se mantienen para no crear un árbol inválido.

## Versiones directas verificadas

| Área | Paquete | Versión final | Estado |
| --- | --- | --- | --- |
| Storefront | Next.js | `16.4.6` | Última publicada |
| Storefront | React / React DOM | `19.3.1` | Última publicada |
| Storefront | Tailwind / Turbopack plugin | `4.3.5` | Última publicada |
| Storefront | `@types/node` | `24.19.2` | Última línea correspondiente al runtime Node 24 |
| Backend | Medusa, CLI, Admin SDK y framework | `2.22.6` | Última publicada; todas las dependencias Medusa comparten versión |
| Backend | Medusa UI | `4.2.13` | Actualizada; satisface el peer de `@medusajs/draft-order` |
| Backend | TanStack Query | `5.107.1` | Última publicada dentro de v5 |
| Backend | React Router | `7.18.5` | Última publicada dentro de v7 |
| Backend | Zod | `4.6.7` | Última publicada dentro de v4 |
| Backend | Vite | `8.3.7` | Última publicada |
| Backend | Jest / tipos Jest | `30.5.2` / `30.0.0` | Últimas publicadas |

## Versiones deliberadamente compatibles

| Paquete | Versión usada | Motivo comprobado |
| --- | --- | --- |
| TypeScript | `5.9.3` | `typescript-eslint@8.72.2`, utilizado por Next y Medusa, admite `>=4.8.4 <6.1.0`; TypeScript `7.0.2` hace fallar ESLint. |
| ESLint | `9.39.5` | Última versión de la línea soportada por los plugins compartidos del Admin de Medusa. ESLint 10 introduce peers incompatibles aunque Next 16 pueda usarlo. |
| React / React DOM del backend | `18.3.1` | Requisito peer de Medusa Admin y `@medusajs/draft-order@2.22.6`; el storefront sí usa React 19.3.1. |
| Tipos React del backend | React 18 | Deben corresponder al React 18 requerido por Medusa Admin. |
| `react-i18next` backend | `13.5.0` | Versión fijada por `@medusajs/dashboard@2.22.6`; no se salta a la mayor 18 sin soporte oficial. |
| pnpm | `11.17.0` local | pnpm `12.18.0` es la última publicada, pero actualizar el binario global modificaría el entorno fuera de `prototipo` y requiere autorización explícita. |

## Resolución pnpm documentada

Medusa requiere hoisting específico en `.npmrc` cuando se usa pnpm. Además, el upgrade mostró dos imports no declarados por paquetes Medusa:

- `@medusajs/eslint-plugin@2.22.6` importa `@typescript-eslint/typescript-estree`.
- `@medusajs/framework@2.22.6` importa `typescript` durante el build.

`pnpm-workspace.yaml` corrige ambos con `packageExtensions` limitadas a esas versiones, en lugar de usar overrides globales o depender de enlaces accidentales del workspace. Lint, typecheck y build posteriores validaron la resolución.

## Validación posterior a la actualización

- `pnpm install --frozen-lockfile` — correcto.
- `pnpm lint` — correcto.
- `pnpm typecheck` — correcto.
- `pnpm build` — correcto para Next.js y Medusa/Admin.
- Storefront temporal — HTTP 200 después del upgrade.

## Riesgos abiertos de dependencias

`pnpm peers check` conserva tres peers transitivos del árbol Medusa: OpenTelemetry, `picomatch` y TypeScript requerido por `cva`. Son incompatibilidades de paquetes transitivos del starter oficial; no se fuerzan versiones sin una actualización compatible de Medusa.

`pnpm audit --prod --audit-level high` identifica 3 vulnerabilidades transitivas: 2 moderadas (`ajv` y `uuid`) y 1 baja (`deepmerge`), sin altas ni críticas. Las tres provienen de dependencias internas de Medusa. No se añadieron overrides de seguridad especulativos; deben reevaluarse al publicar Medusa una actualización que eleve esas dependencias.
