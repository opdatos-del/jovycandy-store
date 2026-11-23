# Plan de integración comercial Medusa para el catálogo

**Estado:** PROPUESTO. El catálogo oficial ya usa el diseño C con datos CMS; precios, variantes, inventario, carrito y checkout siguen pendientes.

## 1. Mapeo UI → fuente futura

| UI | Fuente futura |
|---|---|
| Nombre y descripción comercial | Medusa Product |
| Imágenes y galería | Medusa Product + File Module |
| Variantes/presentaciones | Medusa Product Variants |
| Precio | Medusa Pricing según región/moneda |
| Disponibilidad | Medusa Inventory + sales channel |
| Categorías | Medusa Product Categories + Jovy Catalogue |
| Familia | Jovy Catalogue |
| Gramaje | Variant metadata o Jovy Product Editorial |
| Certificaciones | Jovy Product Editorial con evidencia editorial |
| Novedad | Jovy Product Editorial |
| Modalidad `CATALOG_ONLY`/`SELLABLE` | Jovy Product Editorial |
| Carrito | Medusa Cart |
| Recomendaciones | categoría/familia, novedades y relaciones editoriales explícitas |

## 2. Arquitectura objetivo

```text
App Router pages (server)
  → storefront query service
    → Medusa Store API client
      → Products / Pricing / Inventory / Cart
    → Jovy CMS Store APIs
      → editorial, modalidad, familia, certificaciones

Client islands
  → filtros y búsqueda
  → selección de variante
  → cantidad
  → mutaciones de carrito solo para SELLABLE
```

Mantener `catalog-page`, `CatalogCard`, `ProductDetail`, filtros y recomendaciones como componentes reutilizables. Los tipos de transporte Medusa no deben filtrarse directamente a UI: crear un mapper hacia el contrato del storefront.

## 3. Contrato de lectura propuesto

Antes de implementar, definir:

- paginación `limit`/`offset` o cursor, total y orden estable;
- filtros por categoría, familia, gramaje, certificación, disponibilidad y novedad;
- región y moneda obligatorias para precio;
- variantes con id real, presentación, disponibilidad y precio calculado;
- imágenes ordenadas con `alt` editorial;
- modalidad comercial resuelta en servidor;
- relaciones editoriales explícitas y fallback por categoría/familia.

Evitar filtrar grandes catálogos completamente en cliente. El catálogo actual resuelve búsqueda y facetas en cliente sobre un conjunto pequeño; en producción debe migrar a servidor o a un motor indexado, con filtros serializados en search params.

## 4. Cambios backend por confirmar

| Área | Decisión |
|---|---|
| Store API de productos | Revisar cobertura de campos y paginación |
| Editorial | Exponer campos validados sin duplicar Product |
| Precio y variantes | Incluir en el contrato de lectura |
| Filtros | Añadir consulta/indexación solo si el volumen lo exige |
| Relacionados | Reglas deterministas y relaciones editoriales |
| Galería | Definir orden, `alt` y clasificación de medios |
| Disponibilidad | Resolver por variante, ubicación, región y sales channel |
| Modalidad | Aplicar en lectura y mutación; no solo ocultar CTAs |

No crear migraciones hasta aprobar contrato y ownership. Las migraciones futuras serán append-only dentro del módulo propietario.

## 5. Flujo de carrito

1. Resolver región y sales channel.
2. Cargar producto/variante con precio y disponibilidad actuales.
3. Verificar `commercialMode === "SELLABLE"` en backend.
4. Crear o recuperar Medusa Cart.
5. Añadir `variant_id` y cantidad mediante Store API.
6. Manejar precio cambiado, stock insuficiente, variante deshabilitada y cantidad máxima.
7. Refrescar el resumen desde la respuesta del servidor.

`CATALOG_ONLY` debe ser una restricción de negocio en el límite servidor/API, no una condición visual. La acción alternativa irá a contacto o consulta aprobada, con validación, rate limiting y consentimiento cuando corresponda.

## 6. Seguridad y consistencia

- no confiar en precios, modalidad, stock o totales enviados por cliente;
- validar locale, región, ids, cantidades y search params;
- no exponer credenciales admin ni usar Admin API desde navegador;
- sanitizar contenido editorial enriquecido antes de renderizarlo;
- limitar y observar endpoints de búsqueda/contacto;
- mantener secretos fuera de Git;
- preservar la separación entre datos comerciales Medusa y contenido editorial Jovy.

## 7. Pruebas necesarias

- unitarias: mapper, modalidad, disponibilidad, filtros y recomendaciones;
- integración: Store API + CMS editorial + región/precio;
- contrato: esquema de producto/listado, errores y paginación;
- E2E: búsqueda, filtros, variante, carrito, `CATALOG_ONLY`, stock cambiado y móvil;
- accesibilidad: teclado, lector, focus, diálogos, errores y anuncios;
- rendimiento: LCP de producto, tamaños responsive, cache y paginación.

## 8. Ruta de implementación

1. Congelar el contrato visual y de datos del catálogo oficial.
2. Implementar servicio de Store API y mapper de producto/variante/precio.
3. Añadir precios y disponibilidad reales a tarjetas y ficha.
4. Implementar selección de variante y cantidad.
5. Integrar carrito Medusa por región.
6. Aplicar modalidad y disponibilidad en backend antes de habilitar compra.
7. Añadir estados loading, error, vacío y revalidación.
8. Ejecutar seguridad, accesibilidad, rendimiento y pruebas completas.
9. Promover mediante PR, CI y revisión.
