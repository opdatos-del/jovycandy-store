import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261113130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('create table if not exists "jovy_contact_request" ("id" text not null, "first_name" text not null, "last_name" text null, "email" text not null, "phone" text null, "country" text null, "city" text null, "postal_code" text null, "contact_type" text check ("contact_type" in (\'national-sales\', \'international-sales\', \'customer-service\', \'catalogue\')) not null, "message" text not null, "status" text check ("status" in (\'pending\', \'handled\')) not null default \'pending\', "handled_at" timestamptz null, "handled_by" text null, "admin_notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_contact_request_pkey" primary key ("id"));')
    this.addSql('create index if not exists "IDX_jovy_contact_request_status_type_created" on "jovy_contact_request" ("status", "contact_type", "created_at") where deleted_at is null;')
    this.addSql('create table if not exists "jovy_contact_audit_log" ("id" text not null, "actor_id" text null, "contact_request_id" text not null, "action" text check ("action" in (\'create\', \'status\', \'note\', \'delete\')) not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovy_contact_audit_log_pkey" primary key ("id"));')
    this.addSql('create index if not exists "IDX_jovy_contact_audit_request_created" on "jovy_contact_audit_log" ("contact_request_id", "created_at") where deleted_at is null;')
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "jovy_contact_audit_log" cascade;')
    this.addSql('drop table if exists "jovy_contact_request" cascade;')
  }
}
