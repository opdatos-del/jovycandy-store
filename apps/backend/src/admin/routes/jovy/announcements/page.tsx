import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BellAlert, Photo } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Skeleton, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { adminRequest, errorMessage } from "../components/admin-api"
// eslint-disable-next-line no-restricted-imports -- el Vite del Admin no resuelve el alias @jovy; la ruta relativa cruzando grupos es necesaria
import { BannerManager } from "../../jovy-herramientas/marketing/components/banner-manager"
import { CorporateMessageForm } from "./components/corporate-message-form"

/**
 * Anuncios de portada = dos piezas independientes:
 * A. El modal promocional, que es un banner del slot `promo`. Se administra
 *    aquí mismo con el gestor de Marketing (mismo CRUD y mismos endpoints); el
 *    enlace a Marketing queda como atajo secundario.
 * B. El mensaje corporativo ES/EN, editado aquí.
 *
 * Los conteos usan la misma regla de publicación que el backend
 * (`isMarketingVisible`): publicado + habilitado + dentro de `starts_at`/`ends_at`.
 */

type AnnouncementSettings = {
  corporate_message_es: string | null
  corporate_message_en: string | null
  updated_at?: string | null
}

type BannerStatus = "draft" | "published" | "archived"

type PromoBanner = {
  id: string
  slot: "promo" | "hint"
  status: BannerStatus
  enabled: boolean
  priority: number
  sort_order: number
  media_file_id: string | null
  starts_at: string | null
  ends_at: string | null
  translations: {
    es: { title: string; alt: string }
    en: { title: string; alt: string }
  }
}

type PromoWindowState = "active" | "scheduled" | "expired" | "inactive"

type PromoSummary = {
  total: number
  published: number
  enabled: number
  active: number
  scheduled: number
  expired: number
}

type PromoPreview = {
  id: string
  title: string
  url: string
  state: PromoWindowState
  priority: number
}

const WINDOW_LABEL: Record<PromoWindowState, string> = {
  active: "Activo ahora",
  scheduled: "Programado",
  expired: "Vencido",
  inactive: "Inactivo",
}

const WINDOW_COLOR: Record<PromoWindowState, "green" | "blue" | "orange" | "grey"> = {
  active: "green",
  scheduled: "blue",
  expired: "orange",
  inactive: "grey",
}

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeStyle: "short",
})

function formatDate(value: string | null) {
  if (!value) return "sin límite"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "fecha inválida" : dateFormatter.format(date)
}

function windowState(banner: PromoBanner, now: number): PromoWindowState {
  if (banner.status !== "published" || !banner.enabled) return "inactive"
  const start = banner.starts_at ? new Date(banner.starts_at).getTime() : null
  const end = banner.ends_at ? new Date(banner.ends_at).getTime() : null
  if (start !== null && Number.isFinite(start) && now < start) return "scheduled"
  if (end !== null && Number.isFinite(end) && now > end) return "expired"
  return "active"
}

function summarizePromo(banners: PromoBanner[], now: number): PromoSummary {
  const promo = banners.filter((banner) => banner.slot === "promo")
  return promo.reduce<PromoSummary>(
    (summary, banner) => {
      summary.total += 1
      if (banner.status === "published") summary.published += 1
      if (banner.enabled) summary.enabled += 1
      const state = windowState(banner, now)
      if (state === "active") summary.active += 1
      if (state === "scheduled") summary.scheduled += 1
      if (state === "expired") summary.expired += 1
      return summary
    },
    { total: 0, published: 0, enabled: 0, active: 0, scheduled: 0, expired: 0 },
  )
}

