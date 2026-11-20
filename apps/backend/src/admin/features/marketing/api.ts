import { adminRequest } from "@admin/shared/lib/admin-api"
import type {
  AnnouncementSettings,
  Hero,
  HeroForm,
  HeroSettings,
  MarketingProduct,
} from "./types"

/**
 * Contrato del Hero corporativo y del mensaje corporativo. El mensaje se
 * persiste en la configuración de anuncios porque el Store lo consume desde
 * allí; el endpoint no se duplica en el Admin.
 */
export const marketingApi = {
  listHeroes: () => adminRequest<{ hero_items: Hero[] }>("/admin/jovy/marketing/hero"),

  getHeroSettings: () =>
    adminRequest<{ hero_settings: HeroSettings }>("/admin/jovy/marketing/hero/settings"),

  saveHeroSettings: (background_color: string) =>
    adminRequest("/admin/jovy/marketing/hero/settings", {
      method: "PUT",
      body: JSON.stringify({ background_color }),
    }),

  getHeroProduct: (id: string) =>
    adminRequest<{ product: MarketingProduct | null }>(
      `/admin/jovy/marketing/hero/${id}/product`,
    ),

  setHeroProduct: (id: string, product_id: string | null) =>
    adminRequest(`/admin/jovy/marketing/hero/${id}/product`, {
      method: "PUT",
      body: JSON.stringify({ product_id }),
    }),

  getMedia: (id: string) =>
    adminRequest<{ file: { id: string; url: string } }>(`/admin/jovy/marketing/media/${id}`),

  uploadMedia: (file: File) => {
    const body = new FormData()
    body.append("files", file)
    return adminRequest<{ file: { id: string; url: string } }>("/admin/jovy/marketing/media", {
      method: "POST",
      body,
    })
  },

  searchProducts: (query: string) =>
    adminRequest<{ products: MarketingProduct[] }>(
      `/admin/jovy/marketing/products?q=${encodeURIComponent(query)}`,
    ),

  createHero: (form: HeroForm) => {
    const { product_id: _productId, ...payload } = form
    return adminRequest<{ hero_item: Hero }>("/admin/jovy/marketing/hero", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  updateHero: (id: string, payload: Partial<Omit<HeroForm, "product_id">>) =>
    adminRequest<{ hero_item: Hero }>(`/admin/jovy/marketing/hero/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteHero: (id: string) =>
    adminRequest(`/admin/jovy/marketing/hero/${id}`, { method: "DELETE" }),

  reorderHeroes: (ids: string[]) =>
    adminRequest("/admin/jovy/marketing/hero/reorder", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  getCorporateMessage: () =>
    adminRequest<{ announcement_settings?: AnnouncementSettings }>(
      "/admin/jovy/announcements/settings",
    ),

  saveCorporateMessage: (settings: AnnouncementSettings) =>
    adminRequest("/admin/jovy/announcements/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
}
