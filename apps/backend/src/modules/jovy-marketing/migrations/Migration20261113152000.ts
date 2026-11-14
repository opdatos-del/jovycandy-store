import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261113152000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "jovy_announcement_settings" ("id" text not null, "corporate_message_es" text null, "corporate_message_en" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_announcement_settings_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "IDX_jovy_announcement_settings_deleted_at" on "jovy_announcement_settings" ("deleted_at") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "jovy_announcement_settings" cascade;`)
  }
}
