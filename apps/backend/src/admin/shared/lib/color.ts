/** `#RGB` o `#RRGGBB`, la misma regla que valida el backend. */
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export const isValidHexColor = (value: string) => HEX_COLOR_PATTERN.test(value)

/** `input[type=color]` solo admite `#rrggbb`; se expande el formato corto. */
export function expandHexColor(value: string) {
  if (!isValidHexColor(value)) return "#00afaa"
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase()
  }
  return value.toLowerCase()
}
