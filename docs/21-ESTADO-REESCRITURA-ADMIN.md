# Estado — reescritura administrativa en Medusa

| Área | Estado real | Evidencia verificable | Pendiente concreto |
| --- | --- | --- | --- |
| PostgreSQL y migraciones Medusa base | IMPLEMENTADO Y VALIDADO | `medusa db:migrate` contra `jovycandy_prototipo_medusa` | Ninguno de infraestructura local |
| Auditoría del administrador histórico | IMPLEMENTADO Y VALIDADO | `13-AUDITORIA-ADMIN-ORIGINAL.md` | Actualizar al cerrar cada módulo |
| `jovy_content` y Contenido Jovy | IMPLEMENTADO Y VALIDADO | E2E Brave secuencial: login, validación, alta, duplicado, edición, publicación, Store API, archivado, auditoría y borrado lógico | Casos secundarios agrupados en mantenimiento |
| Marketing: Hero | IMPLEMENTADO Y VALIDADO PARCIALMENTE | CRUD Admin, publicación/archivado, orden, CTA, vigencia, activación, color global, File Module, Product Link y E2E Brave básica | E2E modular de subida PNG/JPEG/WebP, sustitución y compensación de Product Link; no se declara cierre total |
| Marketing: Banners y promociones | IMPLEMENTADO SIN VALIDAR | APIs/workflows existentes; nueva pestaña Admin con listado, CRUD, slots, frecuencia, orden, programación y subida | E2E Brave específica y contratos HTTP negativos |
| Eventos Jovy | IMPLEMENTADO Y VALIDADO PARCIALMENTE | `jovy_events`, migración aplicada, workflow, API Admin/Store, auditoría, pantalla Admin y E2E Brave secuencial de ciclo editorial | Gestión visual de tipos, reordenamiento y multimedia requieren cierre funcional y E2E complementaria |
| Galería Casa Jovy y logos | IMPLEMENTADO Y VALIDADO PARCIALMENTE | `jovy_brand`, migraciones `20261113120000` y `20261113123000` aplicadas, Locking Module PostgreSQL, APIs Admin/Store, auditoría, UI y E2E Brave individual de Galería y Logos aprobadas | Pruebas de concurrencia/intervalos del límite de cuatro y borrado físico seguro de medios compartidos; no hay borrado físico desde Brand |
| Contactos | IMPLEMENTADO Y VALIDADO PARCIALMENTE | `jovy_contacts`, migración `20261113130000` aplicada, intake Store exclusivo, esquema estricto, honeypot, límite por IP, APIs Admin autenticadas, auditoría sin PII, UI y E2E Brave individual aprobada | El rate limiter es en memoria y solo apto para laboratorio de una instancia; producción requiere un límite compartido/edge y política aprobada de retención |
| RBAC fino / roles | BLOQUEADO POR VERIFICACIÓN | Las rutas `/admin/jovy/*` usan autenticación oficial y devolvieron 401 sin sesión | Verificar roles granulares disponibles en la instalación Medusa; no se simula RBAC |
| Store API y API key | IMPLEMENTADO Y VALIDADO | Clave local ya configurada; E2E usa la clave ignorada para APIs Store | Validar nuevos recursos por módulo |

## Ejecución y evidencia reciente

- `pnpm --dir apps/backend typecheck`: aprobado después de Brand y Contactos.
- `pnpm --dir apps/backend lint`: aprobado después de Brand y Contactos.
- `pnpm --dir apps/backend test:unit`: 2 suites, 6 pruebas aprobadas. Jest conserva la advertencia existente de `--forceExit`.
- `pnpm exec medusa build`: aprobado después de Brand y Contactos (backend y Admin compilados).
- Migraciones oficiales aplicadas sin reinicializar PostgreSQL: Brand base, Brand scheduling y Contactos.
- Playwright/Brave secuencial aprobado individualmente: `jovy-content.spec.ts`, `jovy-hero.spec.ts`, `jovy-events.spec.ts`, `jovy-brand.spec.ts` (Galería y Logos) y `jovy-contacts.spec.ts`.
- Brand: Galería admite ventanas UTC opcionales y valida bajo un bloqueo PostgreSQL compartido que nunca haya más de cuatro elementos `published`/`enabled` simultáneos, incluso con intervalos solapados. Logos mantiene el archivo original y solo persiste metadatos de recorte.
- Multimedia: la ruta administrativa usa Multer en memoria con límite de 5 MB antes de validación de firma, MIME y decodificación `sharp`; File Module local conserva archivos públicos de laboratorio. No subir contenido sensible/privado.
- Contactos: no existe Store API de listado/lectura; las mutaciones administrativas requieren autenticación Medusa. El actor se toma de la sesión, la auditoría no contiene mensaje, email ni teléfonos. Honeypot y rate limit en memoria son una defensa básica de laboratorio, no una solución distribuida.
- La regresión agrupada con las cinco specs no es válida como aprobación: aun con `workers: 1`, el proceso temporal `medusa develop` en `9001` se reinició/dejó de escuchar después del primer flujo Brand y produjo `ECONNREFUSED` en pruebas posteriores. Las ejecuciones individuales siguen siendo la evidencia válida hasta estabilizar el runner.

## Orden de continuación

1. Estabilizar el ciclo de vida del servidor `medusa develop` para poder ejecutar la regresión agrupada de Playwright; mantener `workers: 1` mientras PostgreSQL sea compartido.
2. Ampliar E2E/integración de Hero (PNG/JPEG/WebP, producto y compensación) y crear la E2E de Banners.
3. Completar tipos, ordenamiento y multimedia de Eventos desde Admin.
4. Añadir pruebas de concurrencia del límite programado de Galería y definir una política global de referencias antes de permitir borrar físicamente archivos.
5. Revisar paridad, permisos reales y retención de Contactos para producción.
