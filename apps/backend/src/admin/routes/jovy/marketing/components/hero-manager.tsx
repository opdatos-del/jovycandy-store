import { Badge, Button, Container, Heading, Input, Textarea } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { marketingApi, toDateTimeLocal, toIso } from "./admin-api"

type Status = "draft" | "published" | "archived"
type Product = { id: string; title: string; thumbnail: string | null }
type Hero = {
  id: string
  status: Status
  enabled: boolean
  sort_order: number
  background_color: string | null
  cta_url: string | null
  media_file_id: string | null
  starts_at: string | null
  ends_at: string | null
  translations: {
    es: { title: string; description?: string; cta_label?: string }
    en: { title: string; description?: string; cta_label?: string }
  }
}
type HeroForm = Omit<Hero, "id"> & { product_id: string | null }

const emptyHero = (): HeroForm => ({
  status: "draft",
  enabled: true,
  sort_order: 0,
  background_color: null,
  cta_url: null,
  media_file_id: null,
  starts_at: null,
  ends_at: null,
  product_id: null,
  translations: {
    es: { title: "", description: "", cta_label: "" },
    en: { title: "", description: "", cta_label: "" },
  },
})

const statusColor = (status: Status) => status === "published" ? "green" : status === "archived" ? "grey" : "orange"

