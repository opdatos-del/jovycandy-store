import { Button, Input } from "@medusajs/ui"
import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react"
import {
  CONTACT_PAGE_SIZES,
  CONTACT_SEARCH_PLACEHOLDER,
  CONTACT_STATUS_TABS,
  CONTACT_TAB_LABELS,
  CONTACT_TYPE_LABELS,
  type ContactPageSize,
  type ContactStatusFilter,
  type ContactType,
} from "./inbox"

type ContactInboxFiltersProps = {
  contactType?: ContactType
  typeFilter: ContactType | ""
  onTypeFilterChange: (value: ContactType | "") => void
  statusFilter: ContactStatusFilter
  tabCounts: Record<ContactStatusFilter, number>
  onStatusChange: (value: ContactStatusFilter) => void
  searchDraft: string
  onSearchDraftChange: (value: string) => void
  dateFromDraft: string
  onDateFromChange: (value: string) => void
  dateToDraft: string
  onDateToChange: (value: string) => void
  limit: ContactPageSize
  onLimitChange: (value: ContactPageSize) => void
  filterError: string | null
  onSubmit: () => void
  onReset: () => void
}

const TAB_DOTS: Record<ContactStatusFilter, string> = {
  all: "bg-ui-tag-neutral-icon",
  pending: "bg-ui-tag-orange-icon",
  handled: "bg-ui-tag-green-icon",
  deleted: "bg-ui-tag-red-icon",
}

/**
 * Barra de filtros y pestañas de estado. Mantiene los borradores locales hasta
 * que la persona pulsa Buscar, de modo que escribir no dispara una consulta por
 * tecla ni pierde el foco de la tabla.
 */
export function ContactInboxFilters({
  contactType,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  tabCounts,
  onStatusChange,
  searchDraft,
  onSearchDraftChange,
  dateFromDraft,
  onDateFromChange,
  dateToDraft,
  onDateToChange,
  limit,
  onLimitChange,
  filterError,
  onSubmit,
  onReset,
}: ContactInboxFiltersProps) {
  const tabRefs = useRef<Partial<Record<ContactStatusFilter, HTMLButtonElement | null>>>({})

  const moveTab = (event: ReactKeyboardEvent<HTMLButtonElement>, current: ContactStatusFilter) => {
    const index = CONTACT_STATUS_TABS.indexOf(current)
    let nextIndex = index
    if (event.key === "ArrowRight") nextIndex = (index + 1) % CONTACT_STATUS_TABS.length
    else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + CONTACT_STATUS_TABS.length) % CONTACT_STATUS_TABS.length
    } else if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = CONTACT_STATUS_TABS.length - 1
    else return

    event.preventDefault()
    const next = CONTACT_STATUS_TABS[nextIndex]
    onStatusChange(next)
    requestAnimationFrame(() => tabRefs.current[next]?.focus())
  }

  return (
    <section aria-label="Filtros de solicitudes" className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1 md:max-w-xl">
            <label htmlFor="contact-search" className="text-ui-fg-subtle text-xs font-medium">
              Buscar
            </label>
            <Input
              id="contact-search"
              type="search"
              value={searchDraft}
              placeholder={CONTACT_SEARCH_PLACEHOLDER}
              onChange={(event) => onSearchDraftChange(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="contact-date-from" className="text-ui-fg-subtle text-xs font-medium">
              Desde
            </label>
            <Input
              id="contact-date-from"
              type="date"
              value={dateFromDraft}
              max={dateToDraft || undefined}
              onChange={(event) => onDateFromChange(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="contact-date-to" className="text-ui-fg-subtle text-xs font-medium">
              Hasta
            </label>
            <Input
              id="contact-date-to"
              type="date"
              value={dateToDraft}
              min={dateFromDraft || undefined}
              onChange={(event) => onDateToChange(event.target.value)}
            />
          </div>
          {!contactType && (
            <div className="flex min-w-[190px] flex-col gap-1">
              <label htmlFor="contact-type-filter" className="text-ui-fg-subtle text-xs font-medium">
                Bandeja
              </label>
              <select
                id="contact-type-filter"
                value={typeFilter}
                onChange={(event) => onTypeFilterChange(event.target.value as ContactType | "")}
                className="border-ui-border-base bg-ui-bg-base text-ui-fg-base focus-visible:ring-ui-border-interactive h-8 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">Todas las bandejas</option>
                {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map((type) => (
                  <option key={type} value={type}>
                    {CONTACT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="small">
              Buscar
            </Button>
            <Button type="button" size="small" variant="secondary" onClick={onReset}>
              Limpiar
            </Button>
          </div>
        </div>
        {filterError && (
          <p role="alert" className="text-ui-fg-error text-sm">
            {filterError}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Estado de las solicitudes"
          className="border-ui-border-base bg-ui-bg-subtle inline-flex flex-wrap gap-1 self-start rounded-lg border p-1"
        >
          {CONTACT_STATUS_TABS.map((tab) => {
            const selected = statusFilter === tab
            return (
              <button
                key={tab}
                ref={(element) => {
                  tabRefs.current[tab] = element
                }}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => onStatusChange(tab)}
                onKeyDown={(event) => moveTab(event, tab)}
                className={`focus-visible:ring-ui-border-interactive inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  selected
                    ? "bg-ui-bg-base text-ui-fg-base border-ui-border-base border shadow-sm"
                    : "text-ui-fg-subtle hover:text-ui-fg-base"
                }`}
              >
                <span aria-hidden className={`h-2 w-2 rounded-full ${TAB_DOTS[tab]}`} />
                <span>{CONTACT_TAB_LABELS[tab]}</span>
                <span className="text-ui-fg-subtle text-xs tabular-nums">({tabCounts[tab]})</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="contact-page-size" className="text-ui-fg-subtle text-xs font-medium">
            Por página
          </label>
          <select
            id="contact-page-size"
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value) as ContactPageSize)}
            className="border-ui-border-base bg-ui-bg-base text-ui-fg-base focus-visible:ring-ui-border-interactive rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            {CONTACT_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  )
}
