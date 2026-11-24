import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Preset visual por familia. Es aditivo y opcional: los productos sin preset
 * heredan el comportamiento global del storefront. No se toca ninguna tabla
 * comercial de Medusa.
 */
export class Migration20261123200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "jovy_product_family" add column if not exists "card_preset" text null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "jovy_product_family" drop column if exists "card_preset";`)
  }
}
