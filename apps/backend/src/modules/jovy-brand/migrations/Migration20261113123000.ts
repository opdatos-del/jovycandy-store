import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Adds optional UTC publication windows without changing existing gallery records. */
export class Migration20261113123000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table if exists "jovy_gallery_item" add column if not exists "starts_at" timestamptz null;')
    this.addSql('alter table if exists "jovy_gallery_item" add column if not exists "ends_at" timestamptz null;')
    this.addSql('create index if not exists "IDX_jovy_gallery_item_schedule" on "jovy_gallery_item" ("status", "enabled", "starts_at", "ends_at", "sort_order") where deleted_at is null;')
  }

  override async down(): Promise<void> {
    this.addSql('drop index if exists "IDX_jovy_gallery_item_schedule";')
    this.addSql('alter table if exists "jovy_gallery_item" drop column if exists "ends_at";')
    this.addSql('alter table if exists "jovy_gallery_item" drop column if exists "starts_at";')
  }
}
