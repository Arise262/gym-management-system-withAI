import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Stat tile: label · value · one line of context. The number is the chart.
 * Proportional figures on the value (tabular digits look loose at this size);
 * the hint line stays in muted ink and never wears a data colour.
 */
export function StatTile({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Optional status tone for the hint line only — never the value. */
  tone?: "good" | "warning" | "critical";
  className?: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-500"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-400"
        : tone === "critical"
          ? "text-red-700 dark:text-red-400"
          : "text-muted-foreground";
  return (
    <Card className={cn("@container/card", className)}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold @[220px]/card:text-3xl">{value}</CardTitle>
        {hint !== undefined && <p className={cn("text-xs", toneClass)}>{hint}</p>}
      </CardHeader>
    </Card>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 *:data-[slot=card]:shadow-xs md:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Whole pesos, thousands-separated, no decimals — matches the rest of the app. */
export function pesos(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}
