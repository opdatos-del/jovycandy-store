export type HeroStatus = "draft" | "published" | "archived"

export type MarketingProduct = {
  id: string
  title: string
  thumbnail: string | null
}

export type HeroTranslation = {
  title: string
  description?: string
  cta_label?: string
}

export type Hero = {
  id: string
  status: HeroStatus
  enabled: boolean
  sort_order: number
  background_color: string | null
  cta_url: string | null
  media_file_id: string | null
  starts_at: string | null
  ends_at: string | null
  translations: {
    es: HeroTranslation
    en: HeroTranslation
  }
}

export type HeroForm = Omit<Hero, "id"> & { product_id: string | null }

export type HeroSettings = { background_color: string }

export type AnnouncementSettings = {
  corporate_message_es: string | null
  corporate_message_en: string | null
}

export const emptyHero = (): HeroForm => ({
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
