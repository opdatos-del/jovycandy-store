# Validación preproductiva y dictamen

**Corte inicial:** 2026-11-20
**Actualización de evidencia:** 2026-11-24
**Alcance:** validar lo reproducible en local y separar lo que exige staging.
**Regla:** no se declara probado lo que no se ejecutó.

## 1. Qué se validó realmente

La estabilización publicada en `1ba0b8188d1f04df0b6aaa5d2f29221eb6eac0e3`
pasó los cinco jobs de CI en [GitHub Actions run 45437735774](https://github.com/opdatos-del/jovycandy-store/actions/runs/45437735774).
La configuración posterior de perfiles runtime permanece sin commit, sin
despliegue y no cambia el dictamen de este documento.

| Control | Evidencia | Estado |
|---|---|---|
| Typecheck backend/storefront | `pnpm typecheck` | VERIFICADO |
| Lint | 0 errores; 2 warnings preexistentes | VERIFICADO |
| Unitarias | 39 suites / 376 pruebas | VERIFICADO |
| Integración de módulos | 7 suites / 47 pruebas | VERIFICADO |
| Integración HTTP | 12 suites / 93 pruebas | VERIFICADO |
| E2E Admin | 31/31 en `127.0.0.1:9001` | VERIFICADO |
| Build producción | `medusa build` | VERIFICADO |
| revocación en el mismo proceso | HTTP: 200 → 403 tras retirar roles | VERIFICADO |
| `deny` sobre `*:*` | HTTP + módulo + unitarias | VERIFICADO |
| Shell sin sesión | `GET /admin/stores` 401; `feature-flags` 200 | VERIFICADO |
| API key secreta | 401 en Jovy y nativa | VERIFICADO |
| Usuario eliminado | Comprobación por petición (sin caché) | VERIFICADO por diseño + revisión |
| Bootstrap/recovery | Módulo + comando + auditoría | VERIFICADO en local |
| Errores de autorización | Denegación por defecto | VERIFICADO por código y pruebas de ruta |
| Migraciones | `jovy_authz_*` aplicadas; sin `rbac_*` | VERIFICADO |
| CI | Workflow ejecutado en GitHub: run `44906197461` | VERIFICADO |

## 2. Qué no se pudo validar

| Control | Motivo | Estado |
|---|---|---|
| HTTPS real y redirección | Sin staging ni certificado | BLOQUEADO |
| Proxy inverso y cabeceras reenviadas | Sin infraestructura | BLOQUEADO |
| Cookies `Secure`/`HttpOnly`/`SameSite` en navegador real | Sin HTTPS | BLOQUEADO |
| CORS real entre dominios | Sin staging | BLOQUEADO |
| CSRF sobre el mecanismo de sesión | Sin navegador/HTTPS | BLOQUEADO |
| Expiración de sesión y logout real | Sin staging | PENDIENTE |
| Revocación multiinstancia / Redis | Sin segunda instancia | BLOQUEADO |
| Backup y restauración verificables | Sin procedimiento probado | PENDIENTE |
| PostgreSQL no disponible durante una escritura | No se ejecutó una prueba destructiva | PENDIENTE |
| Sidebar nativo filtrado | RBAC Enterprise sin licencia | BLOQUEADO |
| Filtrado de campos por rol | No implementado | PENDIENTE |
| Cuentas de servicio | No diseñadas | PENDIENTE |

## 3. Configuración de sesión y `ADMIN_ALLOW_HTTP`

Situación actual:

```ts
const isProductionRuntime = process.env.NODE_ENV === 'production'
const allowHttpCookies = process.env.ADMIN_ALLOW_HTTP === 'true'
const secureSessionCookie = isProductionRuntime && !allowHttpCookies
```

Riesgo: `ADMIN_ALLOW_HTTP=true` en un proceso con `NODE_ENV=production` desactiva la cookie `Secure`. Es aceptable solo en `localhost` y nunca detrás de un despliegue real.

Requisitos antes de producción:

1. `NODE_ENV=production`.
2. `ADMIN_ALLOW_HTTP` ausente o `false`.
3. TLS terminado en el proxy y backend no expuesto directamente.
4. `ADMIN_CORS` y `AUTH_CORS` con orígenes exactos, sin `*`.
5. Cookies `Secure`, `HttpOnly` y `SameSite` verificado en navegador.
6. Validación de arranque que rechace `ADMIN_ALLOW_HTTP=true` en producción. **PENDIENTE**:
   no se implementó un guard duro porque el build/arranque local de este repositorio usa
   HTTP y no se dispone de un indicador fiable de entorno; se documenta como requisito
   de despliegue y se recomienda validarlo en el pipeline de staging.

## 4. Comportamiento ante fallos

| Fallo | Comportamiento esperado | Comprobación |
|---|---|---|
| Error al resolver permisos | 403, sin concesión | Código del middleware; prueba de usuario inválido |
| Usuario eliminado | 401/403 en la siguiente petición | Comprobación por petición |
| Caché vacía o expirada | Recalcula desde base | `cache.test.ts` |
| Escritura de políticas falla | Rollback de rol/políticas/auditoría | Transacción del servicio |
| Auditoría falla | Rollback de la operación | Misma transacción |
| PostgreSQL no disponible | 5xx/denegación, no `allow` | Revisión; prueba destructiva pendiente |
| Ruta nueva sin clasificar | 403 para restringidos | Prueba HTTP |
| Ruta ambigua | 403 | Prueba unitaria |
| API key secreta | 401 | Prueba HTTP |

## 5. Requisitos para crear staging

1. PostgreSQL aislado con datos sintéticos y backup automático.
2. Build de producción (`pnpm --filter @dtc/backend build`, `pnpm --filter storefront build`).
3. Proxy inverso con TLS válido y redirección 80 → 443.
4. Variables propias: `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET`, CORS, `FILE_BACKEND_URL`.
5. `ADMIN_ALLOW_HTTP` desactivado.
6. Cuentas DEMO por perfil y una cuenta con múltiples roles.
7. Ejecutar `docs/43` completo contra staging.
8. Verificar backup/restore con un ensayo real.
9. Validar sesión, logout, expiración y revocación con dos navegadores.
10. Repetir la matriz con dos instancias del backend si se va a escalar horizontalmente.

## 6. Dictamen

# NO-GO

El backend está endurecido y la regresión local es verde, pero **no se cumplen las condiciones
esenciales para producción**:

1. No hay validación HTTPS, proxy, cookies ni sesiones en un entorno representativo.
2. No hay backup/restauración verificados.
3. No hay invalidación distribuida; la ventana de revocación entre instancias es de hasta 15 s.
4. La navegación nativa sigue sin filtrar (BLOQUEADO POR LICENCIA), por lo que el requisito
   de control visual integral no está satisfecho.
5. No se ejecutó el workflow de CI en GitHub.
6. La granularidad de operaciones nativas sensibles es parcial y el filtrado por campo no existe.
7. La prueba de concurrencia multiadministrador y de caída de PostgreSQL no se ejecutó.

## 7. Qué sí está listo

- Precedencia de `deny` y permisos efectivos.
- Orden de autenticación y excepciones del shell.
- Eliminación del bootstrap automático y recuperación operativa auditada.
- Transacciones de escritura de roles/permisos/auditoría.
- Aislamiento de contactos y separación de `export`.
- Revocación inmediata en el proceso.
- Denegación por defecto de rutas no clasificadas y ambiguas.
- Cobertura de pruebas negativas y matriz documentada.

## 8. Condiciones para pasar a GO

- [ ] Staging con HTTPS y proxy validados.
- [ ] Cookies `Secure`/`HttpOnly`/`SameSite` comprobadas en navegador.
- [ ] Backup y restauración ensayados y documentados.
- [ ] Invalidación distribuida o decisión formal de operar una sola instancia con ventana aceptada.
- [x] CI ejecutado y verde en GitHub.
- [ ] Sidebar nativo resuelto (licencia o panel operativo restringido) o aceptación formal del requisito de UX.
- [ ] Prueba de concurrencia y de caída de PostgreSQL.
- [ ] Filtrado por campo evaluado y, si aplica, implementado.
- [ ] Riesgos restantes aceptados por los responsables autorizados.
