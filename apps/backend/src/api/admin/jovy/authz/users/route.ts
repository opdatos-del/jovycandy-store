import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { authzError, authzService } from "@jovy/lib/jovy/authz/http"

type UserRecord = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service = authzService(req)
    const userModule = req.scope.resolve(Modules.USER)
    const [users, assignments, roles] = await Promise.all([
      userModule.listUsers({}, { take: 500, order: { created_at: "DESC" } }) as Promise<UserRecord[]>,
      service.listJovyAuthzAssignments({}),
      service.listJovyAuthzRoles({}),
    ])
    const roleCode = new Map(roles.map((role) => [role.id, role.code]))
    const rolesByUser = new Map<string, string[]>()
    for (const assignment of assignments) {
      const code = roleCode.get(assignment.role_id)
      if (!code) continue
      const list = rolesByUser.get(assignment.user_id) ?? []
      list.push(code)
      rolesByUser.set(assignment.user_id, list)
    }
    res.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        roles: (rolesByUser.get(user.id) ?? []).sort(),
      })),
    })
  } catch (error) {
    authzError(res, error)
  }
}
