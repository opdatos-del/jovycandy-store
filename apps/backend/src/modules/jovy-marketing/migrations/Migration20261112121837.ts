import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261112121837 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "jovy_hero_item" ("id" text not null, "translations" jsonb not null, "status" text check ("status" in ('draft', 'published', 'archived')) not null default 'draft', "enabled" boolean not null default true, "sort_order" integer not null default 0, "background_color" text null, "media_file_id" text null, "cta_url" text null, "starts_at" timestamptz null, "ends_at" timestamptz null, "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_hero_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_hero_item_deleted_at" ON "jovy_hero_item" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_hero_item_status_enabled_starts_at_ends_at_sort_order" ON "jovy_hero_item" ("status", "enabled", "starts_at", "ends_at", "sort_order") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "jovy_hero_settings" ("id" text not null, "background_color" text not null default '#00AFAA', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_hero_settings_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_hero_settings_deleted_at" ON "jovy_hero_settings" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "jovy_marketing_audit_log" ("id" text not null, "actor_id" text null, "entity_type" text check ("entity_type" in ('hero_item', 'hero_settings', 'marketing_banner')) not null, "entity_id" text not null, "action" text check ("action" in ('create', 'update', 'publish', 'unpublish', 'archive', 'delete', 'reorder')) not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_marketing_audit_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_marketing_audit_log_deleted_at" ON "jovy_marketing_audit_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_marketing_audit_log_entity_type_entity_id_created_at" ON "jovy_marketing_audit_log" ("entity_type", "entity_id", "created_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "jovy_marketing_banner" ("id" text not null, "slot" text check ("slot" in ('promo', 'hint')) not null, "translations" jsonb not null, "status" text check ("status" in ('draft', 'published', 'archived')) not null default 'draft', "enabled" boolean not null default true, "auto_open" boolean not null default false, "frequency" text check ("frequency" in ('every', 'session', 'daily')) not null default 'every', "priority" integer not null default 0, "sort_order" integer not null default 0, "media_file_id" text null, "cta_url" text null, "starts_at" timestamptz null, "ends_at" timestamptz null, "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_marketing_banner_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_marketing_banner_deleted_at" ON "jovy_marketing_banner" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_marketing_banner_slot_status_enabled_priority_sort_order_starts_at_ends_at" ON "jovy_marketing_banner" ("slot", "status", "enabled", "priority", "sort_order", "starts_at", "ends_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "jovy_hero_item" cascade;`);

    this.addSql(`drop table if exists "jovy_hero_settings" cascade;`);

    this.addSql(`drop table if exists "jovy_marketing_audit_log" cascade;`);

    this.addSql(`drop table if exists "jovy_marketing_banner" cascade;`);
  }

}
