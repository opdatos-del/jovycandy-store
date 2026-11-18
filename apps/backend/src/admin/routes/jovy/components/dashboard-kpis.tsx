import { Text } from "@medusajs/ui"
import type { ComponentType, ReactNode } from "react"
import { useId } from "react"
import { ANALYTICS_UNAVAILABLE, adminHref, number } from "./dashboard-model"

type KpiCardProps = {
  label: string
  value: number
  details?: string[]
  warning?: string
  icon: ComponentType
  href: string
  linkLabel: string
  testId: string
  cardTestId?: string
}

export function KpiCard({
  label,
  value,
  details = [],
  warning,
  icon: Icon,
  href,
  linkLabel,
  testId,
  cardTestId,
}: KpiCardProps) {
  const labelId = `${testId}-label`

  return (
    <article
      aria-labelledby={labelId}
      data-testid={cardTestId}
      className="border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest flex min-w-0 flex-col rounded-lg border"
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3
            id={labelId}
            className="text-ui-fg-subtle text-xs font-semibold tracking-wide uppercase"
          >
            {label}
          </h3>
          <p className="mt-2 text-2xl font-semibold tabular-nums" data-testid={testId}>
            {number.format(value)}
          </p>
          {details.length > 0 && (
            <div className="mt-1 flex flex-col gap-y-0.5">
              {details.map((detail) => (
                <Text key={detail} size="xsmall" className="text-ui-fg-subtle">
                  {detail}
                </Text>
              ))}
            </div>
          )}
          {warning && (
            <p role="status" className="text-ui-fg-error mt-2 text-xs">
              {warning}
            </p>
          )}
        </div>
        <span
          aria-hidden
          className="bg-ui-bg-subtle text-ui-fg-muted flex size-10 shrink-0 items-center justify-center rounded-md"
        >
          <Icon />
        </span>
      </div>
      <div className="border-ui-border-base mt-auto border-t px-4 py-2">
        <a
          href={adminHref(href)}
          className="text-ui-fg-interactive focus-visible:ring-ui-border-interactive rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {linkLabel}
        </a>
      </div>
    </article>
  )
}

type KpiGroupProps = {
  title: string
  description?: string
  children: ReactNode
}

export function KpiGroup({ title, description, children }: KpiGroupProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <h2 id={headingId} className="jovy-subtitle text-ui-fg-base text-base font-semibold">
          {title}
        </h2>
        {description && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
            {description}
          </Text>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))]">{children}</div>
    </section>
  )
}

type UnavailableMetricProps = {
  label: string
  description: string
  icon: ComponentType
  testId: string
}

export function UnavailableMetric({ label, description, icon: Icon, testId }: UnavailableMetricProps) {
  return (
    <article
      aria-labelledby={`${testId}-label`}
      data-testid={testId}
      className="border-ui-border-base bg-ui-bg-subtle flex min-w-0 flex-col rounded-lg border border-dashed p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            id={`${testId}-label`}
            className="text-ui-fg-subtle text-xs font-semibold tracking-wide uppercase"
          >
            {label}
          </h3>
          <p className="text-ui-fg-muted mt-2 text-sm font-medium">{ANALYTICS_UNAVAILABLE}</p>
        </div>
        <span
          aria-hidden
          className="bg-ui-bg-base text-ui-fg-muted flex size-10 shrink-0 items-center justify-center rounded-md"
        >
          <Icon />
        </span>
      </div>
      <Text size="xsmall" className="text-ui-fg-subtle mt-2">
        {description}
      </Text>
    </article>
  )
}

export function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Cargando dashboard">
      <span className="sr-only">Cargando dashboard…</span>
      <div aria-hidden className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="border-ui-border-base bg-ui-bg-base flex flex-col rounded-lg border p-4"
          >
            <span className="bg-ui-bg-subtle h-3 w-24 animate-pulse rounded" />
            <span className="bg-ui-bg-subtle mt-3 h-7 w-16 animate-pulse rounded" />
            <span className="bg-ui-bg-subtle mt-3 h-3 w-32 animate-pulse rounded" />
            <span className="bg-ui-bg-subtle mt-6 h-3 w-20 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
