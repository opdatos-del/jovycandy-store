# APIs CMS

## Implementadas

| Método | Ruta | Audiencia | Semántica |
| --- | --- | --- | --- |
| `GET` | `/admin/jovy/content/pages?limit&offset` | Admin autenticado | Lista paginada, incluidos borradores. |
| `POST` | `/admin/jovy/content/pages` | Admin autenticado | Crea página y auditoría mediante workflow. |
| `GET` | `/admin/jovy/content/pages/:id` | Admin autenticado | Obtiene una página para edición. |
| `PUT` | `/admin/jovy/content/pages/:id` | Admin autenticado | Actualiza/publica/archiva y audita. |
| `DELETE` | `/admin/jovy/content/pages/:id` | Admin autenticado | Soft delete y auditoría. |
| `GET` | `/store/jovy/content/pages/:slug` | Store API | Requiere `x-publishable-api-key` según Medusa; devuelve solo contenido publicado y vigente; devuelve `404` para borrador, archivado, futuro o ausente. |

Las entradas inválidas devuelven `400` con errores de campos; recursos inexistentes devuelven `404`. Una solicitud Store sin Publishable API Key válida se rechaza antes del handler con `400`, comportamiento nativo de Medusa. No se serializa `id`, auditoría ni estado interno en la respuesta Store.

## Próximos contratos

Banners, eventos, galerías y contactos se diseñarán antes de crear consumidores. Contactos solo expondrán un `POST` público limitado y APIs administrativas protegidas; nunca un listado público.
