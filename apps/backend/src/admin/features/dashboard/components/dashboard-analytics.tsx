import { ChartBar, ChartPie, Eye } from "@medusajs/icons"
import { Container, Heading, Input, Text } from "@medusajs/ui"
import { useState } from "react"
import { UnavailableMetric } from "./dashboard-kpis"
import {
  ANALYTICS_RANGES,
  ANALYTICS_REQUIREMENTS,
  ANALYTICS_UNAVAILABLE,
  type AnalyticsRange,
  selectedRangeLabel,
} from "../lib/dashboard-model"

export function AnalyticsSection() {
  const [range, setRange] = useState<AnalyticsRange>("30")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")

  return (
    <Container className="flex flex-col gap-4 p-4 sm:p-6" data-testid="jovy-analytics">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Heading level="h2" className="text-base">
            Analítica de audiencia
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            El histórico filtraba visitas, aperturas y rankings con rangos de fechas. Esas
            métricas siguen sin fuente en este proyecto.
          </Text>
        </div>
        <fieldset className="min-w-0">
          <legend className="text-ui-fg-subtle mb-1 text-xs font-medium">
            Periodo de análisis
          </legend>
          <div
            data-testid="jovy-analytics-ranges"
            className="border-ui-border-base bg-ui-bg-subtle inline-flex flex-wrap gap-1 rounded-lg border p-1"
          >
            {ANALYTICS_RANGES.map((option) => (
              <label key={option.value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="jovy-analytics-range"
                  value={option.value}
                  checked={range === option.value}
                  onChange={() => setRange(option.value)}
                  className="peer sr-only"
                />
                <span className="text-ui-fg-subtle hover:text-ui-fg-base peer-checked:bg-ui-bg-base peer-checked:text-ui-fg-base peer-focus-visible:ring-ui-border-interactive block rounded-md px-2.5 py-1.5 text-xs font-medium peer-focus-visible:ring-2 peer-checked:shadow-sm">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {range === "custom" && (
        <div
          data-testid="jovy-analytics-custom"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl"
        >
          <label className="flex flex-col gap-1">
            <span className="text-ui-fg-subtle text-xs font-medium">Desde</span>
            <Input
              type="date"
              value={start}
              max={end || undefined}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-ui-fg-subtle text-xs font-medium">Hasta</span>
            <Input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
        </div>
      )}

      <Text
        size="xsmall"
        className="text-ui-fg-muted"
        aria-live="polite"
        data-testid="jovy-analytics-period"
      >
        Periodo seleccionado: {selectedRangeLabel(range, start, end)}. Los rangos no alteran los
        conteos del CMS; solo describirían la analítica cuando exista una fuente.
      </Text>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <UnavailableMetric
          label="Visitas"
          description="El histórico contaba page views, sesiones y visitantes únicos. Aquí no se muestran ceros ni cifras estimadas."
          icon={Eye}
          testId="jovy-analytics-visits"
        />
        <div className="border-ui-border-base bg-ui-bg-base rounded-lg border p-4 lg:col-span-2">
          <h3 className="text-ui-fg-base text-sm font-semibold">
            Qué se requiere para habilitar estas métricas
          </h3>
          <ul className="text-ui-fg-subtle mt-2 list-disc space-y-1 pl-5 text-sm">
            {ANALYTICS_REQUIREMENTS.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
          <Text size="xsmall" className="text-ui-fg-muted mt-3">
            No se muestran cifras ni rankings estimados mientras la fuente no exista.
          </Text>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <RankingUnavailable
          title="Top productos más abiertos"
          description="No se deriva del catálogo CMS ni del número de productos: requiere aperturas registradas por producto."
          icon={ChartBar}
          testId="jovy-analytics-top-products"
        />
        <RankingUnavailable
          title="Top categorías exploradas"
          description="No se deriva de las categorías CMS: requiere aperturas registradas por categoría y periodo."
          icon={ChartPie}
          testId="jovy-analytics-top-categories"
        />
      </div>
    </Container>
  )
}

type RankingUnavailableProps = {
  title: string
  description: string
  icon: typeof ChartBar
  testId: string
}

function RankingUnavailable({ title, description, icon: Icon, testId }: RankingUnavailableProps) {
  return (
    <div
      data-testid={testId}
      role="group"
      aria-labelledby={`${testId}-title`}
      className="border-ui-border-base bg-ui-bg-subtle rounded-lg border border-dashed p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 id={`${testId}-title`} className="text-ui-fg-base text-sm font-semibold">
          {title}
        </h3>
        <Icon aria-hidden className="text-ui-fg-muted h-5 w-5 shrink-0" />
      </div>
      <p className="text-ui-fg-muted mt-3 text-sm font-medium">{ANALYTICS_UNAVAILABLE}</p>
      <Text size="xsmall" className="text-ui-fg-subtle mt-1">
        {description}
      </Text>
    </div>
  )
}
