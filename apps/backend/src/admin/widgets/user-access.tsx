import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { accessApi } from "@admin/features/access/api"
import type { AccessRole } from "@admin/features/access/types"
import { useJovyPermissions } from "@admin/shared/hooks/use-jovy-permissions"

type AdminUser = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
}

type WidgetProps = { data: AdminUser }

/**
 * Asignación de roles Jovy dentro del detalle nativo de Usuarios de Medusa.
 * La identidad, la contraseña y la invitación siguen siendo nativas; este panel
 * solo conecta la cuenta con los roles persistentes de `jovy-authz`.
 */
const UserAccessWidget = ({ data }: WidgetProps) => {
  const permissions = useJovyPermissions()
  const canRead = permissions.can("jovy_access", "read")
  const canManage = permissions.can("jovy_access", "manage_settings")
  const isSelf = permissions.user_id === data.id

  const [roles, setRoles] = useState<AccessRole[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!canRead) {
      setLoading(false)
      return
    }
    let active = true
    Promise.all([accessApi.roles(), accessApi.userAccess(data.id)])
      .then(([roleResult, access]) => {
        if (!active) return
        setRoles(roleResult.roles)
        setSelected(new Set(access.roles))
        setError(null)
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar los accesos de este usuario.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [canRead, data.id])

  if (permissions.loading || !canRead) return null

  const save = async () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const roleIds = roles.filter((role) => selected.has(role.code)).map((role) => role.id)
      const result = await accessApi.saveUser(data.id, roleIds)
      setSelected(new Set(result.roles))
      setNotice("Accesos guardados.")
    } catch {
      setError("No se pudieron guardar los accesos.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="p-4 sm:p-6" data-testid="jovy-user-access-widget">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading level="h2" className="text-base">
            Accesos Jovy
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Roles del CMS y de contactos para {data.email}. La cuenta, la contraseña y la
            invitación siguen siendo nativas de Medusa.
          </Text>
        </div>
        <Badge color={selected.size ? "blue" : "grey"}>
          {selected.size ? `${selected.size} roles` : "Sin roles"}
        </Badge>
      </div>

      {loading ? (
        <Text role="status" size="small" className="text-ui-fg-subtle mt-4">
          Cargando roles…
        </Text>
      ) : (
        <>
          {error && (
            <p role="alert" className="text-ui-fg-error mt-3 text-sm">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-ui-fg-subtle mt-3 text-sm">
              {notice}
            </p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.has(role.code)}
                  disabled={!canManage || isSelf || saving}
                  onChange={() =>
                    setSelected((current) => {
                      const next = new Set(current)
                      if (next.has(role.code)) next.delete(role.code)
                      else next.add(role.code)
                      return next
                    })
                  }
                />
                <span>
                  <span className="text-ui-fg-base block">{role.name}</span>
                  <span className="text-ui-fg-subtle text-xs">{role.code}</span>
                </span>
              </label>
            ))}
          </div>
          {isSelf && (
            <Text size="small" role="status" className="text-ui-fg-subtle mt-3">
              No puedes modificar tus propios accesos.
            </Text>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canManage && !isSelf && (
              <Button type="button" size="small" isLoading={saving} onClick={() => void save()}>
                Guardar accesos
              </Button>
            )}
            <a
              href="/app/settings/access"
              className="text-ui-fg-interactive text-sm underline"
            >
              Administrar roles y permisos
            </a>
          </div>
        </>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "user.details" })

export default UserAccessWidget
