import { NextResponse } from "next/server"

import { StoreApiError } from "./store"

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  if (origin) {
    const http = new URL(request.url)
    if (origin !== `${http.protocol}//${host ?? http.host}`) {
      throw new ValidationError("Origen de solicitud no permitido.")
    }
  }

  const site = request.headers.get("sec-fetch-site")
  if (site && !["same-origin", "none"].includes(site)) {
    throw new ValidationError("Origen de solicitud no permitido.")
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return NextResponse.json({ message: error.message }, { status: 400 })
  }
  if (error instanceof StoreApiError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
    )
  }
  return NextResponse.json(
    { message: "No se pudo completar la operación. Intenta de nuevo." },
    { status: 500 },
  )
}

export function requiredString(value: unknown, field: string, max = 180) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`El campo ${field} es obligatorio.`)
  }
  const normalized = value.trim()
  if (normalized.length > max) throw new ValidationError(`El campo ${field} es demasiado largo.`)
  return normalized
}

export function optionalString(value: unknown, max = 180) {
  if (typeof value !== "string" || !value.trim()) return ""
  return value.trim().slice(0, max)
}

export function parseQuantity(value: unknown) {
  const quantity = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new ValidationError("La cantidad debe ser un entero entre 1 y 99.")
  }
  return quantity
}

export type AddressInput = {
  email: string
  first_name: string
  last_name: string
  address_1: string
  address_2?: string
  city: string
  province: string
  postal_code: string
  country_code: "mx"
  phone?: string
}

export function parseCustomerAddress(value: unknown) {
  if (!value || typeof value !== "object") throw new ValidationError("Faltan los datos de la dirección.")
  const input = value as Record<string, unknown>
  const postalCode = requiredString(input.postal_code, "código postal", 10)
  if (!/^\d{5}$/.test(postalCode)) {
    throw new ValidationError("El código postal debe tener 5 dígitos.")
  }
  return {
    first_name: requiredString(input.first_name, "nombre", 80),
    last_name: requiredString(input.last_name, "apellidos", 120),
    address_1: requiredString(input.address_1, "dirección", 180),
    address_2: optionalString(input.address_2),
    city: requiredString(input.city, "ciudad", 120),
    province: requiredString(input.province, "estado", 120),
    postal_code: postalCode,
    country_code: "mx",
    phone: optionalString(input.phone, 40),
  }
}

export function parseAddress(value: unknown): AddressInput {
  if (!value || typeof value !== "object") throw new ValidationError("Faltan los datos de envío.")
  const input = value as Record<string, unknown>
  const email = requiredString(input.email, "correo", 254)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("El correo no tiene un formato válido.")
  }
  const postalCode = requiredString(input.postal_code, "código postal", 10)
  if (!/^\d{5}$/.test(postalCode)) {
    throw new ValidationError("El código postal debe tener 5 dígitos.")
  }

  return {
    email,
    first_name: requiredString(input.first_name, "nombre", 80),
    last_name: requiredString(input.last_name, "apellidos", 120),
    address_1: requiredString(input.address_1, "dirección", 180),
    address_2: optionalString(input.address_2),
    city: requiredString(input.city, "ciudad", 120),
    province: requiredString(input.province, "estado", 120),
    postal_code: postalCode,
    phone: optionalString(input.phone, 40),
    country_code: "mx",
  }
}
