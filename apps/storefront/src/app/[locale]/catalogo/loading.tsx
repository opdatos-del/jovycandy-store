import { Skeleton } from "@/components/ui/skeleton"

export default function CatalogLoading() {
  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <Skeleton width={220} height={14} />
      <Skeleton className="mt-4" width="min(420px, 70%)" height={44} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <Skeleton height={420} />
        </aside>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="grid gap-3">
              <Skeleton className="aspect-square" />
              <Skeleton width="80%" height={12} />
              <Skeleton width="40%" height={12} />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
