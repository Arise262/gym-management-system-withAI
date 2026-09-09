"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Field, FormErrorSummary } from "@/components/form-field";
import { normalizePhMobile } from "@/lib/phone";
import { DatePickerDemo } from "@/components/custom/date-picker";
import ItemSelector from "@/components/custom/item-selector";
import { AddEnquiry, type EnquiryInput } from "@/action/enquiries.action";
import { capitalizeWords } from "@/lib/utils";

const types = [
  { label: "Walk-in", value: "walkin" },
  { label: "Call", value: "call" },
  { label: "Instagram", value: "instagram" },
  { label: "WhatsApp", value: "whatsapp" },
];

/**
 * Phone is held as a string while typing and converted to BigInt only at
 * submit. The old form stored BigInt(0) as the initial value — so the field
 * opened showing "0" — and then wrote a plain Number into a bigint field on
 * every keystroke.
 */
type Draft = {
  name: string;
  phone: string;
  followupDate: string;
  message: string;
  type: string;
};

const EMPTY: Draft = { name: "", phone: "", followupDate: "", message: "", type: "walkin" };

type Errors = Partial<Record<keyof Draft, string>>;

function validate(d: Draft): Errors {
  const errors: Errors = {};
  if (!d.name.trim()) errors.name = "Enter a name.";

  // normalizePhMobile accepts 0917…, +63 917… and 9171234567 alike and returns
  // null for anything that is not a real PH mobile. That is what stops BigInt()
  // at the submit site from silently truncating a leading zero.
  const phone = normalizePhMobile(d.phone);
  if (!d.phone.trim()) errors.phone = "Enter a mobile number.";
  else if (!phone)
    errors.phone = "That does not look like a Philippine mobile number — try 0917 123 4567.";

  // The label carried a required marker but nothing ever checked it, so an
  // enquiry could be saved with no follow-up date and quietly never followed up.
  if (!d.followupDate) errors.followupDate = "Pick a follow-up date.";
  return errors;
}

const NewEnquiryPage = () => {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
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

    // Validation happens BEFORE the submitting flag is raised. The old code
    // called showLoading() first and then returned early on a validation
    // failure without ever calling hideLoading(), which left the app's global
    // loading overlay spinning forever.
    setSubmitting(true);
    try {
      const payload: EnquiryInput = {
        name: draft.name.trim(),
        // validate() already rejected anything normalizePhMobile cannot parse.
        phone: BigInt(normalizePhMobile(draft.phone)!),
        followupDate: draft.followupDate,
        message: draft.message.trim() || undefined,
        type: draft.type as EnquiryInput["type"],
      };
      const response = await AddEnquiry(payload);
      if (response?.id) {
        toast.success(`Enquiry from ${draft.name.trim()} saved.`);
        setDraft(EMPTY);
        setErrors({});
        router.refresh();
        return;
      }
      toast.error("Failed to add enquiry.");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add enquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  const errorList = Object.values(errors).filter(Boolean) as string[];

  return (
    <form onSubmit={handleOnSubmit} noValidate className="mx-auto w-full max-w-xl space-y-6 p-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">Create a new enquiry</h1>
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
            autoComplete="name"
            placeholder="Juan Dela Cruz"
            className="capitalize"
            value={draft.name}
            onChange={(e) => set(capitalizeWords(e.target.value), "name")}
          />
        )}
      </Field>

      <Field
        label="Phone"
        required
        error={errors.phone}
        hint="10 digits, without the +63 — for example 9171234567."
      >
        {(p) => (
          <Input
            {...p}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="9171234567"
            value={draft.phone}
            onChange={(e) => set(e.target.value, "phone")}
          />
        )}
      </Field>

      <Field
        label="Follow-up date"
        required
        error={errors.followupDate}
        hint="When someone should call them back."
      >
        {() => <DatePickerDemo onDateChange={(e) => set(e, "followupDate")} />}
      </Field>

      {/* Was an <Input type="text"> marked required under a label with no
          required marker. It is free text, so it gets a textarea and is
          genuinely optional. */}
      <Field label="Message" hint="Optional. What they asked about.">
        {(p) => (
          <Textarea
            {...p}
            rows={3}
            placeholder="Asked about annual rates and class schedules."
            value={draft.message}
            onChange={(e) => set(e.target.value, "message")}
          />
        )}
      </Field>

      <Field label="Enquiry type">
        {() => (
          <ItemSelector
            placeholder="How did they reach us?"
            searchPlaceholder="Enquiry type"
            data={types}
            labelKey="label"
            valueKey="value"
            onSelect={(e: string) => set(String(e), "type")}
          />
        )}
      </Field>

      <Button type="submit" disabled={submitting} className="w-full px-8 md:w-fit">
        {submitting ? "Saving…" : "Create enquiry"}
      </Button>
    </form>
  );
};

export default NewEnquiryPage;
