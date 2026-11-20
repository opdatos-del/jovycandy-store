import { useCallback, useEffect, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { accessApi } from "../api"
import type { AccessAudit, AccessCatalog, AccessRole, AccessUser, Policy } from "../types"

/**
 * Estado de la pantalla de accesos. Solo un actor con `jovy_access:read` llega
 * aquí: el middleware responde 403 antes de ejecutar el handler.
 */
export function useAccess() {
  const [catalog, setCatalog] = useState<AccessCatalog | null>(null)
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [users, setUsers] = useState<AccessUser[]>([])
  const [audit, setAudit] = useState<AccessAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [catalogResult, rolesResult, usersResult, auditResult] = await Promise.all([
        accessApi.catalog(),
        accessApi.roles(),
        accessApi.users(),
        accessApi.audit(),
      ])
      setCatalog(catalogResult)
      setRoles(rolesResult.roles)
      setUsers(usersResult.users)
      setAudit(auditResult.audit_logs)
      setError(null)
    } catch (reason) {
      setError(errorMessage(reason, "No se pudieron cargar los accesos."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const savePolicies = async (role: AccessRole, policies: Policy[]) => {
    setSaving(true)
    setError(null)
    try {
      const result = await accessApi.updateRolePolicies(role.id, policies)
      setRoles((current) => current.map((item) => (item.id === role.id ? result.role : item)))
      setNotice(`Permisos de ${role.name} guardados.`)
    } catch (reason) {
      setError(errorMessage(reason, "No se pudieron guardar los permisos."))
    } finally {
      setSaving(false)
    }
  }

  const createRole = async (input: {
    code: string
    name: string
    description: string
    policies: Policy[]
  }) => {
    setSaving(true)
    setError(null)
    try {
      const result = await accessApi.createRole(input)
      setRoles((current) => [...current, result.role])
      setNotice(`Rol ${result.role.name} creado.`)
      return result.role
    } catch (reason) {
      setError(errorMessage(reason, "No se pudo crear el rol."))
      return null
    } finally {
      setSaving(false)
    }
  }

  const deleteRole = async (role: AccessRole) => {
    setSaving(true)
    setError(null)
    try {
      await accessApi.deleteRole(role.id)
      setRoles((current) => current.filter((item) => item.id !== role.id))
      setNotice(`Rol ${role.name} eliminado.`)
    } catch (reason) {
      setError(errorMessage(reason, "No se pudo eliminar el rol."))
    } finally {
      setSaving(false)
    }
  }

  const saveUserRoles = async (user: AccessUser, roleCodes: string[]) => {
    setSaving(true)
    setError(null)
    try {
      const roleIds = roles.filter((role) => roleCodes.includes(role.code)).map((role) => role.id)
      const result = await accessApi.saveUser(user.id, roleIds)
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, roles: result.roles.sort() } : item,
        ),
      )
      setNotice(`Accesos de ${user.email} guardados.`)
    } catch (reason) {
      setError(errorMessage(reason, "No se pudieron guardar los accesos del usuario."))
    } finally {
      setSaving(false)
    }
  }

  return {
    catalog,
    roles,
    users,
    audit,
    loading,
    saving,
    error,
    notice,
    reload: load,
    savePolicies,
    createRole,
    deleteRole,
    saveUserRoles,
  }
}