const AnnouncementsPage = () => {
  const [settings, setSettings] = useState<AnnouncementSettings | null>(null)
  const [promoSummary, setPromoSummary] = useState<PromoSummary | null>(null)
  const [promoPreview, setPromoPreview] = useState<PromoPreview[]>([])
  const [promoWindow, setPromoWindow] = useState<{ from: string | null; to: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadWarning, setLoadWarning] = useState<string | null>(null)
  const [es, setEs] = useState("")
  const [en, setEn] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const applySettings = (value: AnnouncementSettings) => {
    setSettings(value)
    setEs(value.corporate_message_es ?? "")
    setEn(value.corporate_message_en ?? "")
  }

  const loadPromoBanners = useCallback(async () => {
    try {
      const banners = await adminRequest<{ banners: PromoBanner[] }>("/admin/jovy/marketing/banners")
      const now = Date.now()
      const promo = banners.banners.filter((banner) => banner.slot === "promo")
      setPromoSummary(summarizePromo(banners.banners, now))

      const primary = promo.find((banner) => banner.status === "published") ?? promo[0] ?? null
      setPromoWindow(
        primary ? { from: primary.starts_at, to: primary.ends_at } : null,
      )

      const withMedia = promo.filter((banner) => banner.media_file_id).slice(0, 3)
      const resolved = await Promise.all(
        withMedia.map(async (banner) => {
          try {
            const media = await adminRequest<{ file: { url: string } }>(
              `/admin/jovy/marketing/media/${banner.media_file_id}`,
            )
            return {
              id: banner.id,
              title: banner.translations.es.title,
              url: media.file.url,
              state: windowState(banner, now),
              priority: banner.priority,
            } satisfies PromoPreview
          } catch {
            return null
          }
        }),
      )
      setPromoPreview(resolved.filter((item): item is PromoPreview => item !== null))
      setLoadWarning(
        withMedia.length === 0
          ? null
          : resolved.every((item) => item === null)
            ? "No se pudieron recuperar las vistas previas de los banners promo."
            : null,
      )
    } catch {
      setPromoSummary(null)
      setPromoPreview([])
      setPromoWindow(null)
      setLoadWarning("No se pudo consultar el estado del modal; la edición del mensaje sigue disponible.")
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await adminRequest<{ announcement_settings: AnnouncementSettings }>(
        "/admin/jovy/announcements/settings",
      )
      applySettings(result.announcement_settings)
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error, "No se pudo cargar la configuración de anuncios."))
      setLoading(false)
      return
    }

    await loadPromoBanners()
    setLoading(false)
  }, [loadPromoBanners])

  useEffect(() => {
    void load()
  }, [load])

  const isValidMessage = (value: string) => {
    const length = value.trim().length
    return length === 0 || length >= 2
  }
  const invalid = !isValidMessage(es) || !isValidMessage(en)

  const save = async () => {
    if (invalid) return

    setSaving(true)
    setSaveError(null)
    try {
      await adminRequest("/admin/jovy/announcements/settings", {
        method: "PUT",
        body: JSON.stringify({
          corporate_message_es: es.trim() || null,
          corporate_message_en: en.trim() || null,
        }),
      })
      const persisted = await adminRequest<{ announcement_settings: AnnouncementSettings }>(
        "/admin/jovy/announcements/settings",
      )
      applySettings(persisted.announcement_settings)
      toast.success("Mensaje corporativo guardado.")
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar el mensaje corporativo.")
      setSaveError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const stats: Array<{ key: keyof PromoSummary; label: string; hint: string }> = [
    { key: "total", label: "Banners promo", hint: "Incluye borradores y archivados" },
    { key: "published", label: "Publicados", hint: "Estado editorial publicado" },
    { key: "enabled", label: "Habilitados", hint: "No bloqueados por el interruptor enabled" },
    { key: "active", label: "Activos ahora", hint: "Publicados, habilitados y en ventana" },
    { key: "scheduled", label: "Programados", hint: "Publicados que empiezan más tarde" },
    { key: "expired", label: "Vencidos", hint: "Publicados con fecha de fin pasada" },
  ]

  return (
    <div className="flex flex-col gap-y-4" data-testid="jovy-announcements-page">
      <Container className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h1">Anuncios de portada</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Dos anuncios distintos conviven en la portada: el modal promocional y el mensaje corporativo bajo la
              animación. Cada bloque se edita en su propia pantalla.
            </Text>
          </div>
          <Button size="small" variant="secondary" onClick={() => void load()} isLoading={loading}>
            Actualizar
          </Button>
        </div>
        {loadError && (
          <p role="alert" className="text-ui-fg-error mt-3 text-sm">
            {loadError}
          </p>
        )}
        {loadWarning && (
          <p role="status" className="text-ui-fg-subtle mt-3 text-sm">
            {loadWarning}
          </p>
        )}
      </Container>

      <Container className="p-4 sm:p-6" data-testid="announcements-promo-block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h2">A. Modal de portada</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Ventana promocional con imagen, título bilingüe, CTA, frecuencia y apertura automática. Se administra
              aquí con el mismo gestor del slot <code className="font-mono">promo</code> que usa Marketing; no hay
              formulario ni endpoint duplicado.
            </Text>
          </div>
          <Badge color="purple">Marketing Jovy</Badge>
        </div>

        {loading && !promoSummary ? (
          <div className="mt-4" role="status">
            <span className="sr-only">Consultando el estado del modal…</span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div key={index} className="border-ui-border-base rounded-lg border p-3">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="mt-2 h-6 w-12" />
                </div>
              ))}
            </div>
          </div>
        ) : promoSummary ? (
          <>
            <dl
              className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
              aria-label="Resumen operativo del modal promocional"
            >
              {stats.map((stat) => (
                <div key={stat.key} className="border-ui-border-base rounded-lg border p-3">
                  <dt className="text-ui-fg-subtle text-xs font-medium">{stat.label}</dt>
                  <dd
                    className="mt-1 text-xl font-semibold tabular-nums"
                    data-testid={`promo-${stat.key}`}
                    title={stat.hint}
                  >
                    {promoSummary[stat.key]}
                  </dd>
                </div>
              ))}
            </dl>

            <Text size="xsmall" className="text-ui-fg-subtle mt-2">
              «Activos ahora» aplica la misma regla que el storefront: publicado, habilitado y dentro de la ventana
              temporal. Prioridad y orden solo deciden cuál se presenta primero.
            </Text>

            {promoWindow && (
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                Ventana del banner promo principal: {formatDate(promoWindow.from)} → {formatDate(promoWindow.to)}.
              </Text>
            )}

            <div className="border-ui-border-base mt-5 border-t pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Heading level="h3" className="text-base">
                  Vista previa
                </Heading>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Hasta 3 banners promo con media, en el orden en que los recibe el Admin.
                </Text>
              </div>

              {promoPreview.length > 0 ? (
                <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Vistas previas de banners promo">
                  {promoPreview.map((banner) => (
                    <li
                      key={banner.id}
                      className="border-ui-border-base bg-ui-bg-base flex min-w-0 flex-col overflow-hidden rounded-lg border"
                    >
                      <div className="bg-ui-bg-subtle aspect-[16/10] overflow-hidden">
                        <img
                          src={banner.url}
                          alt={`Vista previa de ${banner.title}`}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex flex-col gap-y-1 p-3">
                        <Text size="small" weight="plus" className="line-clamp-1">
                          {banner.title}
                        </Text>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge size="2xsmall" color={WINDOW_COLOR[banner.state]}>
                            {WINDOW_LABEL[banner.state]}
                          </Badge>
                          <Badge size="2xsmall" color="grey">
                            Prioridad {banner.priority}
                          </Badge>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="border-ui-border-base mt-3 flex flex-col items-center gap-1 rounded-lg border border-dashed p-6 text-center">
                  <Photo aria-hidden className="text-ui-fg-muted h-6 w-6" />
                  <Text size="small" className="text-ui-fg-subtle">
                    {promoSummary.total === 0
                      ? "Aún no hay banners promo. Crea el primero desde el gestor."
                      : "Ningún banner promo tiene media asociada todavía."}
                  </Text>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {/*
               * Enlace nativo y no `Link` de `react-router-dom`: el paquete instalado
               * en la app y el que empaqueta `@medusajs/dashboard` son copias distintas,
               * así que `Link` se renderiza sin contexto de router y rompe la página.
               */}
              <Button asChild size="small" variant="secondary">
                <a href="/app/jovy-herramientas/marketing?tab=banners&slot=promo">Abrir Banners (slot promo)</a>
              </Button>
              <Text size="small" className="text-ui-fg-subtle">
                {promoSummary.published === 1
                  ? "1 banner promo publicado"
                  : `${promoSummary.published} banners promo publicados`}{" "}
                · {promoSummary.enabled === 1 ? "1 habilitado" : `${promoSummary.enabled} habilitados`}
              </Text>
            </div>
          </>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button asChild size="small" variant="secondary">
              <a href="/app/jovy-herramientas/marketing?tab=banners&slot=promo">Abrir Banners (slot promo)</a>
            </Button>
            <Text size="small" className="text-ui-fg-subtle">
              El resumen del modal no está disponible; el gestor sigue accesible.
            </Text>
          </div>
        )}

        <div className="border-ui-border-base mt-5 border-t pt-4">
          <BannerManager
            initialSlot="promo"
            defaultSlotFilter="promo"
            heading="Gestión del modal (slot promo)"
            headingLevel="h2"
            onBannersChange={loadPromoBanners}
          />
        </div>

        <Text size="xsmall" className="text-ui-fg-subtle mt-4">
          El modal y el mensaje corporativo son independientes: publicar o archivar el banner promo no modifica el
          texto corporativo.
        </Text>
      </Container>

      <Container className="p-4 sm:p-6" data-testid="announcements-corporate-block">
        <Heading level="h2">B. Mensaje corporativo</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Texto bajo la animación de portada, en español e inglés. Se guarda como reemplazo completo: ambos idiomas
          viajan juntos y un campo vacío oculta el mensaje en ese idioma.
        </Text>

        <div className="mt-4">
          {loading && !settings ? (
            <Text className="text-ui-fg-subtle" role="status">
              Cargando mensaje corporativo…
            </Text>
          ) : (
            <CorporateMessageForm
              es={es}
              en={en}
              saving={saving}
              error={saveError}
              invalid={invalid}
              onChangeEs={setEs}
              onChangeEn={setEn}
              onSave={() => void save()}
            />
          )}
        </div>

        <div className="border-ui-border-base mt-6 border-t pt-4">
          <Heading level="h3" className="text-base">
            Valores persistidos
          </Heading>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-ui-fg-subtle">Español</dt>
              <dd data-testid="announcement-persisted-es">
                {settings?.corporate_message_es || "Sin mensaje (oculto)"}
              </dd>
            </div>
            <div>
              <dt className="text-ui-fg-subtle">Inglés</dt>
              <dd data-testid="announcement-persisted-en">
                {settings?.corporate_message_en || "Sin mensaje (oculto)"}
              </dd>
            </div>
          </dl>
          {settings?.updated_at && (
            <Text size="xsmall" className="text-ui-fg-muted mt-2">
              Última actualización: {new Date(settings.updated_at).toLocaleString("es-MX")}
            </Text>
          )}
        </div>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Anuncios de portada",
  icon: BellAlert,
  rank: 6,
})

export default AnnouncementsPage
