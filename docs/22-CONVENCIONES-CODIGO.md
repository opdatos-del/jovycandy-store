# Convenciones de código

## Imports internos del backend

El backend Medusa define el alias de TypeScript:

```ts
@jovy/* -> apps/backend/src/*
```

Úsalo cuando un import interno suba **dos o más niveles** de directorio:

```ts
import { JOVY_CONTENT_MODULE } from "@jovy/modules/jovy-content"
import { createEditorialPageWorkflow } from "@jovy/workflows/jovy-content/create-editorial-page"
```

Los imports relativos se reservan para archivos vecinos o del mismo feature (`./` y `../`). No se permiten rutas internas que comiencen con `../../` o más niveles.

La regla se aplica en [`apps/backend/eslint.config.ts`](../apps/backend/eslint.config.ts) mediante `no-restricted-imports`. TypeScript, Jest y el build/runtime de Medusa resuelven el alias mediante `baseUrl`, `paths` y `moduleNameMapper`.

## Límites

- `@jovy/*` se limita al backend Medusa; el storefront conserva su alias `@/*` configurado por Next.js.
- No uses aliases para reemplazar imports de paquetes externos.
- No crees barrels globales solo para abreviar imports; expón módulos por sus archivos de responsabilidad.
