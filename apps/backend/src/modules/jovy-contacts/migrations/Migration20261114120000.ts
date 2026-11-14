import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Adds the `restore` and `update` audit actions. The original check constraint
 * was created inline and unnamed, so PostgreSQL named it
 * `jovy_contact_audit_log_action_check`; it is replaced, never rewritten in the
 * already-applied migration.
 */
export class Migration20261114120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "jovy_contact_audit_log" drop constraint if exists "jovy_contact_audit_log_action_check";')
    this.addSql(
      'alter table "jovy_contact_audit_log" add constraint "jovy_contact_audit_log_action_check" check ("action" in (\'create\', \'status\', \'note\', \'delete\', \'restore\', \'update\'));',
    )
  }

  override async down(): Promise<void> {
    this.addSql('alter table "jovy_contact_audit_log" drop constraint if exists "jovy_contact_audit_log_action_check";')
    this.addSql(
      'alter table "jovy_contact_audit_log" add constraint "jovy_contact_audit_log_action_check" check ("action" in (\'create\', \'status\', \'note\', \'delete\'));',
    )
  }
}
