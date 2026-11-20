import {
  Calendar,
  DocumentText,
  Envelope,
  Photo,
  ShoppingBag,
  Sparkles,
  Swatch,
  Tag,
} from "@medusajs/icons"
import { Button, Container, Text } from "@medusajs/ui"
import { AnalyticsSection } from "./dashboard-analytics"
import { DashboardHeader } from "./dashboard-header"
import { DashboardLoading, KpiCard, KpiGroup } from "./dashboard-kpis"
import {
  AccessSection,
  OptionalModulesSection,
  PendingSection,
  RequestsSection,
} from "./dashboard-operations"
import { number } from "../lib/dashboard-model"
import { useDashboard } from "../hooks/use-dashboard"

export const DashboardPage = () => {
  const { dashboard, isLoading, isRefreshing, error, refresh, retry } = useDashboard()

  return (
    <div
      className="flex flex-col gap-y-5"
      data-jovy-quality
      data-testid="jovy-dashboard"
      aria-busy={isLoading || isRefreshing}
    >
      <DashboardHeader
        generatedAt={dashboard?.generated_at ?? null}
        isRefreshing={isRefreshing}
        onRefresh={() => void refresh()}
      />

      {error && (
        <Container className="flex flex-col gap-3 p-4 sm:p-6" data-testid="jovy-dashboard-error">
          <p role="alert" className="text-ui-fg-error text-sm">
            {error}
          </p>
          {dashboard ? (
            <Text size="xsmall" className="text-ui-fg-muted">
              Se mantienen los últimos datos cargados. Puedes reintentar el refresco.
            </Text>
          ) : null}
          <div>
            <Button size="small" variant="secondary" onClick={() => void retry()}>
              Reintentar
            </Button>
          </div>
        </Container>
      )}

      {!dashboard && isLoading && <DashboardLoading />}

      {!dashboard && !isLoading && !error && (
        <Container className="flex flex-col items-start gap-3 p-4 sm:p-6">
          <Text size="small" role="status" className="text-ui-fg-subtle">
            No hay datos disponibles para mostrar.
          </Text>
          <Button size="small" variant="secondary" onClick={() => void retry()}>
            Reintentar
          </Button>
        </Container>
      )}

      {dashboard && (
        <>
          <KpiGroup
            title="Productos"
            description="Catálogo comercial y categorías nativas de Medusa."
          >
            <KpiCard
              label="Productos"
              value={dashboard.core.products.count}
              details={["Productos comerciales de Medusa"]}
              icon={ShoppingBag}
              href="/products"
              linkLabel="Abrir productos"
              testId="jovy-stat-products"
              cardTestId="jovy-card-products"
            />
            <KpiCard
              label="Categorías"
              value={dashboard.core.categories.count}
              details={["Categorías nativas de Medusa"]}
              icon={Tag}
              href="/categories"
              linkLabel="Abrir categorías"
              testId="jovy-stat-categories"
              cardTestId="jovy-card-categories"
            />
          </KpiGroup>

          <KpiGroup
            title="Eventos"
            description="Agenda corporativa y visibilidad vigente según la ventana publicada."
          >
            <KpiCard
              label="Eventos vigentes"
              value={dashboard.events.active}
              details={[
                `${number.format(dashboard.events.published)} publicados · ${number.format(dashboard.events.draft)} borradores`,
                `${number.format(dashboard.events.cancelled)} cancelados · ${number.format(dashboard.events.archived)} archivados`,
                `${number.format(dashboard.events.total)} en total`,
              ]}
              icon={Calendar}
              href="/jovy-herramientas/events"
              linkLabel="Abrir eventos"
              testId="jovy-stat-events"
              cardTestId="jovy-card-events"
            />
          </KpiGroup>

          <AnalyticsSection />

          <KpiGroup
            title="Galería y logos"
            description="Contenido de marca publicado y habilitado para el storefront."
          >
            <KpiCard
              label="Galería publicada"
              value={dashboard.brand.gallery.published}
              details={[`Máximo visible: ${number.format(dashboard.brand.gallery.limit)}`]}
              warning={
                dashboard.brand.gallery.exceeds_limit
                  ? "Hay más elementos publicados que el máximo visible simultáneo."
                  : undefined
              }
              icon={Photo}
              href="/jovy/brand"
              linkLabel="Abrir galería"
              testId="jovy-stat-gallery"
              cardTestId="jovy-card-gallery"
            />
            <KpiCard
              label="Logos activos"
              value={dashboard.brand.logos.active}
              details={["Logos habilitados de la marca"]}
              icon={Swatch}
              href="/jovy/brand"
              linkLabel="Abrir logos"
              testId="jovy-stat-logos"
              cardTestId="jovy-card-logos"
            />
          </KpiGroup>

          <KpiGroup
            title="Contenido"
            description="Ciclo editorial de páginas y piezas de marketing."
          >
            <KpiCard
              label="Páginas editoriales"
              value={dashboard.content.pages.total}
              details={[
                `${number.format(dashboard.content.pages.draft)} borradores · ${number.format(dashboard.content.pages.published)} publicadas`,
                `${number.format(dashboard.content.pages.archived)} archivadas`,
              ]}
              icon={DocumentText}
              href="/jovy-herramientas/content"
              linkLabel="Abrir contenido"
              testId="jovy-stat-content"
              cardTestId="jovy-card-content"
            />
            <KpiCard
              label="Hero publicado"
              value={dashboard.marketing.hero.published}
              details={[
                `${number.format(dashboard.marketing.hero.draft)} borradores · ${number.format(dashboard.marketing.hero.archived)} archivados`,
              ]}
              icon={Sparkles}
              href="/jovy-herramientas/marketing"
              linkLabel="Abrir hero"
              testId="jovy-stat-hero"
              cardTestId="jovy-card-hero"
            />
            <KpiCard
              label="Banners publicados"
              value={dashboard.marketing.banners.published}
              details={[
                `${number.format(dashboard.marketing.banners.draft)} borradores · ${number.format(dashboard.marketing.banners.archived)} archivados`,
              ]}
              icon={Sparkles}
              href="/jovy/announcements"
              linkLabel="Abrir anuncios"
              testId="jovy-stat-banners"
              cardTestId="jovy-card-banners"
            />
          </KpiGroup>

          <KpiGroup
            title="Solicitudes"
            description="Bandejas consolidadas de ventas, atención y catálogo."
          >
            <KpiCard
              label="Solicitudes pendientes"
              value={dashboard.contacts.total.pending}
              details={[
                `${number.format(dashboard.contacts.total.handled)} atendidas · ${number.format(dashboard.contacts.total.total)} en total`,
              ]}
              icon={Envelope}
              href="/jovy-herramientas/contacts"
              linkLabel="Abrir contactos"
              testId="jovy-stat-contacts"
              cardTestId="jovy-card-contacts"
            />
          </KpiGroup>

          <RequestsSection contacts={dashboard.contacts} />
          <PendingSection pending={dashboard.pending} />
          <OptionalModulesSection modules={dashboard.optional_modules} />
          <AccessSection />
        </>
      )}
    </div>
  )
}
