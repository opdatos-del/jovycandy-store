import { Button, Container, Heading, Input, Text } from "@medusajs/ui"
import { useState } from "react"
import type { AccessRole } from "../types"

type Props = {
  saving: boolean
  onCreate: (input: {
    code: string
    name: string
    description: string
    policies: []
  }) => Promise<AccessRole | null>
  onCancel: () => void
}

/** Alta de un rol personalizado; las políticas se ajustan después. */
export function RoleCreate({ saving, onCreate, onCancel }: Props) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const valid = /^[a-z][a-z0-9_]{2,63}$/.test(code.trim()) && name.trim().length >= 2

  return (
    <Container className="p-6" data-testid="access-role-create">
      <Heading level="h2" className="text-base">
        Nuevo rol
      </Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        El código es estable y no se puede cambiar. Asigna las políticas después de crearlo.
      </Text>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="role-code" className="text-ui-fg-subtle text-xs font-medium">
            Código
          </label>
          <Input
            id="role-code"
            value={code}
            placeholder="ventas_norte"
            onChange={(event) => setCode(event.target.value.toLowerCase())}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="role-name" className="text-ui-fg-subtle text-xs font-medium">
            Nombre
          </label>
          <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="role-description" className="text-ui-fg-subtle text-xs font-medium">
            Descripción
          </label>
          <Input
            id="role-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-4">
        <Button
          type="button"
          size="small"
          isLoading={saving}
          onClick={async () => {
            const created = await onCreate({
              code: code.trim(),
              name: name.trim(),
              description: description.trim(),
              policies: [],
            })
            if (created) {
              setCode("")
              setName("")
              setDescription("")
            }
          }}
          disabled={!valid}
        >
          Crear rol
        </Button>
        <Button type="button" size="small" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </Container>
  )
}
