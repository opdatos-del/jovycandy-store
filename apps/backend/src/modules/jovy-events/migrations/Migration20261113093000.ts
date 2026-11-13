import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Eventos incorpora `title_en` como columna aditiva y nullable: los eventos
 * existentes siguen siendo válidos y el gate de publicación exige ambos
 * idiomas antes de exponer el evento en la Store API.
 */
export class Migration20261113093000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "jovy_event" add column if not exists "title_en" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "jovy_event" drop column if exists "title_en";`)
  }
}
