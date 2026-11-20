import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useJovyPermissions } from "@admin/shared/hooks/use-jovy-permissions"
import { useAccess } from "../hooks/use-access"
import type { AccessRole } from "../types"
import { RoleCreate } from "./role-create"
import { RoleEditor } from "./role-editor"
import { RoleList } from "./role-list"
import { UsersPanel } from "./users-panel"

const AUDIT_LABELS: Record<string, string> = {
  role_create: "Rol creado",
  role_update: "Rol actualizado",
  role_delete: "Rol eliminado",
  policies_replace: "Permisos modificados",
  user_access_replace: "Roles de usuario modificados",
  bootstrap: "Bootstrap de superadministrador",
}

function AccessDenied() {
  return (
    <Container className="p-6" data-testid="access-denied">
      <Heading level="h1">Acceso denegado</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Tu usuario no tiene el permiso <code>jovy_access:read</code>. Solicita acceso a un
        administrador.
      </Text>
    </Container>
  )
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="border-ui-border-base bg-ui-bg-base rounded-md border p-3">
      <Text size="xsmall" className="text-ui-fg-subtle uppercase">
        {label}
      </Text>
      <Text size="large" weight="plus" className="block tabular-nums">
        {value}
      </Text>
      <Text size="xsmall" className="text-ui-fg-muted">
        {detail}
      </Text>
    </div>
  )
}

function AccessManager() {
  const access = useAccess()
  const permissions = useJovyPermissions()
  const canManage = permissions.can("jovy_access", "manage_settings")
  const [selected, setSelected] = useState<AccessRole | null>(null)
  const [roleQuery, setRoleQuery] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!selected && access.roles.length) {
      setSelected(access.roles.find((role) => role.code === "cms_viewer") ?? access.roles[0])
    }
    if (selected) {
      const current = access.roles.find((role) => role.id === selected.id)
      if (current && current !== selected) setSelected(current)
    }
  }, [access.roles, selected])

  if (access.loading) {
    return (
      <Container className="p-6">
        <Text role="status" className="text-ui-fg-subtle">
          Cargando roles y usuarios…
        </Text>
      </Container>
    )
  }

  const usersWithoutRoles = access.users.filter((user) => user.roles.length === 0).length

  return (
    <div className="flex flex-col gap-y-4" data-testid="access-page">
      <Container className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h1">Accesos y permisos</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Roles persistentes sobre usuarios nativos. El servidor deniega por defecto.
            </Text>
          </div>
          {!canManage && (
            <Badge color="grey">Solo lectura: no puedes modificar roles ni asignaciones</Badge>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Roles" value={access.roles.length} detail="Disponibles" />
          <Stat label="Usuarios" value={access.users.length} detail="Cuentas nativas" />
          <Stat label="Sin roles" value={usersWithoutRoles} detail="Sin acceso al Admin" />
          <Stat label="Cambios" value={access.audit.length} detail="En la auditoría reciente" />
        </div>

        {access.error && (
          <p role="alert" className="text-ui-fg-error mt-4 text-sm">
            {access.error}
          </p>
        )}
        {access.notice && (
          <p role="status" className="text-ui-fg-success mt-4 text-sm">
            {access.notice}
          </p>
        )}

        <Text size="small" className="text-ui-fg-subtle mt-4">
          La asignación por persona está en{" "}
          <a href="/app/settings/users" className="text-ui-fg-interactive underline">
            Settings → Users
          </a>
          . La matriz de este catálogo no cambia la identidad ni la contraseña.
        </Text>
        <details className="mt-2">
          <summary className="text-ui-fg-subtle cursor-pointer text-xs">
            Limitaciones del mecanismo
          </summary>
          <ul className="text-ui-fg-subtle mt-2 list-disc space-y-1 pl-5 text-xs">
            {(access.catalog?.limitations ?? []).map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </details>
      </Container>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-4">
          <RoleList
            roles={access.roles}
            selectedId={selected?.id ?? null}
            query={roleQuery}
            onQueryChange={setRoleQuery}
            onSelect={setSelected}
            canCreate={canManage}
            onCreate={() => setCreating(true)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {creating && canManage && (
            <RoleCreate
              saving={access.saving}
              onCreate={async (input) => {
                const role = await access.createRole(input)
                if (role) {
                  setSelected(role)
                  setCreating(false)
                }
                return role
              }}
              onCancel={() => setCreating(false)}
            />
          )}

          <RoleEditor
            catalog={
              access.catalog ?? {
                resources: [],
                operations: [],
                contact_types: {},
                limitations: [],
              }
            }
            role={selected}
            saving={access.saving}
            canManage={canManage}
            onSave={async (role, policies) => {
              await access.savePolicies(role, policies)
            }}
            onDelete={async (role) => {
              await access.deleteRole(role)
              setSelected(null)
            }}
          />
        </div>
      </div>

      <UsersPanel
        users={access.users}
        roles={access.roles}
        currentUserId={permissions.user_id}
        saving={access.saving}
        canManage={canManage}
        onSave={access.saveUserRoles}
      />

      <Container className="p-0" data-testid="access-audit">
        <div className="border-ui-border-base border-b p-4 sm:p-6">
          <Heading level="h2" className="text-base">
            Auditoría reciente
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Últimos cambios de roles, políticas y asignaciones. Sin secretos ni datos personales.
          </Text>
        </div>
        {access.audit.length === 0 ? (
          <Text role="status" size="small" className="text-ui-fg-subtle p-4 sm:p-6">
            Sin cambios registrados.
          </Text>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Auditoría de accesos">
              <thead className="text-ui-fg-subtle border-ui-border-base border-b">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium sm:px-6">Fecha</th>
                  <th scope="col" className="px-3 py-2 font-medium">Acción</th>
                  <th scope="col" className="px-3 py-2 font-medium">Actor</th>
                  <th scope="col" className="px-4 py-2 font-medium sm:px-6">Objetivo</th>
                </tr>
              </thead>
              <tbody className="divide-ui-border-base divide-y">
                {access.audit.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 whitespace-nowrap sm:px-6">
                      {new Date(entry.created_at).toLocaleString("es-MX")}
                    </td>
                    <td className="px-3 py-2">
                      {AUDIT_LABELS[entry.action] ?? entry.action}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs break-all">
                      {entry.actor_id ?? "sistema"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs break-all sm:px-6">
                      {entry.target_type}:{entry.target_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </div>
  )
}

export function AccessPage() {
  const permissions = useJovyPermissions()

  if (permissions.loading) {
    return (
      <Container className="p-6">
        <Text role="status" className="text-ui-fg-subtle">
          Comprobando permisos…
        </Text>
      </Container>
    )
  }

  if (!permissions.can("jovy_access", "read")) {
    return <AccessDenied />
  }

  return <AccessManager />
}
