"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge, Button, Container, Heading, Input, Label, Select, Text } from "@medusajs/ui"

import {
  CARD_MODES,
  CARD_PRESETS,
  fetchProductVisual,
  fetchVisualFamilies,
  saveProductVisual,
  updateFamilyPreset,
  uploadCardAsset,
  type FamilyVisual,
  type ProductVisualMetadata,
} from "../api"
import {
  registerWorkspaceBlock,
  setWorkspaceMeta,
  unregisterWorkspaceBlock,
} from "@admin/features/product-workspace/store"

type Draft = {
  mode: string
  preset: string
  swapUrl: string
  overlayUrl: string
  fullUrl: string
  background: string
  duration: string
  intensity: string
}

const EMPTY: Draft = {
  mode: "inherit",
  preset: "inherit",
  swapUrl: "",
  overlayUrl: "",
  fullUrl: "",
  background: "",
  duration: "",
  intensity: "",
}

function draftFrom(metadata: Record<string, unknown> | null | undefined): Draft {
  const text = (value: unknown) => (typeof value === "string" ? value : "")
  return {
    mode: text(metadata?.card_hover_mode) || "inherit",
    preset: text(metadata?.card_hover_preset) || "inherit",
    swapUrl: text(metadata?.card_hover_swap_url),
    overlayUrl: text(metadata?.card_hover_overlay_url),
    fullUrl: text(metadata?.card_hover_full_url),
    background: text(metadata?.card_hover_background),
    duration: metadata?.card_hover_duration_ms ? String(metadata.card_hover_duration_ms) : "",
    intensity: metadata?.card_hover_intensity ? String(metadata.card_hover_intensity) : "",
  }
}

function buildPatch(draft: Draft): Record<string, unknown> {
  const patch: Record<string, unknown> = { card_visual_version: 1 }
  if (draft.mode !== "inherit") {
    patch.card_hover_mode = draft.mode
    patch.card_hover_enabled = draft.mode !== "none"
  }
  if (draft.preset !== "inherit") patch.card_hover_preset = draft.preset
  if (draft.mode === "swap" && draft.swapUrl) patch.card_hover_swap_url = draft.swapUrl
  if (draft.mode === "layered") {
    if (draft.overlayUrl) patch.card_hover_overlay_url = draft.overlayUrl
    if (draft.fullUrl) patch.card_hover_full_url = draft.fullUrl
  }
  if (draft.background) patch.card_hover_background = draft.background
  if (draft.duration) patch.card_hover_duration_ms = Number(draft.duration)
  if (draft.intensity) patch.card_hover_intensity = Number(draft.intensity)
  return patch
}

