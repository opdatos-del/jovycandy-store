import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Vincula logos con familias canónicas sin inventar taxonomía.
 *
 * - `jovy_brand_logo_family` es la fuente de verdad de la relación.
 * - `jovy_brand_logo.families_linked` distingue "nunca vinculado" (se sigue
 *   leyendo el array legado) de "vinculado explícitamente sin familias".
 * - Esta migración no mapea `families[]`: `jovy-brand` migra antes que
 *   `jovy-catalogue`, así que `jovy_product_family` puede no existir todavía.
 *   El backfill es un paso explícito e idempotente:
 *   `pnpm --dir apps/backend exec medusa exec ./src/scripts/sync-brand-logo-families.ts`.
 *   Conserva los slugs sin coincidencia en `jovy_brand_logo.families` y no crea
 *   familias.
 */
export class Migration20261113160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "jovy_brand_logo_family" ("id" text not null, "logo_id" text not null, "family_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_brand_logo_family_pkey" primary key ("id"));`)
    this.addSql(`create unique index if not exists "IDX_jovy_brand_logo_family_unique" on "jovy_brand_logo_family" ("logo_id","family_id") where deleted_at is null;`)
    this.addSql(`create index if not exists "IDX_jovy_brand_logo_family_family" on "jovy_brand_logo_family" ("family_id") where deleted_at is null;`)

    this.addSql(`alter table if exists "jovy_brand_logo" add column if not exists "families_linked" boolean not null default false;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "jovy_brand_logo" drop column if exists "families_linked";`)
    this.addSql(`drop table if exists "jovy_brand_logo_family" cascade;`)
  }
}
