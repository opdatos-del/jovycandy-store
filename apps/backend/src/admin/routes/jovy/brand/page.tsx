import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Textarea } from "@medusajs/ui"
import { useEffect, useState, type FormEvent } from "react"

type Status = "draft" | "published" | "archived"
type Gallery = {
  id: string
  title: string | null
  description: string | null
  media_file_id: string
  media_url: string | null
  status: Status
  enabled: boolean
  sort_order: number
  starts_at: string | null
  ends_at: string | null
}
type Crop = { zoom: number; offset_x: number; offset_y: number }
type Logo = {
  id: string
  slug: string
  name: string
  alt: string | null
  families: string[] | null
  media_file_id: string
  media_url: string | null
  crop: Crop | null
  enabled: boolean
  sort_order: number
}
type GalleryForm = Omit<Gallery, "id" | "media_url">
type LogoForm = Omit<Logo, "id" | "media_url"> & { families_text: string }

const emptyGallery = (): GalleryForm => ({
  title: "",
  description: "",
  media_file_id: "",
  status: "draft",
  enabled: true,
  sort_order: 0,
  starts_at: null,
  ends_at: null,
})
const emptyLogo = (): LogoForm => ({
  slug: "",
  name: "",
  alt: "",
  families: null,
  families_text: "",
  media_file_id: "",
  crop: { zoom: 1, offset_x: 0, offset_y: 0 },
  enabled: true,
  sort_order: 0,
})
const localDate = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : ""
const isoDate = (value: string) => value ? new Date(value).toISOString() : null

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { ...init?.headers, ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }) },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Operación no disponible" })) as { message?: string }
    throw new Error(body.message || "Operación no disponible")
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

