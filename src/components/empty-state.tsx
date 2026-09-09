import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One empty state for the whole app.
 *
 * Previously every list invented its own: a dashed box floating inside a single
 * table cell (which did not span the columns, so it sat under the first header
 * and left the rest of the row blank), a bare centred sentence, or nothing at
 * all. An empty state should say what is missing and what to do about it.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/70 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="text-muted-foreground/70 [&>svg]:size-6">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-sm text-sm text-balance">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
