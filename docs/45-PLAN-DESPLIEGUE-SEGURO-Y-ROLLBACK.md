# Plan de despliegue seguro y rollback

**Corte:** 2026-11-20
**Estado:** plan **PROPUESTO**. No se ejecutó ningún despliegue ni migración productiva.

## 1. Principios

- Sin datos productivos en local; sin secretos en el repositorio.
- Migraciones append-only; nunca reescribir una migración aplicada.
- Primero staging, después producción.
- Toda intervención de privilegios es un comando explícito y auditado.
- Si el subsistema de autorización falla, se deniega; no se abre.

## 2. Inventario de despliegue

| Componente | Requisito |
|---|---|
| Backend | Medusa v2 `2.22.6`, Node 22.23.4+, build `medusa build` |
| Storefront | Next.js 16, build independiente |
| Base de datos | PostgreSQL con backups automáticos y PITR si es posible |
| Sesiones | Cookies `Secure`, `HttpOnly`, `SameSite=Lax` o `Strict` |
| TLS | Terminación en proxy; backend no expuesto directo |
| Medios | Proveedor persistente compatible con Medusa (no junction local) |
| Caché | Una instancia o invalidación distribuida acordada |
| Observabilidad | Logs estructurados, métricas y alertas de 403/401 |

## 3. Variables de entorno

Obligatorias:

```text
NODE_ENV=production
DATABASE_URL=postgres://...
JWT_SECRET=<secreto único>
COOKIE_SECRET=<secreto único>
STORE_CORS=https://<tienda>
ADMIN_CORS=https://<admin>
AUTH_CORS=https://<tienda>,https://<admin>
FILE_BACKEND_URL=https://<cdn-o-dominio>/static
```

Prohibido en producción:

```text
ADMIN_ALLOW_HTTP=true
CORS con *
Secretos de ejemplo o compartidos con desarrollo
```

Recomendado: gestor de secretos del proveedor, rotación documentada y auditoría de acceso.

## 4. Secuencia de despliegue

### 4.1 Preparación

1. Congelar cambios y etiquetar el commit autorizado.
2. Verificar CI verde (typecheck, lint, unitarias, integración, build, secretos).
3. Crear backup de PostgreSQL y probar la restauración en un entorno aislado.
4. Confirmar que `apps/backend/static/` no se versiona y que los medios viven en almacenamiento persistente.
5. Revisar que no existan `rbac_*` ni migraciones nuevas inesperadas.

### 4.2 Base de datos

```powershell
pnpm --dir apps/backend exec medusa db:migrate
```

- La migración de `jovy-authz` es aditiva.
- Verificar tablas: `jovy_authz_role`, `jovy_authz_policy`, `jovy_authz_assignment`,
  `jovy_authz_user_policy`, `jovy_authz_audit_log`.
- No ejecutar `db:reset`, `TRUNCATE` ni scripts destructivos.

### 4.3 Arranque

1. Desplegar backend y storefront con el build de producción.
2. Confirmar health/readiness.
3. Confirmar que las cookies viajan con `Secure` y que el login funciona.
4. Ejecutar el bootstrap **solo si es una instalación nueva**:

```powershell
pnpm --dir apps/backend exec medusa exec ./src/scripts/bootstrap-authz.ts -- --user-id=usr_...
```

5. Verificar `/admin/jovy/authz/me` con el Superadministrador.
6. Asignar roles al resto de operadores desde `Settings → Accesos y permisos`.
7. Comprobar con una cuenta restringida que recibe 403 en rutas Jovy y nativas no autorizadas.
8. Confirmar que no existe `JOVY_AUTHZ_BOOTSTRAP_EMAILS` en el entorno.

### 4.4 Verificación posterior

- Smoke: login, dashboard, contactos, productos, roles, navegación y auditoría.
- Revisar `jovy_authz_audit_log` tras los cambios de roles.
- Revisar logs de 401/403 y errores de resolución.
- Probar revocación: retirar un rol y confirmar 403 en la siguiente petición.
- Probar API key secreta: 401.

## 5. Rollback

### 5.1 Código

1. Detener tráfico o poner el backend en mantenimiento.
2. Redesplegar la versión anterior del backend y storefront.
3. Conservar la base de datos y la tabla de auditoría.

### 5.2 Base de datos

- Si la migración nueva debe revertirse:
  1. backup previo verificado;
  2. ejecutar el `down` de la migración del módulo **solo** si no hay datos que dependan de ella;
  3. si hay datos, restaurar el backup en una base nueva y conmutar.
- Nunca borrar filas de auditoría para “limpiar” un rollback.

### 5.3 Autorización

- Si el rollback deja el sistema sin Superadministrador:
  ```powershell
  pnpm --dir apps/backend exec medusa exec ./src/scripts/bootstrap-authz.ts -- --user-id=usr_... --mode=recovery --confirm=recover-superadmin
  ```
- La recuperación requiere acceso operativo al servidor y queda auditada.
- No se guardan claves de recuperación en el repositorio.

## 6. Recuperación ante desastre

| Escenario | Acción |
|---|---|
| PostgreSQL corrupto | Restaurar último backup verificado; validar migraciones |
| Pérdida de acceso del último superadmin | Comando `--mode=recovery` con confirmación |
| Caché inconsistente | Reiniciar instancia; invalidación local al cambiar roles |
| Fuga de API key | Revocar en `Settings → API Keys`; revisar auditoría |
| Sesión comprometida | Forzar logout/rotación de `JWT_SECRET` (invalida sesiones) |
| Error de autorización | Rollback de código; no abrir permisos como mitigación |

## 7. Observabilidad mínima

- 401 y 403 por ruta y actor (sin PII).
- Cambios de rol, políticas y asignaciones.
- Ejecuciones de bootstrap/recovery.
- Exportaciones (tipo de bandeja, filas, actor; sin contenido).
- Errores de resolución de permisos y de caché.
- Fallos de login y sesiones expiradas.

Alertas sugeridas: pico de 403, fallo repetido de autorización, escritura de auditoría fallida,
exportaciones fuera de horario, intento de bootstrap con superadmin existente.

## 8. Medios

- El `upload_dir: "static"` y el junction local no son estrategia productiva.
- Migrar a un proveedor persistente (S3-compatible o equivalente) con respaldo y URLs firmadas
  si aplica.
- No migrar medios reales sin autorización y backup.

## 9. Limitaciones conocidas del plan

- No hay staging validado; este documento no sustituye esa ejecución.
- La invalidación distribuida no está implementada.
- El sidebar nativo no se filtra sin RBAC Enterprise.
- El filtrado por campo no existe.
- El workflow de CI está creado pero no ejecutado en GitHub.
- El dictamen vigente es **NO-GO** (`docs/44`).
