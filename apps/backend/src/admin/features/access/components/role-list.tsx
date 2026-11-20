import { Badge, Button, Container, Input, Text } from "@medusajs/ui"
import type { AccessRole } from "../types"

type Props = {
  roles: AccessRole[]
  selectedId: string | null
  query: string
  onQueryChange: (value: string) => void
  onSelect: (role: AccessRole) => void
  onCreate: () => void
  canCreate: boolean
}

function RoleRow({
  role,
  selected,
  onSelect,
}: {
  role: AccessRole
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={[
        "flex w-full items-start justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors",
        selected
          ? "border-ui-border-interactive bg-ui-bg-highlight"
          : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-subtle",
      ].join(" ")}
    >
      <span className="min-w-0">
        <span className="text-ui-fg-base block text-sm font-medium break-words">{role.name}</span>
        <span className="text-ui-fg-subtle mt-0.5 block font-mono text-xs break-all">
          {role.code}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Badge size="2xsmall" color={role.is_system ? "grey" : "blue"}>
          {role.is_system ? "Sistema" : "Custom"}
        </Badge>
        <span className="text-ui-fg-subtle text-xs tabular-nums">
          {role.policies.length} permisos
        </span>
      </span>
    </button>
  )
}

/** Selector de roles con búsqueda; evita una fila larga de botones. */
export function RoleList({
  roles,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  onCreate,
  canCreate,
}: Props) {
  const normalized = query.trim().toLowerCase()
  const filtered = roles.filter(
    (role) =>
      !normalized ||
      role.name.toLowerCase().includes(normalized) ||
      role.code.toLowerCase().includes(normalized),
  )
  const system = filtered.filter((role) => role.is_system)
  const custom = filtered.filter((role) => !role.is_system)

  return (
    <Container className="p-0" data-testid="access-role-list">
      <div className="border-ui-border-base border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Text size="small" weight="plus">
              Roles
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {roles.length} configurados
            </Text>
          </div>
          {canCreate && (
            <Button type="button" size="small" onClick={onCreate}>
              Nuevo
            </Button>
          )}
        </div>
        <Input
          className="mt-3"
          aria-label="Buscar roles"
          placeholder="Buscar por nombre o código"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <div className="max-h-[34rem] overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <Text size="small" role="status" className="text-ui-fg-subtle p-3">
            No hay roles que coincidan.
          </Text>
        ) : (
          <>
            {system.length > 0 && (
              <div className="mb-2">
                <Text size="xsmall" className="text-ui-fg-muted px-2 py-1 uppercase">
                  Del sistema
                </Text>
                <div className="flex flex-col gap-1">
                  {system.map((role) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      selected={role.id === selectedId}
                      onSelect={() => onSelect(role)}
                    />
                  ))}
                </div>
              </div>
            )}
            {custom.length > 0 && (
              <div>
                <Text size="xsmall" className="text-ui-fg-muted px-2 py-1 uppercase">
                  Personalizados
                </Text>
                <div className="flex flex-col gap-1">
                  {custom.map((role) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      selected={role.id === selectedId}
                      onSelect={() => onSelect(role)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  )
}
