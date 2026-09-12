"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Field, FormErrorSummary } from "@/components/form-field";
import { AddService, ServiceInput } from "@/action/service.action";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DurationUnit } from "@prisma/client";

const EMPTY: ServiceInput = { name: "", description: "", price: 0, duration: 0 };

type Errors = Partial<Record<keyof ServiceInput, string>>;

/**
 * Price and duration are held as strings while the user types — an <input
 * type="number"> hands back a string, and the old code pushed that straight
 * into a `number` field, so the action received "1200" rather than 1200.
 */
type Draft = { name: string; description: string; price: string; duration: string; durationUnit: DurationUnit };

const EMPTY_DRAFT: Draft = { name: "", description: "", price: "", duration: "", durationUnit: "MONTH" };

function validate(d: Draft): Errors {
  const errors: Errors = {};
  if (!d.name.trim()) errors.name = "Give the service a name.";

  const price = Number(d.price);
  if (!d.price.trim()) errors.price = "Enter a price.";
  else if (!Number.isFinite(price) || price <= 0) errors.price = "Price must be more than ₱0.";

  const duration = Number(d.duration);
  if (!d.duration.trim()) errors.duration = "Enter a duration.";
  else if (!Number.isInteger(duration) || duration <= 0)
    errors.duration = `Duration must be a whole number of ${d.durationUnit === "DAY" ? "days" : "months"}, at least 1.`;

  return errors;
}

const NewServicePage = () => {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const set = (value: string, field: keyof Draft) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleOnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setSubmitting(true);
    try {
      const response = await AddService({
        name: draft.name.trim(),
        description: draft.description.trim(),
        price: Number(draft.price),
        duration: Number(draft.duration),
        durationUnit: draft.durationUnit,
      });
      if (response?.id) {
        toast.success(`${draft.name.trim()} added.`);
        setDraft(EMPTY_DRAFT);
        setErrors({});
        router.refresh();
        return;
      }
      toast.error("Failed to add service.");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add service.");
    } finally {
      setSubmitting(false);
    }
  };

  const errorList = Object.values(errors).filter(Boolean) as string[];

  return (
    <form onSubmit={handleOnSubmit} noValidate className="mx-auto w-full max-w-xl space-y-6 p-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">Create a new service</h1>
        <p className="text-muted-foreground text-sm">
          Fields marked with <span className="text-destructive">*</span> are required.
        </p>
      </div>
      <Separator />

      <FormErrorSummary ref={summaryRef} errors={errorList} />

      <Field label="Name" required error={errors.name}>
        {(p) => (
          <Input
            {...p}
            type="text"
            placeholder="Annual Membership"
            value={draft.name}
            onChange={(e) => set(e.target.value, "name")}
          />
        )}
      </Field>

      {/* Was an <Input type="tel"> marked required, under a label that said it
          was optional. It is a free-text description, so it gets a textarea. */}
      <Field label="Description" hint="Optional. Shown on the invoice.">
        {(p) => (
          <Textarea
            {...p}
            rows={3}
            placeholder="What the member gets for this plan."
            value={draft.description}
            onChange={(e) => set(e.target.value, "description")}
          />
        )}
      </Field>

      <Field label="Price" required error={errors.price} hint="Whole pesos, no decimals.">
        {(p) => (
          <div className="relative">
            <span
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
            >
              ₱
            </span>
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="1200"
              className="pl-7"
              value={draft.price}
              onChange={(e) => set(e.target.value, "price")}
            />
          </div>
        )}
      </Field>

      <Field
        label="Duration"
        required
        error={errors.duration}
        hint={
          draft.durationUnit === "DAY"
            ? "Counting the start day — 7 days bought on a Saturday covers through Friday."
            : "Monthly memberships, e.g. 1 for a month or 12 for a year."
        }
      >
        {(p) => (
          <div className="flex gap-2">
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder={draft.durationUnit === "DAY" ? "7" : "1"}
              value={draft.duration}
              onChange={(e) => set(e.target.value, "duration")}
            />
            <Select value={draft.durationUnit} onValueChange={(v) => set(v, "durationUnit")}>
              <SelectTrigger className="w-32" aria-label="Duration unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTH">Months</SelectItem>
                <SelectItem value="DAY">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </Field>

      <Button type="submit" disabled={submitting} className="w-full px-8 md:w-fit">
        {submitting ? "Creating…" : "Create service"}
      </Button>
    </form>
  );
};

export default NewServicePage;
