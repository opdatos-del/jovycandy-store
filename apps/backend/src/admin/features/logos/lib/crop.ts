import { CROP_MAX_OFFSET, CROP_MAX_ZOOM, CROP_MIN_ZOOM, type Crop } from "@admin/features/logos/types"

/**
 * Helpers de presentación del recorte. El recorte es metadata: solo transforma
 * la vista previa y el archivo original nunca se modifica.
 */
export function cropForPreview(crop: Crop): Pick<CSSStyleDeclaration, "transform"> {
  return { transform: `translate(${crop.offset_x}%, ${crop.offset_y}%) scale(${crop.zoom})` }
}

export const clampZoom = (value: number) => Math.max(CROP_MIN_ZOOM, Math.min(CROP_MAX_ZOOM, Math.round(value * 100) / 100))
export const clampOffset = (value: number) => Math.max(-CROP_MAX_OFFSET, Math.min(CROP_MAX_OFFSET, Math.round(value)))
export const clampCrop = (crop: Crop): Crop => ({
  zoom: clampZoom(crop.zoom),
  offset_x: clampOffset(crop.offset_x),
  offset_y: clampOffset(crop.offset_y),
})
