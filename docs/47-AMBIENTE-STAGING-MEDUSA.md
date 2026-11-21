# Ambiente staging para Medusa y storefront

**Corte:** 2026-11-21
**Estado:** **DISEÑO PROPUESTO**. No se desplegó ningún ambiente ni se tocó producción.

## 1. Objetivo

Validar build de producción, HTTPS, sesiones, permisos, CMS, contactos y storefront sin usar datos ni credenciales productivas.

## 2. Arquitectura

```text
GitHub
  → CI (tipos, lint, unitarias, integración, build)
  → imagen backend + imagen storefront por SHA
  → GHCR
  → staging
      ├── PostgreSQL dedicado
      ├── Medusa 9000
      ├── Next 3000
      ├── proxy inverso TLS
      └── almacenamiento persistente de medios
```

- Imágenes inmutables etiquetadas con el SHA del commit.
- Nunca compilar en el servidor de staging.
- Rollback por etiqueta previa.
- Secretos por ambiente; no reutilizar `.env` local.

## 3. Requisitos

| Componente | Requisito |
|---|---|
| PostgreSQL | Instancia/DB aislada, backup automático, restauración ensayada |
| Medusa | `NODE_ENV=production`, `ADMIN_ALLOW_HTTP` ausente/false |
| Storefront | `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, publishable key de staging |
| TLS | Certificado válido y redirección 80 → 443 |
| Proxy | Cabeceras `X-Forwarded-*` confiables; backend no expuesto directo |
| Medios | S3-compatible o volumen persistente; no junction local |
| Observabilidad | logs, métricas 401/403, errores de autorización, exportaciones |
| Datos | sintéticos; no copiar los 1.175 contactos locales sin anonimizar |

## 4. Variables

```text
NODE_ENV=production
DATABASE_URL=postgres://...
JWT_SECRET=<único>
COOKIE_SECRET=<único>
STORE_CORS=https://staging...
ADMIN_CORS=https://admin-staging...
AUTH_CORS=https://staging...,https://admin-staging...
NEXT_PUBLIC_SITE_URL=https://staging...
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api-staging...
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY=pk_staging...
FILE_BACKEND_URL=https://cdn-staging...
```

Prohibido: `ADMIN_ALLOW_HTTP=true`, CORS con `*`, secretos locales.

## 5. Secuencia

1. Build y pruebas en CI.
2. Publicar imágenes por SHA en GHCR.
3. Crear PostgreSQL y almacenamiento.
4. Ejecutar `medusa db:migrate` (solo migraciones aditivas).
5. Desplegar backend y storefront.
6. Ejecutar bootstrap **solo** si staging está vacío:
   `medusa exec ./src/scripts/bootstrap-authz.ts -- --user-id=...`
7. Cargar contenido CMS sintético.
8. Validar HTTPS, cookies, login/logout, permisos, contacto y catálogo.
9. Ejecutar backup y restauración en base aislada.
10. Ensayar rollback a la imagen anterior.

## 6. Validaciones de cierre

- [ ] HTTPS y redirección.
- [ ] Cookies `Secure`/`HttpOnly`/`SameSite`.
- [ ] CORS exacto.
- [ ] Login, logout, expiración y revocación.
- [ ] `jovy-authz` con usuarios DEMO.
- [ ] Catálogo y CMS público.
- [ ] Formulario de contacto → bandeja correcta.
- [ ] Backup/restauración real.
- [ ] Rollback reproducible.
- [ ] Sin acceso al Admin desde el storefront.

## 7. Bloqueos

- No hay servidor staging autorizado en esta ejecución.
- No hay credenciales ni certificado de staging.
- No se ejecutó backup/restauración.
- La invalidación distribuida de permisos sigue pendiente.

Por tanto, HTTPS/sesiones/staging permanecen **PENDIENTES** y el dictamen productivo sigue **NO-GO**.
