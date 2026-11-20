import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261120110000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table if not exists "jovy_authz_audit_log" ("id" text not null, "actor_id" text null, "action" text check ("action" in (\'role_create\', \'role_update\', \'role_delete\', \'policies_replace\', \'user_access_replace\', \'bootstrap\')) not null, "target_type" text not null, "target_id" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_authz_audit_log_pkey" primary key ("id"));',
    )
    this.addSql(
      'create index if not exists "IDX_jovy_authz_audit_created" on "jovy_authz_audit_log" ("created_at") where deleted_at is null;',
    )
    this.addSql(
      'create index if not exists "IDX_jovy_authz_audit_actor" on "jovy_authz_audit_log" ("actor_id", "created_at") where deleted_at is null;',
    )
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "jovy_authz_audit_log" cascade;')
  }
}
