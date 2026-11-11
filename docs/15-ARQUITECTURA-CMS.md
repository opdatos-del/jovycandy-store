# Arquitectura CMS nativa

```mermaid
flowchart TB
  Admin[Operador autenticado] --> AdminUI[Medusa Admin UI Route]
  AdminUI --> AdminAPI[/admin/jovy/*]
  AdminAPI --> Auth[authenticate user]
  Auth --> Workflows[Workflows CMS]
  Workflows --> Content[Jovy Content Module]
  Workflows --> Audit[Audit log]
  Content --> DB[(PostgreSQL)]
  Audit --> DB
  Storefront[Storefront futuro] --> StoreAPI[/store/jovy/*]
  StoreAPI --> Content
```

## Límites

- `jovy_content` solo administra contenido editorial y su auditoría.
- Las rutas administrativas requieren autenticación de usuario de Medusa en backend; ocultar una ruta en la UI no es autorización.
- Las rutas Store no dependen de la sesión administrativa y aplican el filtro de publicación en servidor.
- El Product Module mantiene la autoridad sobre productos, precios, variantes, stock y pedidos.

## Alternativas descartadas

Un CMS genérico de tabla única se descartó porque eventos, banners y contactos tienen reglas diferentes. Un administrador React separado se descartó porque duplicaría sesión, navegación y controles de Medusa Admin.
