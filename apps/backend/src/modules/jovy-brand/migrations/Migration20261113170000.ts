import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Higiene de la relación logo ↔ familia.
 *
 * `jovy_brand_logo_family` no declara FK al logo (los módulos de Medusa no las
 * usan entre sí) y el borrado de logos no retiraba sus vínculos, así que pueden
 * existir filas que apuntan a logos ausentes o borrados lógicamente. El
 * workflow ya limpia al borrar; esta migración retira lo acumulado.
 *
 * No elimina vínculos a familias borradas lógicamente: la familia puede
 * restaurarse y el vínculo conserva la intención editorial. El filtro Store y
 * las etiquetas Admin resuelven solo familias vigentes.
 */
export class Migration20261113170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`delete from "jovy_brand_logo_family" lf where not exists (select 1 from "jovy_brand_logo" l where l."id" = lf."logo_id" and l."deleted_at" is null);`)
  }

  override async down(): Promise<void> {
    // Limpieza de datos irreversible: no se recrean vínculos huérfanos.
  }
}
