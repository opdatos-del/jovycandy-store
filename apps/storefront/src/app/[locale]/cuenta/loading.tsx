import { Skeleton } from "@/components/ui/skeleton"

export default function AccountLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <Skeleton width={180} height={12} />
      <Skeleton className="mt-3" width={240} height={36} />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Skeleton height={280} />
        <Skeleton height={280} />
      </div>
    </main>
  )
}
