import { Skeleton } from "@/components/ui/skeleton"

export default function CheckoutLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <Skeleton width={220} height={12} />
      <Skeleton className="mt-3" width={300} height={40} />
      <Skeleton className="mt-4" width="min(560px, 80%)" height={14} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4">
          <Skeleton width={360} height={36} />
          <Skeleton height={430} />
        </div>
        <Skeleton height={260} />
      </div>
    </main>
  )
}