export function ProductCardVisualWidget({ productId }: { productId: string }) {
  const [product, setProduct] = useState<ProductVisualMetadata | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<"swap" | "overlay" | "full" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [previewHover, setPreviewHover] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [family, setFamily] = useState<FamilyVisual | null>(null)
  const [familyPreset, setFamilyPreset] = useState("inherit")
  const [savingFamily, setSavingFamily] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchProductVisual(productId)
        if (cancelled) return
        setProduct(data)
        setDraft(draftFrom(data.metadata))

        const families = await fetchVisualFamilies().catch((): FamilyVisual[] => [])
        if (cancelled) return
        const linked = families.find((item) => item.product_ids.includes(productId)) ?? null
        setFamily(linked)
        setFamilyPreset(linked?.card_preset ?? "inherit")
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar el producto.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productId])

  const update = (field: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setDirty(true)
  }

  const upload = async (target: "swap" | "overlay" | "full", file: File | undefined) => {
    if (!file) return
    setUploading(target)
    setError("")
    setNotice("")
    try {
      const uploaded = await uploadCardAsset(file)
      if (!uploaded.url) throw new Error("Medusa no devolvió una URL para la imagen.")
      update(target === "swap" ? "swapUrl" : target === "overlay" ? "overlayUrl" : "fullUrl", uploaded.url)
      setNotice("Imagen cargada. Recuerda guardar los cambios.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar la imagen.")
    } finally {
      setUploading(null)
    }
  }

  const save = async () => {
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const saved = await saveProductVisual(productId, product?.metadata ?? {}, buildPatch(draft))
      setProduct(saved)
      setDirty(false)
      setNotice("Configuración visual guardada.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la configuración.")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    registerWorkspaceBlock({
      id: "visual",
      label: "Presentación visual",
      dirty,
      saving,
      save: async () => {
        await save()
      },
    })
    return () => unregisterWorkspaceBlock("visual")
  }, [dirty, saving, save])

  const reset = () => {
    setDraft(EMPTY)
    setDirty(true)
    setNotice("Se quitarán las claves visuales al guardar.")
  }

  const saveFamily = async () => {
    if (!family) return
    setSavingFamily(true)
    setError("")
    setNotice("")
    try {
      const preset = familyPreset === "inherit" ? null : familyPreset
      const result = await updateFamilyPreset(family.id, preset)
      setFamily(result.family)
      setFamilyPreset(result.family.card_preset ?? "inherit")
      setNotice("Preset de familia guardado. Aplica a los productos que lo heredan.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el preset de familia.")
    } finally {
      setSavingFamily(false)
    }
  }

  const preview = useMemo(() => {
    const modeForPreset = (preset: string) =>
      preset === "jovy-gummies"
        ? "layered"
        : preset === "jovy-swap"
          ? "swap"
          : preset === "jovy-none"
            ? "none"
            : "zoom"
    const mode =
      draft.mode !== "inherit"
        ? draft.mode
        : draft.preset !== "inherit"
          ? modeForPreset(draft.preset)
          : modeForPreset(familyPreset)
    return {
      mode,
      overlay: draft.overlayUrl,
      swap: draft.swapUrl,
      background: draft.background || "#f5f7f9",
      duration: Number(draft.duration || 350),
    }
  }, [draft, familyPreset])

  const effectiveMode = preview.mode
  const modeLabel = CARD_MODES.find((mode) => mode.value === preview.mode)?.label ?? preview.mode

  useEffect(() => {
    setWorkspaceMeta("visualMode", preview.mode)
  }, [preview.mode])

  return (
    <Container
      id="jovy-product-visual"
      className="scroll-mt-24 p-4 pb-24 sm:p-6 sm:pb-24"
      data-testid="product-card-visual-widget"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Heading level="h2">Presentación visual del catálogo</Heading>
          <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
            Tarjeta del catálogo · no altera precios, stock ni galería
          </Text>
        </div>
        {draft.mode === "inherit" && draft.preset === "inherit" ? (
          <Badge color="grey">Heredando</Badge>
        ) : (
          <Badge color="green">Configuración propia</Badge>
        )}
      </div>

      {loading ? <Text className="mt-4">Cargando configuración…</Text> : null}

      {!loading && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5" data-testid="card-visual-preset">
                <Label htmlFor="card-visual-preset" className="text-ui-fg-subtle text-xs">
                  Preset
                </Label>
                <Select value={draft.preset} onValueChange={(value) => update("preset", value)}>
                  <Select.Trigger id="card-visual-preset">
                    <Select.Value placeholder="Selecciona un preset" />
                  </Select.Trigger>
                  <Select.Content>
                    {CARD_PRESETS.map((preset) => (
                      <Select.Item key={preset.value} value={preset.value}>
                        {preset.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div className="grid gap-1.5" data-testid="card-visual-mode">
                <Label htmlFor="card-visual-mode" className="text-ui-fg-subtle text-xs">
                  Efecto
                </Label>
                <Select value={draft.mode} onValueChange={(value) => update("mode", value)}>
                  <Select.Trigger id="card-visual-mode">
                    <Select.Value placeholder="Selecciona un efecto" />
                  </Select.Trigger>
                  <Select.Content>
                    {CARD_MODES.map((mode) => (
                      <Select.Item key={mode.value} value={mode.value}>
                        {mode.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>

            {family ? (
              <div
                className="flex flex-wrap items-center gap-2 rounded-lg border border-ui-border-base px-2.5 py-2"
                data-testid="card-visual-family"
              >
                <div className="min-w-0 flex-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Familia
                  </Text>
                  <Text size="small" weight="plus" className="truncate">
                    {family.name}
                  </Text>
                </div>
                <Select value={familyPreset} onValueChange={setFamilyPreset}>
                  <Select.Trigger
                    id="card-visual-family-preset"
                    aria-label={`Preset de familia ${family.name}`}
                    className="min-w-[190px] flex-1 sm:flex-none"
                  >
                    <Select.Value placeholder="Heredar configuración" />
                  </Select.Trigger>
                  <Select.Content>
                    {CARD_PRESETS.map((preset) => (
                      <Select.Item key={preset.value} value={preset.value}>
                        {preset.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={savingFamily}
                  onClick={() => void saveFamily()}
                  title="Aplica a todos los productos de la familia que heredan"
                >
                  Guardar familia
                </Button>
              </div>
            ) : null}

            {effectiveMode === "swap" ? (
              <AssetField
                label="Imagen alternativa"
                hint="Se muestra al pasar el cursor"
                value={draft.swapUrl}
                uploading={uploading === "swap"}
                onChange={(value) => update("swapUrl", value)}
                onUpload={(file) => void upload("swap", file)}
              />
            ) : null}

            {effectiveMode === "layered" ? (
              <>
                <AssetField
                  label="Capa de gomitas"
                  hint="PNG/WebP transparente, mismo lienzo que la bolsa"
                  value={draft.overlayUrl}
                  uploading={uploading === "overlay"}
                  onChange={(value) => update("overlayUrl", value)}
                  onUpload={(file) => void upload("overlay", file)}
                />
                <details className="rounded-lg border border-ui-border-base px-2.5 py-2">
                  <summary className="cursor-pointer text-ui-fg-subtle text-xs font-medium">
                    Composición completa (opcional)
                  </summary>
                  <div className="mt-2">
                    <AssetField
                      label="Composición alternativa"
                      value={draft.fullUrl}
                      uploading={uploading === "full"}
                      onChange={(value) => update("fullUrl", value)}
                      onUpload={(file) => void upload("full", file)}
                    />
                  </div>
                </details>
              </>
            ) : null}

            <details className="rounded-lg border border-ui-border-base px-2.5 py-2">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-ui-fg-subtle text-xs font-medium">
                Ajustes avanzados
                <span className="text-ui-fg-muted">
                  {draft.background || "sin fondo"} · {draft.duration || "350"} ms ·{" "}
                  {draft.intensity || "100"}
                </span>
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="card-visual-bg" className="text-ui-fg-subtle text-xs">
                    Fondo
                  </Label>
                  <Input
                    id="card-visual-bg"
                    placeholder="#EAF7E8"
                    value={draft.background}
                    onChange={(event) => update("background", event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="card-visual-duration" className="text-ui-fg-subtle text-xs">
                    Duración (ms)
                  </Label>
                  <Input
                    id="card-visual-duration"
                    type="number"
                    min={150}
                    max={900}
                    placeholder="350"
                    value={draft.duration}
                    onChange={(event) => update("duration", event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="card-visual-intensity" className="text-ui-fg-subtle text-xs">
                    Intensidad (0-150)
                  </Label>
                  <Input
                    id="card-visual-intensity"
                    type="number"
                    min={0}
                    max={150}
                    placeholder="100"
                    value={draft.intensity}
                    onChange={(event) => update("intensity", event.target.value)}
                  />
                </div>
              </div>
            </details>

            {error ? <Text className="text-ui-fg-error">{error}</Text> : null}
            {notice ? <Text className="text-ui-fg-subtle">{notice}</Text> : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="small"
                variant="primary"
                isLoading={saving}
                onClick={() => void save()}
                data-testid="card-visual-save"
              >
                Guardar configuración
              </Button>
              <Button size="small" variant="secondary" disabled={saving} onClick={reset}>
                Restablecer herencia
              </Button>
            </div>
          </div>

          <div className="grid content-start gap-2 lg:sticky lg:top-6 lg:self-start">
            <div className="flex items-center justify-between gap-2">
              <Text size="small" weight="plus">
                Vista previa
              </Text>
              <Button
                size="small"
                variant="secondary"
                aria-pressed={previewHover}
                onClick={() => setPreviewHover((current) => !current)}
              >
                {previewHover ? "Ver reposo" : "Probar hover"}
              </Button>
            </div>
            <div
              className="relative grid aspect-square place-items-center overflow-hidden rounded-xl border border-ui-border-base"
              style={{ background: preview.background }}
              data-mode={preview.mode}
              data-testid="card-visual-preview"
              onMouseEnter={() => setPreviewHover(true)}
              onMouseLeave={() => setPreviewHover(false)}
            >
              {preview.mode === "layered" && preview.overlay ? (
                <img
                  src={preview.overlay}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-contain p-[7%] transition-all"
                  style={{
                    opacity: previewHover ? 1 : 0,
                    transform: previewHover ? "none" : "translateY(12px) scale(0.9)",
                    transitionDuration: `${preview.duration}ms`,
                  }}
                />
              ) : null}
              {product?.thumbnail ? (
                <img
                  src={product.thumbnail}
                  alt={product.title ?? "Producto"}
                  className="absolute inset-0 h-full w-full object-contain p-[7%]"
                  style={{
                    transform:
                      previewHover && preview.mode === "zoom" ? "scale(1.04)" : "none",
                    transitionDuration: `${preview.duration}ms`,
                  }}
                />
              ) : (
                <Text size="small">Producto sin imagen principal</Text>
              )}
              {preview.mode === "swap" && preview.swap ? (
                <img
                  src={preview.swap}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-contain p-[7%]"
                  style={{ opacity: previewHover ? 1 : 0, transitionDuration: `${preview.duration}ms` }}
                />
              ) : null}
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {modeLabel} · la bolsa conserva tamaño y encuadre
            </Text>
          </div>
        </div>
      )}
    </Container>
  )
}

function AssetField({
  label,
  hint,
  value,
  uploading,
  onChange,
  onUpload,
}: {
  label: string
  hint?: string
  value: string
  uploading: boolean
  onChange: (value: string) => void
  onUpload: (file: File | undefined) => void
}) {
  return (
    <div
      className="flex gap-3 rounded-lg border border-ui-border-base p-2.5"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        if (!uploading) onUpload(event.dataTransfer.files?.[0])
      }}
    >
      <div className="bg-ui-bg-subtle grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border border-ui-border-base">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <Text size="xsmall" className="text-ui-fg-muted">
            Sin imagen
          </Text>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Text size="small" weight="plus" className="block truncate">
              {label}
            </Text>
            {hint ? (
              <Text size="xsmall" className="text-ui-fg-subtle">
                {hint}
              </Text>
            ) : null}
          </div>
          <label className="border-ui-border-base inline-flex cursor-pointer items-center rounded-md border px-2 py-1 text-xs font-medium">
            {uploading ? "Cargando…" : "Subir imagen"}
            <input
              type="file"
              accept="image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                onUpload(event.target.files?.[0])
                event.currentTarget.value = ""
              }}
            />
          </label>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Input
            placeholder="https://…"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-8 min-w-0 flex-1 text-xs"
          />
          {value ? (
            <Button size="small" variant="transparent" onClick={() => onChange("")}>
              Quitar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
