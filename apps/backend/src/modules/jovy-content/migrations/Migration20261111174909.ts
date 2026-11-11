import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261111174909 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "jovy_editorial_page" drop constraint if exists "jovy_editorial_page_slug_unique";`);
    this.addSql(`create table if not exists "jovy_audit_log" ("id" text not null, "actor_id" text null, "entity_type" text not null, "entity_id" text not null, "action" text check ("action" in ('create', 'update', 'publish', 'archive', 'delete')) not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_audit_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_audit_log_deleted_at" ON "jovy_audit_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_audit_log_entity_type_entity_id_created_at" ON "jovy_audit_log" ("entity_type", "entity_id", "created_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "jovy_editorial_page" ("id" text not null, "slug" text not null, "status" text check ("status" in ('draft', 'published', 'archived')) not null default 'draft', "translations" jsonb not null, "seo" jsonb null, "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_editorial_page_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_editorial_page_deleted_at" ON "jovy_editorial_page" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_jovy_editorial_page_slug_unique" ON "jovy_editorial_page" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovy_editorial_page_status_published_at" ON "jovy_editorial_page" ("status", "published_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "jovy_audit_log" cascade;`);

    this.addSql(`drop table if exists "jovy_editorial_page" cascade;`);
  }

}
