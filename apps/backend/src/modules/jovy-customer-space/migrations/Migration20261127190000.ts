import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Tablas nuevas; no modifica las tablas nativas ni requiere migrar datos existentes. */
export class Migration20261127190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table "jovy_wishlist" ("id" text primary key, "customer_id" text not null, "name" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null);`)
    this.addSql(`create index "IDX_jovy_wishlist_customer" on "jovy_wishlist" ("customer_id") where "deleted_at" is null;`)
    this.addSql(`create unique index "IDX_jovy_wishlist_favorites" on "jovy_wishlist" ("customer_id") where "name" is null and "deleted_at" is null;`)
    this.addSql(`create table "jovy_wishlist_item" ("id" text primary key, "wishlist_id" text not null references "jovy_wishlist" ("id") on update cascade on delete cascade, "product_variant_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null);`)
    this.addSql(`create unique index "IDX_jovy_wishlist_item_variant" on "jovy_wishlist_item" ("wishlist_id", "product_variant_id") where "deleted_at" is null;`)
    this.addSql(`create table "jovy_customer_notice" ("id" text primary key, "customer_id" text not null, "order_id" text not null, "event_key" text not null, "kind" text not null check ("kind" in ('order_placed', 'order_canceled')), "read_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null);`)
    this.addSql(`create index "IDX_jovy_customer_notice_customer" on "jovy_customer_notice" ("customer_id", "created_at") where "deleted_at" is null;`)
    this.addSql(`create unique index "IDX_jovy_customer_notice_event" on "jovy_customer_notice" ("event_key") where "deleted_at" is null;`)
    this.addSql(`create table "jovy_communication_preference" ("id" text primary key, "customer_id" text not null, "marketing_email" boolean not null default false, "consent_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_communication_preference_consent" check ("marketing_email" = ("consent_at" is not null)));`)
    this.addSql(`create unique index "IDX_jovy_communication_preference_customer" on "jovy_communication_preference" ("customer_id") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table "jovy_communication_preference";`)
    this.addSql(`drop table "jovy_customer_notice";`)
    this.addSql(`drop table "jovy_wishlist_item";`)
    this.addSql(`drop table "jovy_wishlist";`)
  }
}
