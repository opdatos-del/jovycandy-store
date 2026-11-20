import { Badge, Button, Container, Heading, Input, Text, usePrompt } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import type { AccessRole, AccessUser } from "../types"

type Props = {
  users: AccessUser[]
  roles: AccessRole[]
  currentUserId: string | null
  saving: boolean
  canManage: boolean
  onSave: (user: AccessUser, roleCodes: string[]) => Promise<void>
}

/** Asignación de varios roles a un usuario nativo de Medusa. */
export function UsersPanel({ users, roles, currentUserId, saving, canManage, onSave }: Props) {
  const prompt = usePrompt()
  const [selected, setSelected] = useState<AccessUser | null>(null)
  const [codes, setCodes] = useState<Set<string>>(new Set())
  const [initial, setInitial] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")

  useEffect(() => {
    const next = new Set(selected?.roles ?? [])
    setCodes(new Set(next))
    setInitial(new Set(next))
  }, [selected])

  const rolesByCode = useMemo(() => new Map(roles.map((role) => [role.code, role])), [roles])
  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return users
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(normalized) ||
        `${user.first_name ?? ""} ${user.last_name ?? ""}`.toLowerCase().includes(normalized),
    )
  }, [query, users])

  const selectedRoles = [...codes]
    .map((code) => rolesByCode.get(code))
    .filter((role): role is AccessRole => Boolean(role))
  const permissionCount = selectedRoles.some((role) => role.code === "superadmin")
    ? "todos"
    : new Set(selectedRoles.flatMap((role) => role.policies.map((policy) => `${policy.resource}:${policy.operation}`)))
        .size
  const dirty =
    !!selected &&
    (codes.size !== initial.size || [...codes].some((code) => !initial.has(code)))

  const removeCode = (code: string) => {
    setCodes((current) => {
      const next = new Set(current)
      next.delete(code)
      return next
    })
  }

  const save = async () => {
    if (!selected) return
    if (codes.size === 0 && selected.roles.length > 0) {
      const confirmed = await prompt({
        title: "Dejar usuario sin roles",
        description:
          "Sin roles no podrá acceder a ninguna pantalla del Admin. ¿Deseas continuar?",
        confirmText: "Quitar todos los roles",
        cancelText: "Cancelar",
        variant: "danger",
      })
      if (!confirmed) return
    }
    await onSave(selected, [...codes])
    setSelected(null)
  }

  return (
    <Container className="p-0" data-testid="access-users">
      <div className="border-ui-border-base border-b p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Heading level="h2" className="text-base">
              Usuarios
            </Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Los permisos efectivos son la unión de roles. Nadie puede modificar sus propios
              accesos.
            </Text>
          </div>
          <Input
            className="w-full sm:w-72"
            aria-label="Buscar usuarios"
            placeholder="Buscar por correo o nombre"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" aria-label="Usuarios y roles">
          <thead className="text-ui-fg-subtle border-ui-border-base border-b">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium sm:px-6">
                Usuario
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Roles
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium sm:px-6">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-ui-border-base divide-y">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center">
                  <Text size="small" role="status" className="text-ui-fg-subtle">
                    No hay usuarios que coincidan.
                  </Text>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isSelf = user.id === currentUserId
                return (
                  <tr
                    key={user.id}
                    className={selected?.id === user.id ? "bg-ui-bg-highlight/60" : undefined}
                  >
                    <td className="px-4 py-3 sm:px-6">
                      <p className="text-ui-fg-base font-medium break-all">{user.email}</p>
                      <p className="text-ui-fg-subtle text-xs">
                        {[user.first_name, user.last_name].filter(Boolean).join(" ") || "Sin nombre"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length ? (
                          user.roles.map((code) => (
                            <Badge key={code} size="xsmall" color="blue">
                              {rolesByCode.get(code)?.name ?? code}
                            </Badge>
                          ))
                        ) : (
                          <Badge size="xsmall" color="grey">
                            Sin roles
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <Button
                        type="button"
                        size="small"
                        variant={selected?.id === user.id ? "primary" : "secondary"}
                        disabled={isSelf || !canManage}
                        title={
                          isSelf
                            ? "No puedes modificar tus propios accesos."
                            : !canManage
                              ? "Tu usuario no puede modificar accesos."
                              : undefined
                        }
                        onClick={() => setSelected(user)}
                      >
                        {selected?.id === user.id ? "Editando" : "Editar roles"}
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="border-ui-border-base border-t p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Heading level="h3" className="text-sm">
                Roles de {selected.email}
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                {codes.size
                  ? `${codes.size} roles · ${permissionCount === "todos" ? "acceso global" : `${permissionCount} permisos por roles`}`
                  : "Sin roles: el usuario no podrá abrir ninguna pantalla"}
              </Text>
            </div>
            <Button type="button" size="small" variant="secondary" onClick={() => setSelected(null)}>
              Cerrar
            </Button>
          </div>

          {!canManage && (
            <Text size="small" role="status" className="text-ui-fg-subtle mt-3">
              Solo lectura: puedes consultar asignaciones, pero no modificarlas.
            </Text>
          )}
          {canManage && selectedRoles.length > 0 && (
            <div className="mt-3">
              <Text size="xsmall" className="text-ui-fg-subtle mb-2">
                Asignados actualmente
              </Text>
              <div className="flex flex-wrap gap-2">
                {selectedRoles.map((role) => (
                  <span
                    key={role.code}
                    className="border-ui-border-base bg-ui-bg-subtle inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                  >
                    {role.name}
                    <button
                      type="button"
                      aria-label={`Quitar rol ${role.name}`}
                      className="text-ui-fg-muted hover:text-ui-fg-error focus-visible:outline-none"
                      onClick={() => removeCode(role.code)}
                      disabled={saving}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <Button
                  type="button"
                  size="small"
                  variant="transparent"
                  onClick={() => setCodes(new Set())}
                  disabled={saving}
                >
                  Quitar todos
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => {
              const checked = codes.has(role.code)
              return (
                <label
                  key={role.id}
                  className={[
                    "flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm transition-colors",
                    checked
                      ? "border-ui-border-interactive bg-ui-bg-highlight"
                      : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-subtle",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    disabled={saving || !canManage}
                    onChange={() =>
                      setCodes((current) => {
                        const next = new Set(current)
                        if (next.has(role.code)) next.delete(role.code)
                        else next.add(role.code)
                        return next
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="text-ui-fg-base block font-medium">{role.name}</span>
                    <span className="text-ui-fg-subtle block font-mono text-xs">{role.code}</span>
                    <span className="text-ui-fg-muted mt-0.5 block text-xs">
                      {role.policies.length} permisos
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Text size="xsmall" className="text-ui-fg-subtle">
              {!canManage ? "Solo lectura." : dirty ? "Hay cambios sin guardar." : "Sin cambios."}
            </Text>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => {
                  setCodes(new Set(initial))
                  setSelected(null)
                }}
                disabled={saving}
              >
                {canManage ? "Cancelar" : "Cerrar"}
              </Button>
              {canManage && (
                <Button
                  type="button"
                  size="small"
                  isLoading={saving}
                  disabled={!dirty}
                  onClick={() => void save()}
                >
                  Guardar accesos
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}