const BrandPage = () => {
  const [section, setSection] = useState<"gallery" | "logos">("gallery")
  const [gallery, setGallery] = useState<Gallery[]>([])
  const [logos, setLogos] = useState<Logo[]>([])
  const [galleryForm, setGalleryForm] = useState<GalleryForm>(emptyGallery())
  const [logoForm, setLogoForm] = useState<LogoForm>(emptyLogo())
  const [galleryEditing, setGalleryEditing] = useState<string | null>(null)
  const [logoEditing, setLogoEditing] = useState<string | null>(null)
  const [galleryPreview, setGalleryPreview] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [galleryResponse, logoResponse] = await Promise.all([
        api<{ items: Gallery[] }>("/admin/jovy/brand/gallery"),
        api<{ logos: Logo[] }>("/admin/jovy/brand/logos"),
      ])
      setGallery(galleryResponse.items)
      setLogos(logoResponse.logos)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar Marca Jovy.")
    }
  }

  useEffect(() => { void load() }, [])

  const upload = async (file: File | undefined, target: "gallery" | "logo") => {
    if (!file) return
    setSaving(true)
    setMessage(null)
    try {
      const body = new FormData()
      body.append("files", file)
      const result = await api<{ file: { id: string; url?: string } }>("/admin/jovy/marketing/media", { method: "POST", body })
      if (target === "gallery") {
        setGalleryForm((form) => ({ ...form, media_file_id: result.file.id }))
        setGalleryPreview(result.file.url || URL.createObjectURL(file))
      } else {
        setLogoForm((form) => ({ ...form, media_file_id: result.file.id }))
        setLogoPreview(result.file.url || URL.createObjectURL(file))
      }
      setMessage("Imagen cargada; guarda el formulario para asociarla al contenido.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el archivo.")
    } finally {
      setSaving(false)
    }
  }

  const resetGallery = () => {
    setGalleryEditing(null)
    setGalleryForm(emptyGallery())
    setGalleryPreview(null)
  }
  const resetLogo = () => {
    setLogoEditing(null)
    setLogoForm(emptyLogo())
    setLogoPreview(null)
  }

  const editGallery = (item: Gallery) => {
    setSection("gallery")
    setGalleryEditing(item.id)
    setGalleryForm({
      title: item.title || "",
      description: item.description || "",
      media_file_id: item.media_file_id,
      status: item.status,
      enabled: item.enabled,
      sort_order: item.sort_order,
      starts_at: item.starts_at,
      ends_at: item.ends_at,
    })
    setGalleryPreview(item.media_url)
  }
  const editLogo = (logo: Logo) => {
    setSection("logos")
    setLogoEditing(logo.id)
    setLogoForm({
      slug: logo.slug,
      name: logo.name,
      alt: logo.alt || "",
      families: logo.families,
      families_text: logo.families?.join(", ") || "",
      media_file_id: logo.media_file_id,
      crop: logo.crop || { zoom: 1, offset_x: 0, offset_y: 0 },
      enabled: logo.enabled,
      sort_order: logo.sort_order,
    })
    setLogoPreview(logo.media_url)
  }

  const saveGallery = async (event: FormEvent) => {
    event.preventDefault()
    if (!galleryForm.media_file_id) return setMessage("Selecciona una imagen válida para la galería.")
    setSaving(true)
    try {
      await api(galleryEditing ? `/admin/jovy/brand/gallery/${galleryEditing}` : "/admin/jovy/brand/gallery", {
        method: galleryEditing ? "PUT" : "POST",
        body: JSON.stringify({ ...galleryForm, starts_at: isoDate(localDate(galleryForm.starts_at)), ends_at: isoDate(localDate(galleryForm.ends_at)) }),
      })
      setMessage("Galería guardada.")
      resetGallery()
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la galería.")
    } finally {
      setSaving(false)
    }
  }

  const saveLogo = async (event: FormEvent) => {
    event.preventDefault()
    if (!logoForm.media_file_id) return setMessage("Selecciona una imagen válida para el logo.")
    setSaving(true)
    try {
      const { families_text, ...logoPayload } = logoForm
      await api(logoEditing ? `/admin/jovy/brand/logos/${logoEditing}` : "/admin/jovy/brand/logos", {
        method: logoEditing ? "PUT" : "POST",
        body: JSON.stringify({
          ...logoPayload,
          families: families_text.split(",").map((family) => family.trim()).filter(Boolean),
        }),
      })
      setMessage("Logo guardado.")
      resetLogo()
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el logo.")
    } finally {
      setSaving(false)
    }
  }

  const patchGallery = async (item: Gallery, patch: Partial<GalleryForm>) => {
    try {
      await api(`/admin/jovy/brand/gallery/${item.id}`, { method: "PUT", body: JSON.stringify(patch) })
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar la galería.") }
  }
  const patchLogo = async (logo: Logo, patch: Partial<LogoForm>) => {
    try {
      await api(`/admin/jovy/brand/logos/${logo.id}`, { method: "PUT", body: JSON.stringify(patch) })
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar el logo.") }
  }
  const remove = async (resource: "gallery" | "logos", id: string) => {
    if (!window.confirm("¿Eliminar lógicamente este registro? El archivo compartido no se eliminará.")) return
    try {
      await api(`/admin/jovy/brand/${resource}/${id}`, { method: "DELETE" })
      if (resource === "gallery") resetGallery(); else resetLogo()
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo eliminar el registro.") }
  }
  const reorder = async (resource: "gallery" | "logos", ids: string[]) => {
    try {
      await api(`/admin/jovy/brand/${resource}/reorder`, { method: "POST", body: JSON.stringify({ ids }) })
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo reordenar.") }
  }
  const move = (resource: "gallery" | "logos", index: number, direction: -1 | 1) => {
    const items = resource === "gallery" ? gallery : logos
    const next = index + direction
    if (next < 0 || next >= items.length) return
    const ids = items.map((item) => item.id)
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    void reorder(resource, ids)
  }

  const activeCrop = logoForm.crop || { zoom: 1, offset_x: 0, offset_y: 0 }
  return <div className="flex flex-col gap-y-4">
    <Container className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Heading level="h1">Marca Jovy</Heading><p className="text-ui-fg-subtle text-sm">Galería Casa Jovy y logos corporativos administrados desde Medusa.</p></div>
        <div className="flex gap-2"><Button variant={section === "gallery" ? "primary" : "secondary"} onClick={() => setSection("gallery")}>Galería Casa Jovy</Button><Button variant={section === "logos" ? "primary" : "secondary"} onClick={() => setSection("logos")}>Logos</Button></div>
      </div>
      {message && <p role="alert" className="mt-3 text-ui-fg-error">{message}</p>}
    </Container>

    {section === "gallery" ? <>
      <Container className="p-6"><div className="flex items-center justify-between"><Heading level="h2">Elementos de galería</Heading><Button variant="secondary" onClick={resetGallery}>Nuevo elemento</Button></div>
        {gallery.length === 0 ? <p className="mt-4 text-ui-fg-subtle">Aún no hay elementos de galería.</p> : <ul className="mt-4 divide-y">{gallery.map((item, index) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="flex items-center gap-3">{item.media_url ? <img src={item.media_url} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-ui-bg-subtle" />}<div><p className="font-medium">{item.title || "Sin título"}</p><p className="text-ui-fg-subtle text-sm">Orden {item.sort_order} · {item.enabled ? "activo" : "inactivo"}</p></div></div><div className="flex flex-wrap items-center gap-2"><Badge color={item.status === "published" ? "green" : item.status === "archived" ? "grey" : "orange"}>{item.status}</Badge><Button size="small" variant="secondary" onClick={() => void move("gallery", index, -1)} disabled={index === 0}>Subir</Button><Button size="small" variant="secondary" onClick={() => void move("gallery", index, 1)} disabled={index === gallery.length - 1}>Bajar</Button>{item.status !== "published" && <Button size="small" variant="secondary" onClick={() => void patchGallery(item, { status: "published" })}>Publicar</Button>}{item.status === "published" && <Button size="small" variant="secondary" onClick={() => void patchGallery(item, { status: "draft" })}>Despublicar</Button>}{item.status !== "archived" && <Button size="small" variant="secondary" onClick={() => void patchGallery(item, { status: "archived" })}>Archivar</Button>}<Button size="small" variant="secondary" onClick={() => void patchGallery(item, { enabled: !item.enabled })}>{item.enabled ? "Desactivar" : "Activar"}</Button><Button size="small" variant="secondary" onClick={() => editGallery(item)}>Editar</Button><Button size="small" variant="danger" onClick={() => void remove("gallery", item.id)}>Eliminar</Button></div></li>)}</ul>}
      </Container>
      <Container className="p-6"><Heading level="h2">{galleryEditing ? "Editar elemento" : "Nuevo elemento"}</Heading><form className="mt-4 flex max-w-3xl flex-col gap-4" onSubmit={saveGallery}>
        <Input aria-label="Título galería" value={galleryForm.title || ""} onChange={(event) => setGalleryForm({ ...galleryForm, title: event.target.value || null })} />
        <Textarea aria-label="Descripción galería" value={galleryForm.description || ""} onChange={(event) => setGalleryForm({ ...galleryForm, description: event.target.value || null })} />
        <label>Imagen de galería <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void upload(event.target.files?.[0], "gallery")} /></label>
        {galleryPreview && <img src={galleryPreview} alt="Vista previa de galería" className="max-h-48 max-w-sm rounded object-cover" />}
        <div className="grid grid-cols-2 gap-3"><select aria-label="Estado galería" value={galleryForm.status} onChange={(event) => setGalleryForm({ ...galleryForm, status: event.target.value as Status })}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select><label><input type="checkbox" checked={galleryForm.enabled} onChange={(event) => setGalleryForm({ ...galleryForm, enabled: event.target.checked })} /> Activo</label></div>
        <div className="grid grid-cols-3 gap-3"><Input type="number" min="0" aria-label="Orden galería" value={galleryForm.sort_order} onChange={(event) => setGalleryForm({ ...galleryForm, sort_order: Number(event.target.value) })} /><Input type="datetime-local" aria-label="Inicio galería" value={localDate(galleryForm.starts_at)} onChange={(event) => setGalleryForm({ ...galleryForm, starts_at: isoDate(event.target.value) })} /><Input type="datetime-local" aria-label="Fin galería" value={localDate(galleryForm.ends_at)} onChange={(event) => setGalleryForm({ ...galleryForm, ends_at: isoDate(event.target.value) })} /></div>
        <div className="flex gap-2"><Button type="submit" isLoading={saving}>{galleryEditing ? "Guardar cambios" : "Crear elemento"}</Button>{galleryEditing && <Button type="button" variant="secondary" onClick={resetGallery}>Cancelar</Button>}</div>
      </form></Container>
    </> : <>
      <Container className="p-6"><div className="flex items-center justify-between"><Heading level="h2">Logos</Heading><Button variant="secondary" onClick={resetLogo}>Nuevo logo</Button></div>
        {logos.length === 0 ? <p className="mt-4 text-ui-fg-subtle">Aún no hay logos.</p> : <ul className="mt-4 divide-y">{logos.map((logo, index) => <li key={logo.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="flex items-center gap-3">{logo.media_url ? <img src={logo.media_url} alt="" className="h-12 w-12 rounded object-contain" /> : <div className="h-12 w-12 rounded bg-ui-bg-subtle" />}<div><p className="font-medium">{logo.name}</p><p className="text-ui-fg-subtle text-sm">{logo.families?.join(", ") || "Sin familia editorial"}</p></div></div><div className="flex flex-wrap items-center gap-2"><Badge color={logo.enabled ? "green" : "grey"}>{logo.enabled ? "activo" : "inactivo"}</Badge><Button size="small" variant="secondary" onClick={() => void move("logos", index, -1)} disabled={index === 0}>Subir</Button><Button size="small" variant="secondary" onClick={() => void move("logos", index, 1)} disabled={index === logos.length - 1}>Bajar</Button><Button size="small" variant="secondary" onClick={() => void patchLogo(logo, { enabled: !logo.enabled })}>{logo.enabled ? "Desactivar" : "Activar"}</Button><Button size="small" variant="secondary" onClick={() => editLogo(logo)}>Editar</Button><Button size="small" variant="danger" onClick={() => void remove("logos", logo.id)}>Eliminar</Button></div></li>)}</ul>}
      </Container>
      <Container className="p-6"><Heading level="h2">{logoEditing ? "Editar logo" : "Nuevo logo"}</Heading><form className="mt-4 flex max-w-3xl flex-col gap-4" onSubmit={saveLogo}>
        <div className="grid grid-cols-2 gap-3"><Input required aria-label="Slug logo" value={logoForm.slug} onChange={(event) => setLogoForm({ ...logoForm, slug: event.target.value })} placeholder="marca-corporativa" /><Input required aria-label="Nombre logo" value={logoForm.name} onChange={(event) => setLogoForm({ ...logoForm, name: event.target.value })} /></div>
        <Input aria-label="Texto alternativo logo" value={logoForm.alt || ""} onChange={(event) => setLogoForm({ ...logoForm, alt: event.target.value || null })} /><Input aria-label="Familias logo" value={logoForm.families_text} onChange={(event) => setLogoForm({ ...logoForm, families_text: event.target.value })} placeholder="familia-a, familia-b" />
        <label>Archivo de logo <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void upload(event.target.files?.[0], "logo")} /></label>
        {logoPreview && <div className="h-48 w-full overflow-hidden rounded bg-ui-bg-subtle"><img src={logoPreview} alt="Vista previa de recorte de logo" className="h-full w-full object-contain" style={{ objectPosition: `${50 + activeCrop.offset_x / 100}% ${50 + activeCrop.offset_y / 100}%`, transform: `scale(${activeCrop.zoom})` }} /></div>}
        <div className="grid grid-cols-3 gap-3"><Input type="number" min="0.25" max="2" step="0.05" aria-label="Zoom logo" value={activeCrop.zoom} onChange={(event) => setLogoForm({ ...logoForm, crop: { ...activeCrop, zoom: Number(event.target.value) } })} /><Input type="number" min="-5000" max="5000" aria-label="Desplazamiento X logo" value={activeCrop.offset_x} onChange={(event) => setLogoForm({ ...logoForm, crop: { ...activeCrop, offset_x: Number(event.target.value) } })} /><Input type="number" min="-5000" max="5000" aria-label="Desplazamiento Y logo" value={activeCrop.offset_y} onChange={(event) => setLogoForm({ ...logoForm, crop: { ...activeCrop, offset_y: Number(event.target.value) } })} /></div>
        <div className="flex gap-3"><label><input type="checkbox" checked={logoForm.enabled} onChange={(event) => setLogoForm({ ...logoForm, enabled: event.target.checked })} /> Activo</label><Input type="number" min="0" aria-label="Orden logo" value={logoForm.sort_order} onChange={(event) => setLogoForm({ ...logoForm, sort_order: Number(event.target.value) })} /></div>
        <div className="flex gap-2"><Button type="submit" isLoading={saving}>{logoEditing ? "Guardar cambios" : "Crear logo"}</Button>{logoEditing && <Button type="button" variant="secondary" onClick={resetLogo}>Cancelar</Button>}</div>
      </form></Container>
    </>}
  </div>
}

export const config = defineRouteConfig({ label: "Marca Jovy" })
export default BrandPage
