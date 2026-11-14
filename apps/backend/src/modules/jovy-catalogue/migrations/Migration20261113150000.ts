import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261113150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "jovy_catalogue_category" ("id" text not null, "key" text check ("key" in ('sazonador', 'chamoy', 'gomitas_almidon', 'dulces_paletas', 'pinatero', 'gomitas_grenetina')) not null, "name" text not null, "description" text null, "sort_order" integer not null default 0, "active" boolean not null default true, "coming_soon" boolean not null default false, "interaction_locked" boolean not null default false, "image_file_id" text null, "image_url" text null, "medusa_category_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_catalogue_category_pkey" primary key ("id"));`)
    this.addSql(`create unique index if not exists "IDX_jovy_catalogue_category_key_unique" on "jovy_catalogue_category" ("key") where deleted_at is null;`)
    this.addSql(`create index if not exists "IDX_jovy_catalogue_category_order" on "jovy_catalogue_category" ("sort_order", "active") where deleted_at is null;`)

    this.addSql(`create table if not exists "jovy_product_family" ("id" text not null, "name" text not null, "slug" text not null, "description" text null, "medusa_category_id" text null, "sort_order" integer not null default 0, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_product_family_pkey" primary key ("id"));`)
    this.addSql(`create unique index if not exists "IDX_jovy_product_family_slug_unique" on "jovy_product_family" ("slug") where deleted_at is null;`)
    this.addSql(`create index if not exists "IDX_jovy_product_family_order" on "jovy_product_family" ("sort_order", "active") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "jovy_product_family" cascade;`)
    this.addSql(`drop table if exists "jovy_catalogue_category" cascade;`)
  }
}
