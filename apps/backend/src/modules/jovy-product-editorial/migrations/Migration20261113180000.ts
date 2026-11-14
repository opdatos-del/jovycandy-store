import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Append-only: crea la tabla de la capa editorial de producto. `product_id` no
 * declara FK porque el producto vive en el Product Module; su existencia se
 * valida al escribir. El índice único es parcial (`deleted_at is null`) para que
 * una ficha borrada no impida crear o restaurar la vigente.
 */
export class Migration20261113180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "jovy_product_editorial" ("id" text not null, "product_id" text not null, "gramaje" text null, "certifications" jsonb not null default '[]'::jsonb, "sort_order" integer not null default 0, "is_new" boolean not null default false, "editorial_status" text check ("editorial_status" in ('draft','published','archived')) not null default 'draft', "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_product_editorial_pkey" primary key ("id"));`)
    this.addSql(`create unique index if not exists "IDX_jovy_product_editorial_product_unique" on "jovy_product_editorial" ("product_id") where deleted_at is null;`)
    this.addSql(`create index if not exists "IDX_jovy_product_editorial_visibility" on "jovy_product_editorial" ("editorial_status", "sort_order") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "jovy_product_editorial" cascade;`)
  }
}
