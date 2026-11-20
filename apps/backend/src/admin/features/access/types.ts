export type Policy = { resource: string; operation: string }

export type AccessRole = {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
  policies: Policy[]
}

export type AccessCatalog = {
  resources: Array<{
    key: string
    label: string
    description: string
    operations: string[]
  }>
  operations: Array<{ key: string; label: string }>
  contact_types: Record<string, string>
  limitations: string[]
}

export type AccessUser = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  roles: string[]
}

export type UserAccess = {
  user: { id: string; email: string; first_name: string | null; last_name: string | null }
  role_ids: string[]
  roles: string[]
  policies: Array<Policy & { effect: "allow" | "deny" }>
}

export type AccessAudit = {
  id: string
  actor_id: string | null
  action: string
  target_type: string
  target_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}
