import { Skeleton } from "@/components/ui/skeleton"

export default function CartLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <Skeleton width={200} height={12} />
      <Skeleton className="mt-3" width={260} height={40} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[88px_minmax(0,1fr)] gap-4">
              <Skeleton className="aspect-square" />
              <div className="grid gap-2">
                <Skeleton width="55%" height={16} />
                <Skeleton width="25%" height={12} />
                <Skeleton width={120} height={40} />
              </div>
            </div>
          ))}
        </div>
        <Skeleton height={260} />
      </div>
    </main>
  )
}
