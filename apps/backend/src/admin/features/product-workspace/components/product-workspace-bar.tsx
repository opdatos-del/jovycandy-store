"use client"

import { Badge, Button, Container, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import { fetchEditorialStatus } from "../api"
import { useNativeProductDetailDisclosure } from "../hooks/use-native-product-detail-disclosure"
import { useWorkspace, useWorkspaceMeta } from "@admin/shared/state/product-workspace"

type Props = {
  product: {
    id: string
    title?: string
    status?: string
    thumbnail?: string | null
    metadata?: Record<string, unknown> | null
  }
}

const MODE_LABELS: Record<string, string> = {
  zoom: "Zoom",
  swap: "Cambio de imagen",
  layered: "Explosión",
  none: "Sin animación",
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

/**
 * Barra de trabajo del producto: estado resumido, navegación entre bloques Jovy
 * y guardado de todos los cambios pendientes. No modifica el Admin nativo.
 */
export const ProductWorkspaceBar = ({ product }: Props) => {
  const { blocks, dirty, saving, saveAll } = useWorkspace()
  const meta = useWorkspaceMeta()
  const [editorialStatus, setEditorialStatus] = useState<string | null>(null)
  const [editorialLoading, setEditorialLoading] = useState(true)
  const [compactNativeDetail, setCompactNativeDetail] = useState(true)
  const [saveSummary, setSaveSummary] = useState<{ message: string; failed: boolean } | null>(null)

  useNativeProductDetailDisclosure({ compact: compactNativeDetail })

  const loadEditorial = useCallback(async () => {
    setEditorialLoading(true)
    try {
      setEditorialStatus(await fetchEditorialStatus(product.id))
    } catch {
      setEditorialStatus(null)
    } finally {
      setEditorialLoading(false)
    }
  }, [product.id])

  useEffect(() => {
    void loadEditorial()
  }, [loadEditorial])

  useEffect(() => {
    if (!dirty.length) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty.length])

  useEffect(() => {
    if (!dirty.length) setSaveSummary(null)
  }, [dirty.length])

  const savePendingBlocks = async () => {
    const result = await saveAll()
    if (!result.failed.length) {
      setSaveSummary(result.saved.length ? { message: "Cambios guardados.", failed: false } : null)
      return
    }
    setSaveSummary(
      result.saved.length
        ? { message: `Guardado parcial. Pendiente: ${result.failed.join(", ")}.`, failed: true }
        : { message: `No se guardó: ${result.failed.join(", ")}.`, failed: true },
    )
  }

  const visualMode =
    meta.visualMode ??
    (typeof product.metadata?.card_hover_mode === "string" ? product.metadata.card_hover_mode : "zoom")
  const visualLabel = MODE_LABELS[visualMode] ?? "Zoom"
  const effectiveEditorialStatus = meta.editorialStatus ?? editorialStatus

  return (
    <Container
      id="jovy-product-workspace"
      className="fixed bottom-4 right-4 z-40 w-[min(760px,calc(100vw-2rem))] rounded-xl border border-ui-border-base bg-ui-bg-base p-2.5 shadow-elevation-modal"
      data-testid="product-workspace-bar"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Text size="small" weight="plus" className="truncate">
            {product.title ?? "Producto"}
          </Text>
          <Badge size="2xsmall" color={product.status === "published" ? "green" : "grey"}>
            {product.status === "published" ? "Publicado" : product.status ?? "Borrador"}
          </Badge>
          <Badge size="2xsmall" color={effectiveEditorialStatus === "published" ? "green" : "grey"}>
            {editorialLoading
              ? "Ficha…"
              : effectiveEditorialStatus === "published"
                ? "Ficha publicada"
                : effectiveEditorialStatus
                  ? `Ficha ${effectiveEditorialStatus}`
                  : "Sin ficha"}
          </Badge>
          <Badge size="2xsmall" color="blue">
            Visual: {visualLabel}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" role="navigation" aria-label="Secciones Jovy">
            <Button size="small" variant="transparent" onClick={() => scrollToId("jovy-product-editorial")}>
              Editorial
            </Button>
            <Button size="small" variant="transparent" onClick={() => scrollToId("jovy-product-visual")}>
              Visual
            </Button>
          </div>

          <Button
            size="small"
            variant="transparent"
            aria-pressed={compactNativeDetail}
            onClick={() => setCompactNativeDetail((current) => !current)}
          >
            {compactNativeDetail ? "Mostrar técnicos" : "Ocultar técnicos"}
          </Button>

          {saveSummary ? (
            <Text
              size="xsmall"
              className={saveSummary.failed ? "text-ui-fg-error" : "text-ui-fg-subtle"}
              aria-live="polite"
              data-testid="workspace-save-summary"
            >
              {saveSummary.message}
            </Text>
          ) : dirty.length ? (
            <Text size="xsmall" className="text-ui-fg-subtle" data-testid="workspace-dirty">
              {dirty.length === 1 ? "1 bloque sin guardar" : `${dirty.length} bloques sin guardar`}
            </Text>
          ) : (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Sin cambios pendientes
            </Text>
          )}

          <Button
            size="small"
            variant="primary"
            isLoading={saving}
            disabled={!dirty.length || saving}
            onClick={() => void savePendingBlocks()}
            data-testid="workspace-save-all"
          >
            Guardar cambios{blocks.length && dirty.length ? ` (${dirty.length})` : ""}
          </Button>
        </div>
      </div>
    </Container>
  )
}
