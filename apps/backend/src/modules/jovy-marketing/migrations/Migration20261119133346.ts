import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261119133346 extends Migration {

  override async up(): Promise<void> {
    // Migración aditiva: no reescribe filas existentes. En PostgreSQL 11+ el
    // `default` se registra en el catálogo sin reescribir la tabla.
    this.addSql(`alter table if exists "jovy_marketing_banner" add column if not exists "rotation_seconds" integer not null default 8;`);

    // El rango se valida en base de datos, no solo en Zod, para que ningún
    // camino de escritura (admin, scripts, importaciones) pueda saltárselo.
    this.addSql(`alter table if exists "jovy_marketing_banner" drop constraint if exists "jovy_marketing_banner_rotation_seconds_check";`);
    this.addSql(`alter table if exists "jovy_marketing_banner" add constraint "jovy_marketing_banner_rotation_seconds_check" check("rotation_seconds" >= 3 and "rotation_seconds" <= 60);`);

    // Se reemplaza el check autogenerado de `frequency` para admitir `once`.
    // Nombre real verificado en pg_constraint: jovy_marketing_banner_frequency_check.
    this.addSql(`alter table if exists "jovy_marketing_banner" drop constraint if exists "jovy_marketing_banner_frequency_check";`);
    this.addSql(`alter table if exists "jovy_marketing_banner" add constraint "jovy_marketing_banner_frequency_check" check("frequency" in ('every', 'session', 'daily', 'once'));`);
  }

  override async down(): Promise<void> {
    // Rollback solo de esta migración. Si existen banners con frequency 'once',
    // el check anterior fallará a propósito: normaliza esos valores antes de
    // revertir en lugar de perder información en silencio.
    this.addSql(`alter table if exists "jovy_marketing_banner" drop constraint if exists "jovy_marketing_banner_frequency_check";`);
    this.addSql(`alter table if exists "jovy_marketing_banner" add constraint "jovy_marketing_banner_frequency_check" check("frequency" in ('every', 'session', 'daily'));`);

    this.addSql(`alter table if exists "jovy_marketing_banner" drop constraint if exists "jovy_marketing_banner_rotation_seconds_check";`);
    this.addSql(`alter table if exists "jovy_marketing_banner" drop column if exists "rotation_seconds";`);
  }

}
