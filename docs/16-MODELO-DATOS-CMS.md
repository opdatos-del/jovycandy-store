# Modelo de datos CMS

## Implementado: `jovy_content`

```mermaid
erDiagram
  JOVY_EDITORIAL_PAGE {
    string id PK
    string slug UK
    enum status
    json translations
    json seo
    datetime published_at
    datetime created_at
    datetime updated_at
    datetime deleted_at
  }
  JOVY_AUDIT_LOG {
    string id PK
    string actor_id
    string entity_type
    string entity_id
    enum action
    json metadata
    datetime created_at
  }
  JOVY_EDITORIAL_PAGE ||--o{ JOVY_AUDIT_LOG : audited_by_entity_id
```

`translations` exige `es` y `en`; cada idioma tiene título y puede contener resumen/cuerpo. `seo` es parcial por idioma. El `slug` es único. Medusa DML aporta `created_at`, `updated_at` y `deleted_at` para soft delete.

## Diseñado, no implementado

- Marketing: banner, hero configuration y featured product; este último se enlazará al Product Module mediante Module Links cuando haya productos comerciales.
- Events: evento, tipo, medios gestionados por File Module y publicación programada.
- Gallery/Brand: entradas ordenadas que referencian IDs de File Module.
- Contact: solicitud, estado operativo y auditoría, sin relación pública de lectura.
