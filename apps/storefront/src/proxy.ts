import { NextResponse, type NextRequest } from "next/server"

import { defaultLocale, locales } from "@/lib/i18n"

const PUBLIC_FILE = /\.[^/]+$/

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/videos") ||
    pathname.startsWith("/brand") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next()
  }

  const firstSegment = pathname.split("/")[1]
  if (locales.includes(firstSegment as (typeof locales)[number])) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!api|_next|assets|videos|brand|.*\\..*).*)"],
}
