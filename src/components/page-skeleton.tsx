import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a route shows while its server component is still waiting on the
 * database. Next streams the layout plus this immediately and swaps the real
 * page in when its data arrives, so navigation gives feedback within a frame
 * instead of sitting on the old page for the whole query chain.
 *
 * Deliberately generic — a title, a row of stat tiles, a few cards — so it is
 * a plausible stand-in for every page in the group without knowing which one.
 */
export function PageSkeleton({ tiles = 4, cards = 3 }: { tiles?: number; cards?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {tiles > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: tiles }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
