import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A labelled key/value list.
 *
 * The member page used to render a bare icon next to a bare value — a phone
 * glyph beside a number, a calendar beside "01-01-2000" and a second calendar
 * beside "04-09-2026". Nothing said which date was the birthday and which was
 * the join date, and a member with no address got an orphan icon with empty
 * space beside it. Icons decorate a label here; they never replace one.
 */
export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid gap-x-4 gap-y-3 sm:grid-cols-2", className)}>{children}</dl>;
}

export function DetailRow({
  label,
  value,
  icon,
  /** What to show when there is no value. Omit the row entirely by passing null. */
  fallback = "Not set",
}: {
  label: string;
  value?: ReactNode;
  icon?: ReactNode;
  fallback?: ReactNode;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        {/* Decorative: the adjacent text already names the field. */}
        {icon ? (
          <span aria-hidden="true" className="[&>svg]:size-3.5">
            {icon}
          </span>
        ) : null}
        {label}
      </dt>
      <dd className={cn("mt-0.5 truncate text-sm", isEmpty && "text-muted-foreground italic")}>
        {isEmpty ? fallback : value}
      </dd>
    </div>
  );
}
