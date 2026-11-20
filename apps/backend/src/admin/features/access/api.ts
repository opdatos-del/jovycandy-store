import { adminRequest } from "@admin/shared/lib/admin-api"
import type {
  AccessAudit,
  AccessCatalog,
  AccessRole,
  AccessUser,
  Policy,
  UserAccess,
} from "./types"

export const accessApi = {
  catalog: () => adminRequest<AccessCatalog>("/admin/jovy/authz/catalog"),

  roles: () => adminRequest<{ roles: AccessRole[] }>("/admin/jovy/authz/roles"),

  createRole: (input: {
    code: string
    name: string
    description?: string | null
    policies: Policy[]
  }) =>
    adminRequest<{ role: AccessRole }>("/admin/jovy/authz/roles", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateRolePolicies: (id: string, policies: Policy[]) =>
    adminRequest<{ role: AccessRole }>(`/admin/jovy/authz/roles/${id}/policies`, {
      method: "PUT",
      body: JSON.stringify({ policies }),
    }),

  deleteRole: (id: string) =>
    adminRequest(`/admin/jovy/authz/roles/${id}`, { method: "DELETE" }),

  users: () => adminRequest<{ users: AccessUser[] }>("/admin/jovy/authz/users"),

  audit: () => adminRequest<{ audit_logs: AccessAudit[] }>("/admin/jovy/authz/audit"),

  userAccess: (id: string) =>
    adminRequest<UserAccess>(`/admin/jovy/authz/users/${id}`),

  saveUser: (id: string, roleIds: string[]) =>
    adminRequest<UserAccess>(`/admin/jovy/authz/users/${id}`, {
      method: "PUT",
      body: JSON.stringify({ role_ids: roleIds, policies: [] }),
    }),
}
