import { Badge, Button, Container, Heading, Input, Text } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import type { AccessCatalog, AccessRole, Policy } from "../types"

type Props = {
  catalog: AccessCatalog
  role: AccessRole | null
  saving: boolean
  canManage: boolean
  onSave: (role: AccessRole, policies: Policy[]) => Promise<void>
  onDelete: (role: AccessRole) => Promise<void>
}

const keyOf = (policy: Policy) => `${policy.resource}:${policy.operation}`

function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false
  for (const value of a) if (!b.has(value)) return false
  return true
}

/** Editor de la matriz recurso × operación con presets y estado de cambios. */
export function RoleEditor({ catalog, role, saving, canManage, onSave, onDelete }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [initial, setInitial] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")

  useEffect(() => {
    const next = new Set((role?.policies ?? []).map(keyOf))
    setSelected(next)
    setInitial(new Set(next))
    setQuery("")
  }, [role])

  const locked = role?.code === "superadmin"
  const editable = !locked && canManage
  const dirty = useMemo(() => !sameSet(selected, initial), [selected, initial])
  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return catalog.resources
    return catalog.resources.filter(
      (resource) =>
        resource.label.toLowerCase().includes(normalized) ||
        resource.key.toLowerCase().includes(normalized) ||
        resource.description.toLowerCase().includes(normalized),
    )
  }, [catalog.resources, query])

  if (!role) {
    return (
      <Container className="p-6" data-testid="access-role-editor">
        <Heading level="h2" className="text-base">
          Permisos del rol
        </Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          Selecciona un rol de la lista para revisar y ajustar sus permisos.
        </Text>
      </Container>
    )
  }

  const setResource = (resource: string, on: boolean) => {
    if (!editable) return
    const item = catalog.resources.find((entry) => entry.key === resource)
    if (!item) return
    setSelected((current) => {
      const next = new Set(current)
      for (const operation of item.operations) {
        const key = `${resource}:${operation}`
        if (on) next.add(key)
        else next.delete(key)
      }
      return next
    })
  }

  const applyPreset = (operations: string[] | "all") => {
    if (!editable) return
    setSelected(() => {
      const next = new Set<string>()
      for (const resource of catalog.resources) {
        for (const operation of resource.operations) {
          if (operations === "all" || operations.includes(operation)) {
            next.add(`${resource.key}:${operation}`)
          }
        }
      }
      return next
    })
  }

  const discard = () => setSelected(new Set(initial))
  const save = () =>
    void onSave(
      role,
      [...selected].map((key) => {
        const [resource, operation] = key.split(":")
        return { resource, operation }
      }),
    )

  return (
    <Container className="p-0" data-testid="access-role-editor">
      <div className="border-ui-border-base border-b p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Heading level="h2" className="text-base">
                {role.name}
              </Heading>
              <Badge color={role.is_system ? "grey" : "blue"}>
                {role.is_system ? "Sistema" : "Personalizado"}
              </Badge>
              {dirty && <Badge color="orange">Cambios sin guardar</Badge>}
            </div>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              {role.description || role.code}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted mt-1 font-mono">
              {role.code}
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!role.is_system && canManage && (
              <Button
                type="button"
                size="small"
                variant="danger"
                onClick={() => void onDelete(role)}
                disabled={saving}
              >
                Eliminar rol
              </Button>
            )}
            {dirty && editable && (
              <Button type="button" size="small" variant="secondary" onClick={discard} disabled={saving}>
                Descartar
              </Button>
            )}
            <Button
              type="button"
              size="small"
              onClick={save}
              isLoading={saving}
              disabled={!editable || !dirty}
            >
              Guardar permisos
            </Button>
          </div>
        </div>

        {locked ? (
          <Text size="small" role="status" className="text-ui-fg-subtle mt-4">
            El rol Superadministrador conserva el comodín <code>*:*</code> y no se edita desde esta
            pantalla.
          </Text>
        ) : !canManage ? (
          <Text size="small" role="status" className="text-ui-fg-subtle mt-4">
            Tu usuario puede consultar los permisos, pero no modificarlos.
          </Text>
        ) : (
          <div className="border-ui-border-base bg-ui-bg-subtle mt-4 flex flex-wrap items-center gap-2 rounded-md border p-3">
            <Text size="xsmall" weight="plus" className="text-ui-fg-subtle mr-1">
              Acciones rápidas
            </Text>
            <Button type="button" size="small" variant="secondary" onClick={() => applyPreset(["read"])}>
              Solo lectura
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={() => applyPreset("all")}>
              Todo
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={() => applyPreset([])}>
              Limpiar
            </Button>
            <span className="flex-1" />
            <Input
              className="w-full sm:w-64"
              aria-label="Buscar recursos"
              placeholder="Buscar recurso…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Text size="small" className="text-ui-fg-subtle">
            {locked ? "Acceso global" : `${selected.size} permisos seleccionados`}
          </Text>
          {!locked && canManage && (
            <Text size="xsmall" className="text-ui-fg-muted">
              Los cambios se aplican solo al guardar.
            </Text>
          )}
        </div>

        {filteredResources.length === 0 ? (
          <Text size="small" role="status" className="text-ui-fg-subtle">
            No hay recursos que coincidan con la búsqueda.
          </Text>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredResources.map((resource) => {
              const total = resource.operations.length
              const count = locked
                ? total
                : resource.operations.filter((operation) => selected.has(`${resource.key}:${operation}`))
                    .length
              const all = count === total
              return (
                <div
                  key={resource.key}
                  role="group"
                  aria-label={resource.label}
                  className={[
                    "rounded-md border p-3",
                    count > 0 ? "border-ui-border-base bg-ui-bg-base" : "border-ui-border-base bg-ui-bg-subtle/40",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-ui-fg-base text-sm font-medium">
                      {resource.label}
                    </span>
                    {editable && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="text-ui-fg-interactive text-xs underline"
                          onClick={() => setResource(resource.key, !all)}
                        >
                          {all ? "Limpiar" : "Todo"}
                        </button>
                      </div>
                    )}
                  </div>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {resource.description}
                  </Text>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {resource.operations.map((operation) => {
                      const checked = locked || selected.has(`${resource.key}:${operation}`)
                      const label =
                        catalog.operations.find((item) => item.key === operation)?.label ?? operation
                      return (
                        <label
                          key={operation}
                          className={[
                            "flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-xs",
                            checked
                              ? "border-ui-border-interactive bg-ui-bg-highlight text-ui-fg-base"
                              : "border-ui-border-base text-ui-fg-subtle",
                            locked ? "cursor-default" : "",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            className="accent-ui-bg-interactive"
                            checked={checked}
                            onChange={() => {
                              if (!editable) return
                              const key = `${resource.key}:${operation}`
                              setSelected((current) => {
                                const next = new Set(current)
                                if (next.has(key)) next.delete(key)
                                else next.add(key)
                                return next
                              })
                            }}
                            disabled={!editable}
                          />
                          {label}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="border-ui-border-base mt-4 flex flex-wrap items-center justify-between gap-2 border-t py-3">
          <Text size="small" className="text-ui-fg-subtle">
            {locked
              ? "Rol global protegido"
              : !canManage
                ? "Solo lectura"
                : dirty
                  ? "Hay cambios sin guardar"
                  : "Sin cambios"}
          </Text>
          <div className="flex flex-wrap gap-2">
            {dirty && (
              <Button type="button" size="small" variant="secondary" onClick={discard} disabled={saving}>
                Descartar
              </Button>
            )}
            <Button
              type="button"
              size="small"
              onClick={save}
              isLoading={saving}
              disabled={!editable || !dirty}
            >
              Guardar permisos
            </Button>
          </div>
        </div>
      </div>
    </Container>
  )
}
