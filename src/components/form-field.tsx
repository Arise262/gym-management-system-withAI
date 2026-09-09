"use client";

import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A labelled form control with helper text and an inline error.
 *
 * The forms in this app were built as loose <Label> + <Input> pairs with no
 * `htmlFor`/`id` link, so clicking a label did not focus its field and screen
 * readers announced the control unlabelled. Validation was a single toast
 * ("Please fill all the required fields") that never said which field was
 * wrong. This component fixes all three at once, and does the wiring itself so
 * no caller can forget it.
 *
 * `children` receives the ids to spread onto the control:
 *
 *   <Field label="Email" error={errors.email}>
 *     {(p) => <Input type="email" {...p} value={v} onChange={...} />}
 *   </Field>
 */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

export function Field({
  label,
  children,
  hint,
  error,
  required,
  className,
}: {
  label: string;
  children: (props: FieldControlProps) => ReactNode;
  /** Format guidance, shown before the user gets it wrong rather than after. */
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // Point the control at whichever descriptions actually exist.
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="gap-1">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </Label>

      {children({
        id,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })}

      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}

      {/* role="alert" so the message is announced when it appears, not just
          coloured red. Sits directly under the field it belongs to. */}
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Error summary for the top of a form. Complements the inline errors above —
 * it does not replace them. Focus it after a failed submit so keyboard and
 * screen reader users land on the problem instead of hunting for it.
 */
export function FormErrorSummary({
  errors,
  className,
  ref,
}: {
  errors: string[];
  className?: string;
  /** Focus this after a failed submit. React 19 takes ref as a plain prop. */
  ref?: React.Ref<HTMLDivElement>;
}) {
  if (errors.length === 0) return null;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={cn(
        "border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm",
        className
      )}
    >
      <p className="font-semibold">
        {errors.length === 1 ? "There is a problem" : `There are ${errors.length} problems`}
      </p>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
