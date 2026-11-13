# Project agent guidance

This repository is connected to Gael AI DevKit v2.

- Canonical engineering rules: guía global de Gael AI DevKit v2 instalada fuera del repositorio
  (no se versiona aquí); consultarla antes de tareas no triviales.
- Project adapter: `.gael-devkit/project.yaml`.
- Routing: run `devkit route "<task>" --json` before non-trivial work.
- Trust level: `.gael-devkit/trust.yaml` (`trusted`: instalación local, tests y migraciones permitidos).

Add only repository-specific facts here: stack, commands, architecture, data ownership,
security constraints and forbidden actions. Do not copy the global rules.

## Project

Name: prototipo (JovyCandy 3.0, repositorio independiente de los proyectos históricos).

- Monorepo pnpm con dos aplicaciones:
  - `apps/backend`: Medusa v2 `2.22.6` + Admin (`@medusajs/*`), puerto `9000`.
  - `apps/storefront`: Next.js `16.x` + React `19.x` + Tailwind `4.x`, puerto `3000`.
- Base de datos: PostgreSQL local vía `DATABASE_URL` (`apps/backend/.env`). Sin Docker.
- Módulos CMS propios en `apps/backend/src/modules/jovy-*` (`jovy-content`, `jovy-marketing`,
  `jovy-events`, `jovy-brand`, `jovy-contacts`), cada uno con modelos, servicio, API y migraciones.
- Documentación de referencia: `docs/15-ARQUITECTURA-CMS.md`, `docs/16-MODELO-DATOS-CMS.md`,
  `docs/17-APIS-CMS.md`, `docs/22-CONVENCIONES-CODIGO.md`, `docs/21-ESTADO-REESCRITURA-ADMIN.md`.

## Commands

Verified against `package.json` and `docs/02-CONFIGURACION-LOCAL.md`:

```powershell
pnpm install                                  # Node >=22.23.4, pnpm >=11.17.0 <12
pnpm dev                                      # ambas apps en paralelo
pnpm dev:storefront                           # http://localhost:3000
pnpm dev:backend                              # http://localhost:9000 (requiere PostgreSQL + .env)
pnpm build
pnpm lint
pnpm typecheck
pnpm --filter storefront build
pnpm --filter @dtc/backend typecheck

# Backend: pruebas
pnpm --dir apps/backend test:unit
pnpm --dir apps/backend test:integration:modules
pnpm --dir apps/backend test:integration:http
pnpm --dir apps/backend test:e2e              # Playwright, requiere servicios levantados

# Migraciones Medusa (append-only, nunca editar migraciones ya aplicadas)
pnpm --dir apps/backend exec medusa db:migrate
```

`pnpm test` en la raíz solo ejecuta scripts `test` por paquete; el backend no los define,
así que no sustituye a los comandos `test:*` anteriores.

## Constraints

- No reutilizar secretos, datos, catálogos ni configuración de los proyectos históricos.
- Mantener secretos locales fuera de Git: solo `.env.example` se versiona.
- No usar Docker, despliegues ni servicios de producción; el entorno es local.
- No modificar `pnpm-workspace.yaml` (`allowBuilds`, `packageExtensions`) ni usar `--force`
  para saltar la política de scripts de pnpm 11.
- Migraciones nuevas por módulo en `apps/backend/src/modules/<modulo>/migrations/`;
  no reescribir migraciones aplicadas.
- `apps/backend/static/` es contenido de runtime del provider `file-local`
  (`upload_dir: "static"` en `medusa-config.ts`); va en `.gitignore`, no se versiona.
- El Admin vive en `apps/backend/src/admin`; respetar los tokens y componentes de `@medusajs/ui`.
- Documentación en español en `docs/`; identificadores, campos de API y claves de configuración en inglés.