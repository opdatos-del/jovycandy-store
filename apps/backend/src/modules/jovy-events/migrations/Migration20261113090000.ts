import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261113090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "jovy_event_type" ("id" text not null, "code" text not null, "name" text not null, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_event_type_pkey" primary key ("id"));`)
    this.addSql(`create unique index if not exists "IDX_jovy_event_type_code_unique" on "jovy_event_type" ("code") where deleted_at is null;`)
    this.addSql(`create table if not exists "jovy_event" ("id" text not null, "event_type_id" text null, "title" text not null, "slug" text not null, "description" text null, "content" text null, "media_file_id" text null, "starts_at" timestamptz null, "ends_at" timestamptz null, "status" text check ("status" in ('draft', 'published', 'archived', 'cancelled')) not null default 'draft', "enabled" boolean not null default true, "priority" integer not null default 0, "sort_order" integer not null default 0, "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_event_pkey" primary key ("id"));`)
    this.addSql(`create unique index if not exists "IDX_jovy_event_slug_unique" on "jovy_event" ("slug") where deleted_at is null;`)
    this.addSql(`create index if not exists "IDX_jovy_event_visibility" on "jovy_event" ("status", "enabled", "starts_at", "ends_at", "priority", "sort_order") where deleted_at is null;`)
    this.addSql(`create table if not exists "jovy_event_audit_log" ("id" text not null, "actor_id" text null, "entity_id" text not null, "action" text check ("action" in ('create', 'update', 'publish', 'unpublish', 'archive', 'delete', 'reorder')) not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_event_audit_log_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "IDX_jovy_event_audit_log_entity_created" on "jovy_event_audit_log" ("entity_id", "created_at") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "jovy_event_audit_log" cascade;`)
    this.addSql(`drop table if exists "jovy_event" cascade;`)
    this.addSql(`drop table if exists "jovy_event_type" cascade;`)
  }
}
