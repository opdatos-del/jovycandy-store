import { useCallback, useEffect, useState } from "react"
import { adminRequest, errorMessage } from "../lib/admin-api"

export type JovyPermissions = {
  user_id: string | null
  roles: string[]
  permissions: string[]
  wildcard: boolean
  contact_resources: Record<string, string>
}

const EMPTY: JovyPermissions = {
  user_id: null,
  roles: [],
  permissions: [],
  wildcard: false,
  contact_resources: {},
}

let cached: Promise<JovyPermissions> | null = null

function loadPermissions() {
  if (!cached) {
    cached = adminRequest<JovyPermissions & { user?: { id: string } }>("/admin/jovy/authz/me")
      .then((value) => ({
        user_id: value.user?.id ?? null,
        roles: value.roles ?? [],
        permissions: value.permissions ?? [],
        wildcard: Boolean(value.wildcard),
        contact_resources: value.contact_resources ?? {},
      }))
      .catch(() => EMPTY)
  }
  return cached
}

export function invalidateJovyPermissions() {
  cached = null
}

/**
 * Permisos efectivos del usuario para la UI. Solo decide qué controles mostrar:
 * el backend vuelve a validar cada petición. Si `/me` falla, la UI cae en modo
 * sin permisos en lugar de asumir acceso.
 */
export function useJovyPermissions() {
  const [state, setState] = useState<JovyPermissions>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    invalidateJovyPermissions()
    setLoading(true)
    try {
      setState(await loadPermissions())
      setError(null)
    } catch (reason) {
      setError(errorMessage(reason, "No se pudieron cargar los permisos."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    loadPermissions().then((value) => {
      if (!active) return
      setState(value)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const can = useCallback(
    (resource: string, operation: string) => {
      if (state.wildcard) return true
      const key = `${resource}:${operation}`
      return (
        state.permissions.includes(key) ||
        state.permissions.includes(`${resource}:*`) ||
        state.permissions.includes(`*:${operation}`)
      )
    },
    [state],
  )

  const canContact = useCallback(
    (contactType: string, operation: string) => {
      const resource = state.contact_resources[contactType]
      return resource ? can(resource, operation) : false
    },
    [can, state.contact_resources],
  )

  return { ...state, loading, error, can, canContact, refresh }
}