export const HeroManager = () => {
  const [items, setItems] = useState<Hero[]>([])
  const [form, setForm] = useState<HeroForm>(emptyHero())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [productDirty, setProductDirty] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [productQuery, setProductQuery] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [settingsColor, setSettingsColor] = useState("#00AFAA")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [heroes, settings] = await Promise.all([
        marketingApi<{ hero_items: Hero[] }>("/admin/jovy/marketing/hero"),
        marketingApi<{ hero_settings: { background_color: string } }>("/admin/jovy/marketing/hero/settings"),
      ])
      setItems(heroes.hero_items)
      setSettingsColor(settings.hero_settings.background_color)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible cargar Hero.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyHero())
    setProduct(null)
    setProductDirty(false)
    setProducts([])
    setProductQuery("")
    setPreviewUrl(null)
  }

  const edit = async (item: Hero) => {
    setEditingId(item.id)
    setForm({ ...item, product_id: null })
    setProductDirty(false)
    setProducts([])
    setPreviewUrl(null)

    try {
      const [linked, media] = await Promise.all([
        marketingApi<{ product: Product | null }>(`/admin/jovy/marketing/hero/${item.id}/product`),
        item.media_file_id
          ? marketingApi<{ file: { url: string } }>(`/admin/jovy/marketing/media/${item.media_file_id}`).catch(() => null)
          : Promise.resolve(null),
      ])
      setProduct(linked.product)
      setPreviewUrl(media?.file.url ?? null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible abrir el Hero.")
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

  const searchProducts = async () => {
    try {
      const result = await marketingApi<{ products: Product[] }>(`/admin/jovy/marketing/products?q=${encodeURIComponent(productQuery)}`)
      setProducts(result.products)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible buscar productos.")
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const { product_id: selectedProductId, ...payload } = form
      const body = {
        ...payload,
        starts_at: toIso(toDateTimeLocal(form.starts_at)),
        ends_at: toIso(toDateTimeLocal(form.ends_at)),
      }
      const result = editingId
        ? await marketingApi<{ hero_item: Hero }>(`/admin/jovy/marketing/hero/${editingId}`, { method: "PUT", body: JSON.stringify(body) })
        : await marketingApi<{ hero_item: Hero }>("/admin/jovy/marketing/hero", { method: "POST", body: JSON.stringify(body) })
      const heroId = editingId ?? result.hero_item.id

      if (productDirty || (!editingId && selectedProductId !== null)) {
        await marketingApi(`/admin/jovy/marketing/hero/${heroId}/product`, {
          method: "PUT",
          body: JSON.stringify({ product_id: selectedProductId }),
        })
      }

      setMessage("Hero guardado.")
      resetForm()
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar Hero.")
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (item: Hero, status: Status) => {
    try {
      await marketingApi(`/admin/jovy/marketing/hero/${item.id}`, { method: "PUT", body: JSON.stringify({ status }) })
      setMessage(status === "published" ? "Hero publicado." : status === "archived" ? "Hero archivado." : "Hero convertido en borrador.")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el estado.")
    }
  }

  const remove = async (item: Hero) => {
    if (!window.confirm(`Eliminar lógicamente “${item.translations.es.title}”?`)) return
    try {
      await marketingApi(`/admin/jovy/marketing/hero/${item.id}`, { method: "DELETE" })
      if (editingId === item.id) resetForm()
      setMessage("Hero eliminado lógicamente.")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar Hero.")
    }
  }

  const move = async (id: string, direction: -1 | 1) => {
    const position = items.findIndex((item) => item.id === id)
    const target = position + direction
    if (target < 0 || target >= items.length) return

    const ordered = [...items]
    ;[ordered[position], ordered[target]] = [ordered[target], ordered[position]]
    try {
      await marketingApi("/admin/jovy/marketing/hero/reorder", { method: "POST", body: JSON.stringify({ ids: ordered.map((item) => item.id) }) })
      setMessage("Orden de Hero actualizado.")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo reordenar Hero.")
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await marketingApi("/admin/jovy/marketing/hero/settings", { method: "PUT", body: JSON.stringify({ background_color: settingsColor }) })
      setMessage("Color global guardado.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el color global.")
    } finally {
      setSaving(false)
    }
  }

  return <div className="flex flex-col gap-y-4">
    <Container className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div><Heading level="h1">Hero corporativo</Heading><p className="text-ui-fg-subtle text-sm">Contenido bilingüe, programación, multimedia y producto destacado.</p></div>
        <Button variant="secondary" onClick={resetForm}>Nuevo Hero</Button>
      </div>
      {message && <p role="alert" className="mt-3 text-ui-fg-error">{message}</p>}
    </Container>

    <Container className="p-6">
      <Heading level="h2">Elementos</Heading>
      {loading ? <p className="mt-4">Cargando…</p> : items.length === 0 ? <p className="mt-4 text-ui-fg-subtle">Aún no hay elementos Hero.</p> : <ul className="mt-4 divide-y">
        {items.map((item, index) => <li key={item.id} className="flex items-center justify-between gap-3 py-3">
          <div><p className="font-medium">{item.translations.es.title}</p><p className="text-ui-fg-subtle text-sm">Orden {item.sort_order} · {item.enabled ? "Activo" : "Inactivo"}</p></div>
          <div className="flex flex-wrap items-center justify-end gap-2"><Badge color={statusColor(item.status)}>{item.status}</Badge>
            <Button size="small" variant="secondary" onClick={() => void move(item.id, -1)} disabled={index === 0}>Subir</Button>
            <Button size="small" variant="secondary" onClick={() => void move(item.id, 1)} disabled={index === items.length - 1}>Bajar</Button>
            {item.status !== "published" && <Button size="small" variant="secondary" onClick={() => void updateStatus(item, "published")}>Publicar</Button>}
            {item.status === "published" && <Button size="small" variant="secondary" onClick={() => void updateStatus(item, "draft")}>Despublicar</Button>}
            {item.status !== "archived" && <Button size="small" variant="secondary" onClick={() => void updateStatus(item, "archived")}>Archivar</Button>}
            <Button size="small" variant="secondary" onClick={() => void edit(item)}>Editar</Button><Button size="small" variant="danger" onClick={() => void remove(item)}>Eliminar</Button>
          </div>
        </li>)}
      </ul>}
    </Container>

    <Container className="p-6">
      <Heading level="h2">{editingId ? "Editar Hero" : "Nuevo Hero"}</Heading>
      <form className="mt-4 flex max-w-3xl flex-col gap-4" onSubmit={(event) => void save(event)}>
        <Input required aria-label="Hero título es" value={form.translations.es.title} onChange={(event) => setForm({ ...form, translations: { ...form.translations, es: { ...form.translations.es, title: event.target.value } } })} placeholder="Título ES" />
        <Textarea aria-label="Hero descripción es" value={form.translations.es.description ?? ""} onChange={(event) => setForm({ ...form, translations: { ...form.translations, es: { ...form.translations.es, description: event.target.value } } })} placeholder="Descripción ES" />
        <Input required aria-label="Hero título en" value={form.translations.en.title} onChange={(event) => setForm({ ...form, translations: { ...form.translations, en: { ...form.translations.en, title: event.target.value } } })} placeholder="Title EN" />
        <Textarea aria-label="Hero descripción en" value={form.translations.en.description ?? ""} onChange={(event) => setForm({ ...form, translations: { ...form.translations, en: { ...form.translations.en, description: event.target.value } } })} placeholder="Description EN" />
        <Input aria-label="CTA Hero" value={form.cta_url ?? ""} onChange={(event) => setForm({ ...form, cta_url: event.target.value || null })} placeholder="/tienda o https://…" />
        <Input aria-label="Color Hero" value={form.background_color ?? ""} onChange={(event) => setForm({ ...form, background_color: event.target.value || null })} placeholder="#00AFAA" />
        <div className="grid grid-cols-2 gap-3"><Input type="datetime-local" aria-label="Inicio Hero" value={toDateTimeLocal(form.starts_at)} onChange={(event) => setForm({ ...form, starts_at: toIso(event.target.value) })} /><Input type="datetime-local" aria-label="Fin Hero" value={toDateTimeLocal(form.ends_at)} onChange={(event) => setForm({ ...form, ends_at: toIso(event.target.value) })} /></div>
        <div className="flex flex-wrap gap-3"><select aria-label="Estado Hero" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select><label><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Activo</label><Input type="number" min="0" aria-label="Orden Hero" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} /></div>
        <div><label htmlFor="hero-media">Imagen Hero</label><Input id="hero-media" accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => void upload(event.target.files?.[0])} disabled={saving} />{previewUrl ? <img src={previewUrl} alt="Vista previa Hero" className="mt-3 max-h-48 rounded-md" /> : form.media_file_id && <p className="mt-2 text-ui-fg-subtle">No fue posible recuperar la vista previa del archivo asociado.</p>}</div>
        <div className="border-ui-border-base rounded-md border p-3"><p className="font-medium">Producto destacado</p>{product ? <div className="mt-2 flex flex-wrap items-center gap-3">{product.thumbnail && <img src={product.thumbnail} alt="" className="h-10 w-10 rounded object-cover" />}<span>{product.title}</span><Button type="button" size="small" variant="secondary" onClick={() => { setProduct(null); setForm({ ...form, product_id: null }); setProductDirty(true) }}>Retirar</Button></div> : <><div className="mt-2 flex gap-2"><Input aria-label="Buscar producto" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} /><Button type="button" variant="secondary" onClick={() => void searchProducts()}>Buscar</Button></div>{products.length > 0 && <ul className="mt-2">{products.map((candidate) => <li key={candidate.id}><Button type="button" variant="transparent" onClick={() => { setProduct(candidate); setForm({ ...form, product_id: candidate.id }); setProductDirty(true) }}>{candidate.title}</Button></li>)}</ul>}</>}</div>
        <Button type="submit" isLoading={saving}>{editingId ? "Guardar cambios" : "Crear Hero"}</Button>
      </form>
    </Container>

    <Container className="p-6"><Heading level="h2">Color global</Heading><div className="mt-3 flex max-w-md gap-2"><Input aria-label="Color global Hero" value={settingsColor} onChange={(event) => setSettingsColor(event.target.value)} /><Button isLoading={saving} onClick={() => void saveSettings()}>Guardar</Button></div></Container>
  </div>
}
