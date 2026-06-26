import { cn } from '@/lib/utils'

/** Shimmering placeholder block. Compose several to mirror real content layout. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-md', className)} />
}

/** A list of product-row skeletons matching the inventory card layout. */
export function ProductRowSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 rounded mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-6 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}
