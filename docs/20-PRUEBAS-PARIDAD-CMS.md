# Pruebas y paridad CMS

## Cobertura ejecutada

| Caso | Capa | Resultado |
| --- | --- | --- |
| Borrador/archivado no públicos | Unitaria | Aprobado |
| Publicación futura no pública | Unitaria | Aprobado |
| Publicado sin fecha explícita visible | Unitaria | Aprobado |
| Tipos del backend | TypeScript | Aprobado |
| Convenciones Medusa/workflows | Lint | Aprobado |
| Backend + Medusa Admin | Build | Aprobado |
| Migración DML `jovy_content` | PostgreSQL | Aprobado |
| Health, Admin, login y API administrativa | Runtime acotado | Aprobado: `/health`, `/app`, login y `GET /admin/jovy/content/pages` devolvieron HTTP 200 |
| Store API sin Publishable API Key | Runtime acotado | Aprobado: Medusa devolvió HTTP 400 antes del handler, como exige la Store API |

## Matriz de paridad inicial

| Necesidad heredada | Implementación nueva | Resultado |
| --- | --- | --- |
| Contenido con borrador/publicación | Página editorial con estados y fecha | Implementado y validado a nivel unitario/migración |
| Lectura pública separada | Store API filtra estado/fecha | Implementado; falta Publishable API Key para validar respuesta publicada 200 |
| Auditoría de mutaciones | `jovy_audit_log` desde workflows | Implementado; creación HTTP alcanzada y registro técnico limpiado mediante soft delete; falta aserción automatizada de auditoría |
| Administración integrada | UI Route de Medusa Admin | Compilada; login de Medusa validado, falta prueba visual/manual o E2E de la ruta |
| Hero, banners, eventos, galería, contactos | Módulos aún no construidos | Pendiente |

La cuenta admin local y el runtime ya están validados. Se mantienen pendientes E2E de navegador, aserciones de auditoría y la prueba Store exitosa con una Publishable API Key configurada.
