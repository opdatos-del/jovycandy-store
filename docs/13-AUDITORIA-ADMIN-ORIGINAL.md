# Auditoría funcional — administrador original

**Estado:** COMPLETADA EN MODO LECTURA. No se copió código ni se modificó `admin-webjovy`.

## Evidencia revisada

- Ensamblado de rutas: `admin-webjovy/backend/src/app.ts`.
- Contratos HTTP y roles: `backend/src/routes/*.routes.ts`.
- Campos y validaciones: `backend/src/types/*` y `backend/src/validators/*`.
- Pantallas: `frontend/src/App.tsx`, `frontend/src/pages/*`.

## Inventario y matriz de destino

| Módulo original | Funcionalidad y regla observada | Origen | Destino Medusa | Prioridad | Estado |
| --- | --- | --- | --- | --- | --- |
| Productos/categorías | Catálogo editorial, familia, gramaje, certificaciones, imágenes, publicación, orden y restauración | `routes/product.routes.ts`, `validators/product.validator.ts` | **Product Module** para comercio; metadata editorial o links para atributos no comerciales | Alta | Pendiente |
| Hero / nuevos lanzamientos | Selección ordenada, activa, con texto, color e imagen opcional; configuración visual global | `new-releases-*.routes.ts`, `types/new-releases-*.ts` | Marketing Content + link a producto Medusa | Alta | Diseñado |
| Promociones | Slots `promo`/`hint`, activación, prioridad, frecuencia y ventana temporal | `promo-banner.routes.ts`, `types/promo-banner.ts` | Marketing Content | Alta | Diseñado |
| Eventos | Borrador/publicado/archivado, tipo, fechas, prioridad y medio | `event.routes.ts`, `types/event.ts`, `pages/EventForm.tsx` | Events Module | Alta | Diseñado |
| Galería Casa Jovy | Imagen, orden, soft delete y reordenamiento | `casa-jovy-gallery.routes.ts`, `types/casa-jovy-gallery.ts` | Gallery Module + File Module | Media | Diseñado |
| Logos | Logo por familia, orden y recorte no destructivo | `logo.routes.ts`, `validators/logo.validator.ts` | Marketing/Brand Content + File Module | Media | Diseñado |
| Medios | Carga, consulta, borrado y recorte de imágenes/videos | `image.routes.ts`, `video.routes.ts` | File Module; no almacenamiento paralelo | Alta | Pendiente |
| Contactos | Recepción pública, tipos, pendientes/atendidos, filtros, exportación y borrado lógico | `contact-request.routes.ts`, `types/contact-request.ts`, `pages/SalesContactsList.tsx` | Contact Module | Alta | Diseñado |
| Usuarios/roles | Login, usuarios, bloqueo y roles internos | `auth.routes.ts`, `user.routes.ts`, `role.routes.ts` | User/Auth de Medusa; no migrar JWT ni contraseñas | Alta | Nativo / pendiente validación |
| Analítica | Page views, eventos y métricas de dashboard | `analytics.routes.ts`, `controllers/analytics.controller.ts` | No reconstruir hasta definir una fuente aprobada y privacidad | Baja | Excluido por ahora |
| SSE/sincronización | Notificaciones de cambios entre admin y web | `admin-sync.routes.ts`, `public-sync.routes.ts` | No necesaria en el primer CMS; usar revalidación posterior | Baja | Excluido por ahora |

## Reglas relevantes conservadas

- Publicar, programar y archivar deben ser estados distintos; borradores nunca salen por Store API.
- La edición debe conservar trazabilidad de actor, acción, entidad y fecha.
- Contactos contienen datos personales y no tienen endpoint público de consulta.
- Productos del legado no son productos comerciales: no incluían SKU, precio, variantes, stock ni pedidos.
- El sistema anterior permitía roles CMS/ventas específicos. La disponibilidad de RBAC equivalente en la edición instalada de Medusa debe verificarse antes de prometer paridad granular.

## Funciones descartadas o diferidas

No se trasladan Express, MySQL, JWT propio, nodemailer, SSE, recorte de archivos ni sincronizaciones. Medusa administra autenticación y comercio; File Module reemplazará el repositorio de archivos cuando se implemente carga de medios.
