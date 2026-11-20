# Decisión de arquitectura de autorización

**Corte:** 2026-11-20  
**Base:** `b456ee2e61b82bc4744f01dd93ff644fcb1f4ca2`  
**Estado:** mecanismo propio **IMPLEMENTADO Y PROBADO** para JovyCandy; RBAC Enterprise **NO LICENCIADO**.

## 1. Verificación de licencia

| Comprobación | Resultado |
|---|---|
| `MEDUSA_LICENSE_KEY` / `MEDUSA_LICENSE_PUBLIC_KEY` | Ausentes en el entorno local y en `.env.example` |
| `@medusajs/rbac` como dependencia directa | No instalado; solo aparece como dependencia transitiva del paquete Medusa |
| Registro del módulo RBAC en `medusa-config.ts` | No registrado |
| Tablas `rbac_*` en PostgreSQL | No existen |
| Rutas `/rbac/*` | Desactivadas por `isDisabled` al no estar instalado el módulo |
| `authorize` / `hasPermission` | No-op / `true` cuando el módulo no está instalado |

**Decisión:** no se registra ni se importa `@medusajs/rbac`. No se elude ninguna comprobación de licencia y no se simula el módulo Enterprise.

## 2. Alternativas evaluadas

### A. RBAC Enterprise oficial

- **Ventajas:** políticas nativas para todos los recursos de Medusa, roles múltiples, pantallas oficiales, `authorize` en rutas core, sincronización de políticas, API keys heredando el usuario creador.
- **Requisitos:** acuerdo comercial, claves de licencia, registro del módulo, migraciones que asignan Super Admin a los usuarios existentes.
- **Coste:** licencia y ventana de activación controlada.
- **Resultado:** **BLOQUEADO POR LICENCIA**. Sigue siendo la opción recomendada si se necesita granularidad nativa completa.

### B. Autorización propia sobre identidad nativa

- **Implementado.** Reutiliza `user` + `authenticate` de Medusa; no hay segundo login, usuarios ni contraseñas.
- Persiste roles, políticas, asignaciones y excepciones individuales en el módulo `jovy-authz`.
- Middleware global en `/admin/*` con **denegación por defecto**.
- Contactos: aislamiento por bandeja en listado, conteos, detalle, mutaciones, auditoría, papelera y exportaciones.
- Superficies nativas: mapa coercitivo por prefijo y método; lo no clasificado se deniega.
- API keys secretas: rechazadas en el Admin para evitar credenciales de máquina con privilegios ilimitados.

### C. Solo ocultar controles en el frontend

- **Descartada.** No cumple el requisito de autorización real y dejaría las APIs abiertas.

### D. Segundo sistema de identidad

- **Descartada.** Duplicaría usuarios, sesiones y credenciales sin una necesidad demostrada.

## 3. Cobertura de seguridad

| Superficie | Cobertura |
|---|---|
| `/admin/jovy/**` | Inventario declarativo de 101 métodos; regla ausente ⇒ 403 |
| Contactos por ID | Tipo real leído de la fila; banda no autorizada ⇒ 404 |
| Contactos consolidados | Requiere lectura/exportación de las cuatro bandejas |
| `/admin/**` nativo | Prefijo → recurso `medusa_*`; sin permiso o sin clasificación ⇒ 403 |
| Shell del Admin | Lecturas mínimas (`users/me`, notificaciones, layouts, traducciones, feature flags, stores) |
| API keys | El guard exige `auth_context.actor_type === "user"` ⇒ 401 para `x-medusa-access-token` |
| RBAC Enterprise | No activo; no se declara cobertura oficial |

### Limitación esencial

El mapa nativo es **coercitivo, no RBAC oficial**. Una ruta nueva de Medusa no clasificada queda denegada hasta añadirla, lo que es seguro pero puede requerir mantenimiento tras una actualización. Las pantallas nativas siguen visibles en el shell; un usuario restringido que las abra recibirá 403 del servidor. No se afirma que la navegación nativa esté filtrada por permisos.

## 4. Compatibilidad con Medusa

- Módulo Medusa v2 estándar (`Module`, `MedusaService`, migración MikroORM).
- Sin modificar el User Module, Authentication Module, Product Module ni migraciones aplicadas.
- Migración aditiva `Migration20261120100000`; rollback elimina solo las tablas nuevas.
- El middleware se declara en `src/api/middlewares.ts` después de la autenticación nativa.
- Los endpoints existentes conservan contratos, envelopes y códigos de negocio; se añaden 401/403/404 de autorización.

## 5. Costes de mantenimiento

- Mantener el inventario `JOVY_ENDPOINT_INVENTORY` sincronizado. Una prueba unitaria falla si aparece un `route.ts` o método sin clasificar, o una regla fantasma.
- Revisar `NATIVE_AREAS` al actualizar Medusa.
- La caché de permisos es de 15 s por proceso; un cambio de rol puede tardar ese intervalo.
- La UI de accesos es propia; la asignación por usuario se integra en el detalle nativo de Usuarios y el catálogo de roles vive en `Settings → Accesos y permisos`. No sustituye la pantalla Enterprise de roles.

## 6. Riesgos

- Un error de clasificación nativa puede denegar una función legítima (fail-closed, no fail-open).
- El bootstrap por correo debe retirarse después de asignar roles persistentes. El entorno local
  ya opera sin él con la asignación `superadmin` en base de datos.
- Los roles del sistema son editables salvo Superadministrador; un cambio excesivo puede dejar sin acceso a una función.
- La navegación nativa no se oculta; la protección real es la API.
- No hay pruebas de navegador con múltiples cuentas DEMO; la matriz negativa se cubre en integración HTTP.

## 7. Recomendación

1. Mantener este mecanismo para el CMS JovyCandy.
2. Si el negocio requiere granularidad nativa completa, licenciar RBAC Enterprise y migrar el modelo propio a políticas oficiales.
3. No permitir accesos restringidos en producción hasta completar la verificación de la sección 10 de `docs/39-IMPLEMENTACION-Y-PRUEBAS-RBAC.md`.

## 8. Estrategia de implementación

1. Migración y registro del módulo `jovy-authz`.
2. Bootstrap explícito por correo y asignación persistente de Superadministrador.
3. Middleware global con inventario y mapa nativo.
4. Aislamiento de contactos en middleware **y** handlers.
5. API de administración de roles/usuarios, widget `user.details` y catálogo global de roles.
6. Gating de UI en las features migradas.
7. Pruebas unitarias, de módulo, HTTP y regresión completa.
