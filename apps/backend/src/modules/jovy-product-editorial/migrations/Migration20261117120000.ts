import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Append-only: añade la modalidad comercial a la ficha editorial existente.
 * Sin backfill: las fichas históricas quedan en `null` y se resuelven como
 * CATALOG_ONLY, nunca como vendibles. `down()` solo retira esta columna.
 */
export class Migration20261117120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "jovy_product_editorial" add column if not exists "commercial_mode" text null check ("commercial_mode" in ('catalog_only','sellable'));`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "jovy_product_editorial" drop column if exists "commercial_mode";`)
  }
}
