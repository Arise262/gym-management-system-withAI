import { Badge } from "@/components/ui/badge";

/** Paid / Unpaid, in the same green and amber as the payment status badges. */
export function PaidBadge({ paid }: { paid: boolean }) {
  return (
    <Badge
      className={
        paid
          ? "bg-emerald-600 text-white hover:bg-emerald-600"
          : "bg-amber-400 text-black hover:bg-amber-400"
      }
    >
      {paid ? "Paid" : "Unpaid"}
    </Badge>
  );
}

/**
 * A visit covered by a weekly pass (or a member's plan). Outlined green rather
 * than filled: nothing was collected on this visit, but nothing is owed either.
 */
export function PassBadge({ label = "Weekly pass" }: { label?: string }) {
  return (
    <Badge variant="outline" className="border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400">
      {label}
    </Badge>
  );
}
