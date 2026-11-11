# Estado de desarrollo

## Primera entrega: infraestructura y arquitectura base

| Área | Estado | Evidencia |
| --- | --- | --- |
| Repositorio Git aislado | COMPLETADO Y VALIDADO | Git inicializado solo en `prototipo`; remoto privado `origin` configurado para `opdatos-del/jovycandy-store` |
| pnpm Workspaces | EN PROCESO | Workspace raíz y lockfile raíz validados; dos metadatos anidados generados por Next.js esperan eliminación autorizada |
| Next.js storefront | COMPLETADO Y VALIDADO | Dependencias compatibles actualizadas; lint, typecheck, build y HTTP 200 correctos |
| Medusa + Admin compilables | COMPLETADO Y VALIDADO | Medusa `2.22.6` actual; `medusa build` completó backend y frontend Admin |
| Actualización de dependencias | COMPLETADO Y VALIDADO | Ver `04-DEPENDENCIAS-ACTUALIZADAS.md`; quedan restricciones transitivas documentadas |
| PostgreSQL local detectado | COMPLETADO Y VALIDADO | Servicio PostgreSQL 18 activo en el puerto 5432 |
| Conexión a base aislada | COMPLETADO Y VALIDADO | `apps/backend/.env` cargado por Medusa; consulta de solo lectura autenticada contra `jovycandy_prototipo_medusa` |
| Migraciones oficiales | COMPLETADO Y VALIDADO | Medusa base y `jovy_content` migrados correctamente en PostgreSQL |
| Health/Admin/login Medusa | COMPLETADO Y VALIDADO | Instancia temporal: `/health` 200, `/app` 200, login administrativo 200 y API CMS autenticada 200 |
| Diseño visual corporativo | NO INICIADO | Fuera del alcance de la primera entrega |
| Comercio, CMS y clientes | NO INICIADO | Fuera del alcance de la primera entrega |
| E2E/Playwright | NO INICIADO | Se añadirá con el primer flujo vertical |

## Próximo paso

Configurar una Publishable API Key durante la fase Store y añadir pruebas HTTP/E2E del CMS. La fase CMS administrativa continúa separada del diseño y funcionalidades comerciales del storefront.
