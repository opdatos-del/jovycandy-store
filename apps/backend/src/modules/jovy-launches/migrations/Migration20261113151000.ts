import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261113151000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "jovy_launch" ("id" text not null, "product_id" text null, "title" text not null, "description" text null, "image_file_id" text null, "image_url" text null, "sort_order" integer not null default 0, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_launch_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "IDX_jovy_launch_active_sort_order" on "jovy_launch" ("active", "sort_order") where deleted_at is null;`)

    this.addSql(`create table if not exists "jovy_launch_settings" ("id" text not null, "background_color" text not null default '#00AFAA', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_launch_settings_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "IDX_jovy_launch_settings_deleted_at" on "jovy_launch_settings" ("deleted_at") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "jovy_launch_settings" cascade;`)
    this.addSql(`drop table if exists "jovy_launch" cascade;`)
  }
}
