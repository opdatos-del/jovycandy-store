import { useEffect, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { marketingApi } from "../api"
import { emptyHero, type Hero, type HeroForm, type HeroStatus, type MarketingProduct } from "../types"

/**
 * Estado de la pantalla Hero: lista, ajustes globales y formulario. La
 * confirmación de borrado queda en el componente porque pertenece al Prompt de
 * Medusa; aquí solo se ejecuta la mutación ya confirmada.
 */
export function useHero() {
  const [items, setItems] = useState<Hero[]>([])
  const [form, setForm] = useState<HeroForm>(emptyHero())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [product, setProduct] = useState<MarketingProduct | null>(null)
  const [productDirty, setProductDirty] = useState(false)
  const [products, setProducts] = useState<MarketingProduct[]>([])
  const [productQuery, setProductQuery] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [settingsColor, setSettingsColor] = useState("#00AFAA")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [heroes, settings] = await Promise.all([
        marketingApi.listHeroes(),
        marketingApi.getHeroSettings(),
      ])
      setItems(heroes.hero_items)
      setSettingsColor(settings.hero_settings.background_color)
    } catch (error) {
      setMessage(errorMessage(error, "No fue posible cargar Hero."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

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
        marketingApi.getHeroProduct(item.id),
        item.media_file_id
          ? marketingApi.getMedia(item.media_file_id).catch(() => null)
          : Promise.resolve(null),
      ])
      setProduct(linked.product)
      setPreviewUrl(media?.file.url ?? null)
    } catch (error) {
      setMessage(errorMessage(error, "No fue posible abrir el Hero."))
    }
  }

  const upload = async (file?: File) => {
    if (!file) return

    setSaving(true)
    try {
      const result = await marketingApi.uploadMedia(file)
      setForm((current) => ({ ...current, media_file_id: result.file.id }))
      setPreviewUrl(result.file.url)
      setMessage("Imagen cargada y lista para guardar.")
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo cargar la imagen."))
    } finally {
      setSaving(false)
    }
  }

  const searchProducts = async () => {
    try {
      const result = await marketingApi.searchProducts(productQuery)
      setProducts(result.products)
    } catch (error) {
      setMessage(errorMessage(error, "No fue posible buscar productos."))
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = editingId
        ? await marketingApi.updateHero(editingId, form)
        : await marketingApi.createHero(form)
      const heroId = editingId ?? result.hero_item.id

      if (productDirty || (!editingId && form.product_id !== null)) {
        await marketingApi.setHeroProduct(heroId, form.product_id)
      }

      setMessage("Hero guardado.")
      resetForm()
      await load()
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo guardar Hero."))
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (item: Hero, status: HeroStatus) => {
    try {
      await marketingApi.updateHero(item.id, { status })
      setMessage(
        status === "published"
          ? "Hero publicado."
          : status === "archived"
            ? "Hero archivado."
            : "Hero convertido en borrador.",
      )
      await load()
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo actualizar el estado."))
    }
  }

  const remove = async (item: Hero) => {
    setDeletingId(item.id)
    try {
      await marketingApi.deleteHero(item.id)
      if (editingId === item.id) resetForm()
      setMessage("Hero eliminado.")
      await load()
      requestAnimationFrame(() => document.getElementById("hero-list-heading")?.focus())
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo eliminar Hero."))
    } finally {
      setDeletingId(null)
    }
  }

  const move = async (id: string, direction: -1 | 1) => {
    const position = items.findIndex((item) => item.id === id)
    const target = position + direction
    if (target < 0 || target >= items.length) return

    const ordered = [...items]
    ;[ordered[position], ordered[target]] = [ordered[target], ordered[position]]
    try {
      await marketingApi.reorderHeroes(ordered.map((item) => item.id))
      setMessage("Orden de Hero actualizado.")
      await load()
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo reordenar Hero."))
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await marketingApi.saveHeroSettings(settingsColor)
      setMessage("Color global guardado.")
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo guardar el color global."))
    } finally {
      setSaving(false)
    }
  }

  const setProductAndDirty = (candidate: MarketingProduct | null) => {
    setProduct(candidate)
    setForm((current) => ({ ...current, product_id: candidate?.id ?? null }))
    setProductDirty(true)
  }

  return {
    items,
    form,
    setForm,
    editingId,
    product,
    setProduct: setProductAndDirty,
    products,
    productQuery,
    setProductQuery,
    previewUrl,
    settingsColor,
    setSettingsColor,
    loading,
    saving,
    deletingId,
    message,
    resetForm,
    edit,
    upload,
    searchProducts,
    save,
    updateStatus,
    remove,
    move,
    saveSettings,
  }
}
