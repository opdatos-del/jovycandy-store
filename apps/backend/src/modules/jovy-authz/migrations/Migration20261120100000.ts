import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Persistencia de roles, políticas y asignaciones sobre la identidad nativa de
 * Medusa. No crea usuarios ni credenciales: solo referencia `user.id`.
 */
export class Migration20261120100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table if not exists "jovy_authz_role" ("id" text not null, "code" text not null, "name" text not null, "description" text null, "is_system" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_authz_role_pkey" primary key ("id"));',
    )
    this.addSql(
      'create unique index if not exists "IDX_jovy_authz_role_code_unique" on "jovy_authz_role" ("code") where deleted_at is null;',
    )

    this.addSql(
      'create table if not exists "jovy_authz_policy" ("id" text not null, "role_id" text not null, "resource" text not null, "operation" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_authz_policy_pkey" primary key ("id"));',
    )
    this.addSql(
      'create unique index if not exists "IDX_jovy_authz_policy_unique" on "jovy_authz_policy" ("role_id", "resource", "operation") where deleted_at is null;',
    )
    this.addSql(
      'create index if not exists "IDX_jovy_authz_policy_resource" on "jovy_authz_policy" ("resource", "operation") where deleted_at is null;',
    )

    this.addSql(
      'create table if not exists "jovy_authz_assignment" ("id" text not null, "user_id" text not null, "role_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_authz_assignment_pkey" primary key ("id"));',
    )
    this.addSql(
      'create unique index if not exists "IDX_jovy_authz_assignment_unique" on "jovy_authz_assignment" ("user_id", "role_id") where deleted_at is null;',
    )
    this.addSql(
      'create index if not exists "IDX_jovy_authz_assignment_role" on "jovy_authz_assignment" ("role_id") where deleted_at is null;',
    )

    this.addSql(
      'create table if not exists "jovy_authz_user_policy" ("id" text not null, "user_id" text not null, "resource" text not null, "operation" text not null, "effect" text check ("effect" in (\'allow\', \'deny\')) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_authz_user_policy_pkey" primary key ("id"));',
    )
    this.addSql(
      'create unique index if not exists "IDX_jovy_authz_user_policy_unique" on "jovy_authz_user_policy" ("user_id", "resource", "operation") where deleted_at is null;',
    )
    this.addSql(
      'create index if not exists "IDX_jovy_authz_user_policy_user" on "jovy_authz_user_policy" ("user_id", "effect") where deleted_at is null;',
    )
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "jovy_authz_user_policy" cascade;')
    this.addSql('drop table if exists "jovy_authz_assignment" cascade;')
    this.addSql('drop table if exists "jovy_authz_policy" cascade;')
    this.addSql('drop table if exists "jovy_authz_role" cascade;')
  }
}
