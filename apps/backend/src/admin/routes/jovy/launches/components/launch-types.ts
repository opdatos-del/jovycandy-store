/** Lanzamiento administrado por el módulo `jovy-launches`. */
export type Launch = {
  id: string
  product_id: string | null
  title: string
  description: string | null
  image_file_id: string | null
  image_url: string | null
  image_resolved_url: string | null
  sort_order: number
  active: boolean
}

export type ProductOption = { id: string; title: string; thumbnail?: string | null }

export type LaunchSettings = { background_color: string }

export type LaunchDraft = {
  title: string
  description: string
  product: ProductOption | null
  image_file_id: string | null
  image_url: string
  preview_url: string | null
  active: boolean
}

export const emptyLaunchDraft = (): LaunchDraft => ({
  title: "",
  description: "",
  product: null,
  image_file_id: null,
  image_url: "",
  preview_url: null,
  active: true,
})

export const draftFromLaunch = (launch: Launch, product: ProductOption | null): LaunchDraft => ({
  title: launch.title,
  description: launch.description ?? "",
  product,
  image_file_id: launch.image_file_id,
  image_url: launch.image_url ?? "",
  preview_url: launch.image_resolved_url,
  active: launch.active,
})
