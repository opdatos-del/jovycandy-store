import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AccountPage } from "@/features/commerce/account-page"
import { getDictionary, isLocale } from "@/lib/i18n"

type AccountRouteProps = { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "Mi cuenta | JovyCandy",
  robots: { index: false, follow: false },
}

export default async function AccountRoute({ params }: AccountRouteProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return (
    <main className="bg-[#fffaf0] pb-20 pt-28 sm:pt-32">
      <AccountPage locale={locale} dictionary={getDictionary(locale)} />
    </main>
  )
}

export const instant = false
