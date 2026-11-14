import { model } from "@medusajs/framework/utils"

/**
 * Relación real logo ↔ familia. Vive dentro de `jovy-brand` y guarda solo el
 * identificador de la familia canónica (`jovy_product_family.id`), sin duplicar
 * nombre ni slug.
 *
 * Se eligió tabla propia del módulo en lugar de un Module Link porque el
 * backfill debe ejecutarse en una migración append-only del módulo, y Medusa
 * crea las tablas de link después de las migraciones de módulos
 * (`db:migrate` → `sync-links`). El filtro Store por familia también se resuelve
 * en una sola consulta local. Igual que las tablas de link de Medusa, no hay FK
 * entre módulos: la existencia y el estado `active` se validan al escribir.
 */
const LogoFamily = model
  .define("jovy_brand_logo_family", {
    id: model.id().primaryKey(),
    logo_id: model.text(),
    family_id: model.text(),
  })
  .indexes([
    { on: ["logo_id", "family_id"], unique: true },
    { on: ["family_id"] },
  ])

export default LogoFamily
