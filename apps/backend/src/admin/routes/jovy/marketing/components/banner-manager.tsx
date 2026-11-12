import { Badge, Button, Container, Heading, Input, Textarea } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { marketingApi, toDateTimeLocal, toIso } from "./admin-api"

type Status = "draft" | "published" | "archived"
type Slot = "promo" | "hint"
type Frequency = "every" | "session" | "daily"
type Banner = {
  id: string
  slot: Slot
  status: Status
  enabled: boolean
  auto_open: boolean
  frequency: Frequency
  priority: number
  sort_order: number
  media_file_id: string | null
  cta_url: string | null
  starts_at: string | null
  ends_at: string | null
  translations: {
    es: { title: string; description?: string; cta_label?: string; alt: string }
    en: { title: string; description?: string; cta_label?: string; alt: string }
  }
}
type BannerForm = Omit<Banner, "id">

const emptyBanner = (): BannerForm => ({
  slot: "promo",
  status: "draft",
  enabled: true,
  auto_open: false,
  frequency: "every",
  priority: 0,
  sort_order: 0,
  media_file_id: null,
  cta_url: null,
  starts_at: null,
  ends_at: null,
  translations: {
    es: { title: "", description: "", cta_label: "", alt: "" },
    en: { title: "", description: "", cta_label: "", alt: "" },
  },
})

const statusColor = (status: Status) => status === "published" ? "green" : status === "archived" ? "grey" : "orange"

