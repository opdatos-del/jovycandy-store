import { Badge, Container, Heading, Table, Text } from "@medusajs/ui"
import {
  CONTACT_LABELS,
  CONTACT_TYPES,
  adminHref,
  number,
  type JovyDashboard,
} from "./dashboard-model"

export function RequestsSection({ contacts }: { contacts: JovyDashboard["contacts"] }) {
  return (
    <Container className="p-0" data-testid="jovy-requests-section">
      <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
        <div>
          <Heading level="h2" className="text-base">
            Solicitudes por tipo
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Solo conteos; los datos personales permanecen en la bandeja de contactos.
          </Text>
        </div>
        <a
          href={adminHref("/jovy-herramientas/contacts")}
          className="text-ui-fg-interactive focus-visible:ring-ui-border-interactive rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Abrir bandeja de contactos
        </a>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Tipo</Table.HeaderCell>
              <Table.HeaderCell>Pendientes</Table.HeaderCell>
              <Table.HeaderCell>Atendidas</Table.HeaderCell>
              <Table.HeaderCell>Total</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {CONTACT_TYPES.map((type) => {
              const totals = contacts.by_type[type]
              return (
                <Table.Row key={type}>
                  <Table.Cell>{CONTACT_LABELS[type]}</Table.Cell>
                  <Table.Cell>
                    <Badge color={totals.pending > 0 ? "orange" : "grey"}>
                      {number.format(totals.pending)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{number.format(totals.handled)}</Table.Cell>
                  <Table.Cell>{number.format(totals.total)}</Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      </div>
    </Container>
  )
}

type PendingItem = { id: string; title: string; kind?: string }

function PendingList({
  title,
  to,
  items,
  empty,
}: {
  title: string
  to: string
  items: PendingItem[]
  empty: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-ui-fg-base text-sm font-semibold">{title}</h3>
        <a
          href={adminHref(to)}
          className="text-ui-fg-interactive focus-visible:ring-ui-border-interactive rounded-sm text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Ver pendientes
        </a>
      </div>
      {items.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">
          {empty}
        </Text>
      ) : (
        <ul className="divide-ui-border-base divide-y">
          {items.map((item) => (
            <li key={`${item.kind ?? "item"}-${item.id}`} className="py-2">
              <a
                href={adminHref(to)}
                className="text-ui-fg-base focus-visible:ring-ui-border-interactive rounded-sm text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`Abrir borrador ${item.title}`}
              >
                {item.title}
              </a>
              <p className="text-ui-fg-subtle font-mono text-xs">
                {item.kind ? `${item.kind} · ` : ""}
                {item.id}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PendingSection({ pending }: { pending: JovyDashboard["pending"] }) {
  return (
    <Container className="p-4 sm:p-6" data-testid="jovy-pending-section">
      <Heading level="h2" className="text-base">
        Contenido pendiente de publicación
      </Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Cola corta de borradores recientes; la edición ocurre en cada pantalla enlazada.
      </Text>
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
        <PendingList
          title="Contenido"
          to="/jovy-herramientas/content"
          items={pending.content}
          empty="Sin páginas en borrador."
        />
        <PendingList
          title="Marketing"
          to="/jovy-herramientas/marketing"
          items={pending.marketing}
          empty="Sin hero ni banners en borrador."
        />
        <PendingList
          title="Eventos"
          to="/jovy-herramientas/events"
          items={pending.events}
          empty="Sin eventos en borrador."
        />
      </div>
    </Container>
  )
}

export function OptionalModulesSection({ modules }: { modules: JovyDashboard["optional_modules"] }) {
  return (
    <Container className="p-4 sm:p-6" data-testid="jovy-modules-section">
      <Heading level="h2" className="text-base">
        Configuración CMS nueva
      </Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1 mb-4">
        Los módulos opcionales se detectan en tiempo de ejecución; si no están registrados se
        muestran como no instalados, sin métricas estimadas.
      </Text>
      {modules.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">
          No hay módulos opcionales configurados.
        </Text>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {modules.map((module) => (
            <div key={module.key} className="border-ui-border-base rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Text weight="plus">{module.label}</Text>
                <Badge color={module.installed ? "green" : "grey"}>
                  {module.installed ? "Instalado" : "No instalado"}
                </Badge>
              </div>
              {module.installed ? (
                module.counts.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-y-1">
                    {module.counts.map((count) => (
                      <li key={count.key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-ui-fg-subtle">{count.label}</span>
                        <span className="font-medium tabular-nums">{number.format(count.count)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Text size="small" className="text-ui-fg-subtle mt-2">
                    Instalado; sus entidades aún no exponen conteos.
                  </Text>
                )
              ) : (
                <Text size="small" className="text-ui-fg-subtle mt-2">
                  Módulo no registrado en el proyecto.
                </Text>
              )}
            </div>
          ))}
        </div>
      )}
    </Container>
  )
}

const ACCESS_LINKS = [
  {
    to: "/jovy/catalogue",
    title: "Categorías del catálogo",
    description: "Seis tarjetas de presentación, estado editorial y bloqueo de interacción.",
  },
  {
    to: "/jovy/launches",
    title: "Nuevos lanzamientos",
    description: "Lista ordenada con producto, imagen y color de fondo global.",
  },
  {
    to: "/jovy/announcements",
    title: "Anuncios de portada",
    description: "Modal promocional y mensaje corporativo ES/EN.",
  },
]

export function AccessSection() {
  return (
    <Container className="p-4 sm:p-6" data-testid="jovy-access-section">
      <Heading level="h2" className="text-base">
        Portada y catálogo
      </Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1 mb-4">
        Pantallas de presentación que alimentan directamente al storefront.
      </Text>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ACCESS_LINKS.map((item) => (
          <li key={item.to} className="border-ui-border-base rounded-lg border p-4">
            <a
              href={adminHref(item.to)}
              className="text-ui-fg-interactive focus-visible:ring-ui-border-interactive rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {item.title}
            </a>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              {item.description}
            </Text>
          </li>
        ))}
      </ul>
    </Container>
  )
}