export const BannerManager = () => {
  const [items, setItems] = useState<Banner[]>([])
  const [form, setForm] = useState<BannerForm>(emptyBanner())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const result = await marketingApi<{ banners: Banner[] }>("/admin/jovy/marketing/banners")
      setItems(result.banners)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible cargar Banners.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyBanner())
    setPreviewUrl(null)
  }

  const edit = async (item: Banner) => {
    setEditingId(item.id)
    setForm(item)
    setPreviewUrl(null)
    if (!item.media_file_id) return

    try {
      const media = await marketingApi<{ file: { url: string } }>(`/admin/jovy/marketing/media/${item.media_file_id}`)
      setPreviewUrl(media.file.url)
    } catch {
      setMessage("El archivo asociado ya no está disponible.")
    }
  }

  const upload = async (file?: File) => {
    if (!file) return

    setSaving(true)
    try {
      const body = new FormData()
      body.append("files", file)
      const result = await marketingApi<{ file: { id: string; url: string } }>("/admin/jovy/marketing/media", { method: "POST", body })
      setForm((current) => ({ ...current, media_file_id: result.file.id }))
      setPreviewUrl(result.file.url)
      setMessage("Imagen cargada y lista para guardar.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la imagen.")
    } finally {
      setSaving(false)
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const body = {
        ...form,
        starts_at: toIso(toDateTimeLocal(form.starts_at)),
        ends_at: toIso(toDateTimeLocal(form.ends_at)),
      }
      await (editingId
        ? marketingApi(`/admin/jovy/marketing/banners/${editingId}`, { method: "PUT", body: JSON.stringify(body) })
        : marketingApi("/admin/jovy/marketing/banners", { method: "POST", body: JSON.stringify(body) }))
      setMessage("Banner guardado.")
      resetForm()
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar Banner.")
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (item: Banner, status: Status) => {
    try {
      await marketingApi(`/admin/jovy/marketing/banners/${item.id}`, { method: "PUT", body: JSON.stringify({ status }) })
      setMessage(status === "published" ? "Banner publicado." : status === "archived" ? "Banner archivado." : "Banner convertido en borrador.")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el estado.")
    }
  }

  const remove = async (item: Banner) => {
    if (!window.confirm(`Eliminar lógicamente “${item.translations.es.title}”?`)) return
    try {
      await marketingApi(`/admin/jovy/marketing/banners/${item.id}`, { method: "DELETE" })
      if (editingId === item.id) resetForm()
      setMessage("Banner eliminado lógicamente.")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar Banner.")
    }
  }

  const move = async (id: string, direction: -1 | 1) => {
    const position = items.findIndex((item) => item.id === id)
    const target = position + direction
    if (target < 0 || target >= items.length) return

    const ordered = [...items]
    ;[ordered[position], ordered[target]] = [ordered[target], ordered[position]]
    try {
      await marketingApi("/admin/jovy/marketing/banners/reorder", { method: "POST", body: JSON.stringify({ ids: ordered.map((item) => item.id) }) })
      setMessage("Orden de Banners actualizado.")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo reordenar Banners.")
    }
  }

  return <div className="flex flex-col gap-y-4">
    <Container className="p-6"><div className="flex items-center justify-between gap-3"><div><Heading level="h1">Banners y promociones</Heading><p className="text-ui-fg-subtle text-sm">Slots históricos promo e hint. La frecuencia será interpretada por el storefront futuro.</p></div><Button variant="secondary" onClick={resetForm}>Nuevo Banner</Button></div>{message && <p role="alert" className="mt-3 text-ui-fg-error">{message}</p>}</Container>
    <Container className="p-6"><Heading level="h2">Elementos</Heading>{loading ? <p className="mt-4">Cargando…</p> : items.length === 0 ? <p className="mt-4 text-ui-fg-subtle">Aún no hay Banners.</p> : <ul className="mt-4 divide-y">{items.map((item, index) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{item.translations.es.title}</p><p className="text-ui-fg-subtle text-sm">{item.slot} · prioridad {item.priority} · orden {item.sort_order}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><Badge color={statusColor(item.status)}>{item.status}</Badge><Button size="small" variant="secondary" onClick={() => void move(item.id, -1)} disabled={index === 0}>Subir</Button><Button size="small" variant="secondary" onClick={() => void move(item.id, 1)} disabled={index === items.length - 1}>Bajar</Button>{item.status !== "published" && <Button size="small" variant="secondary" onClick={() => void updateStatus(item, "published")}>Publicar</Button>}{item.status === "published" && <Button size="small" variant="secondary" onClick={() => void updateStatus(item, "draft")}>Despublicar</Button>}{item.status !== "archived" && <Button size="small" variant="secondary" onClick={() => void updateStatus(item, "archived")}>Archivar</Button>}<Button size="small" variant="secondary" onClick={() => void edit(item)}>Editar</Button><Button size="small" variant="danger" onClick={() => void remove(item)}>Eliminar</Button></div></li>)}</ul>}</Container>
    <Container className="p-6"><Heading level="h2">{editingId ? "Editar Banner" : "Nuevo Banner"}</Heading><form className="mt-4 flex max-w-3xl flex-col gap-4" onSubmit={(event) => void save(event)}><div className="grid grid-cols-2 gap-3"><select aria-label="Slot Banner" value={form.slot} onChange={(event) => setForm({ ...form, slot: event.target.value as Slot })}><option value="promo">Promo</option><option value="hint">Hint</option></select><select aria-label="Frecuencia Banner" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as Frequency })}><option value="every">Cada visita</option><option value="session">Por sesión</option><option value="daily">Diaria</option></select></div><Input required aria-label="Banner título es" value={form.translations.es.title} onChange={(event) => setForm({ ...form, translations: { ...form.translations, es: { ...form.translations.es, title: event.target.value } } })} placeholder="Título ES" /><Textarea aria-label="Banner descripción es" value={form.translations.es.description ?? ""} onChange={(event) => setForm({ ...form, translations: { ...form.translations, es: { ...form.translations.es, description: event.target.value } } })} placeholder="Descripción ES" /><Input required aria-label="Texto alternativo Banner es" value={form.translations.es.alt} onChange={(event) => setForm({ ...form, translations: { ...form.translations, es: { ...form.translations.es, alt: event.target.value } } })} placeholder="Texto alternativo ES" /><Input required aria-label="Banner título en" value={form.translations.en.title} onChange={(event) => setForm({ ...form, translations: { ...form.translations, en: { ...form.translations.en, title: event.target.value } } })} placeholder="Title EN" /><Textarea aria-label="Banner descripción en" value={form.translations.en.description ?? ""} onChange={(event) => setForm({ ...form, translations: { ...form.translations, en: { ...form.translations.en, description: event.target.value } } })} placeholder="Description EN" /><Input required aria-label="Texto alternativo Banner en" value={form.translations.en.alt} onChange={(event) => setForm({ ...form, translations: { ...form.translations, en: { ...form.translations.en, alt: event.target.value } } })} placeholder="Alt text EN" /><Input aria-label="CTA Banner" value={form.cta_url ?? ""} onChange={(event) => setForm({ ...form, cta_url: event.target.value || null })} placeholder="/tienda o https://…" /><div className="grid grid-cols-2 gap-3"><Input type="datetime-local" aria-label="Inicio Banner" value={toDateTimeLocal(form.starts_at)} onChange={(event) => setForm({ ...form, starts_at: toIso(event.target.value) })} /><Input type="datetime-local" aria-label="Fin Banner" value={toDateTimeLocal(form.ends_at)} onChange={(event) => setForm({ ...form, ends_at: toIso(event.target.value) })} /></div><div className="flex flex-wrap gap-3"><select aria-label="Estado Banner" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select><label><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Activo</label><label><input type="checkbox" checked={form.auto_open} onChange={(event) => setForm({ ...form, auto_open: event.target.checked })} /> Apertura automática</label><Input type="number" min="0" max="1000" aria-label="Prioridad Banner" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /><Input type="number" min="0" aria-label="Orden Banner" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} /></div><div><label htmlFor="banner-media">Imagen Banner</label><Input id="banner-media" accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => void upload(event.target.files?.[0])} disabled={saving} />{previewUrl ? <img src={previewUrl} alt="Vista previa Banner" className="mt-3 max-h-48 rounded-md" /> : form.media_file_id && <p className="mt-2 text-ui-fg-subtle">No fue posible recuperar la vista previa del archivo asociado.</p>}</div><Button type="submit" isLoading={saving}>{editingId ? "Guardar cambios" : "Crear Banner"}</Button></form></Container>
  </div>
}
