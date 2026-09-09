"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DatePickerDemo } from "@/components/custom/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Field, FormErrorSummary } from "@/components/form-field";
import { normalizePhMobile } from "@/lib/phone";
import { AddMember, MemberInput } from "@/action/member.action";
import { useLoading } from "@/hooks/use-loading";
import { capitalizeWords } from "@/lib/utils";

type Gender = "male" | "female" | "other";

const EMPTY: MemberInput = {
  name: "",
  // Empty rather than 0 — a field that starts life showing "0" reads as if it
  // has already been filled in.
  phone: "" as unknown as number,
  // These used to be seeded with "@gmail.com" and "Makati City", so a hurried
  // front-desk save silently wrote a broken email and the wrong branch address.
  email: "",
  memberCode: "",
  gender: "other",
  DOB: "",
  DOJ: "",
  address: "",
};

type Errors = Partial<Record<keyof MemberInput, string>>;

/** Validation lives in one place and names the field that is wrong. */
function validate(state: MemberInput): Errors {
  const errors: Errors = {};
  if (!state.name.trim()) errors.name = "Enter the member's name.";

  // Accept 0917…, +63 917… and 9171234567 alike, the way the member-facing
  // forms do. Rejecting the 09XX form that everyone in the Philippines
  // actually writes made the front desk retype every number.
  const phone = normalizePhMobile(String(state.phone ?? ""));
  if (!String(state.phone ?? "").trim()) errors.phone = "Enter a mobile number.";
  else if (!phone)
    errors.phone = "That does not look like a Philippine mobile number — try 0917 123 4567.";

  if (state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email))
    errors.email = "That does not look like an email address.";

  if (!state.DOB) errors.DOB = "Pick a date of birth.";
  if (!state.DOJ) errors.DOJ = "Pick a joining date.";
  return errors;
}

const NewMemberPage = () => {
  const router = useRouter();
  const { showLoading, hideLoading } = useLoading();
  const [formState, setFormState] = useState<MemberInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (value: any, field: keyof MemberInput) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    // Clear a field's error as soon as the user starts correcting it, rather
    // than leaving stale red text under a field they have already fixed.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleOnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(formState);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      // Move focus to the summary so keyboard and screen reader users are told
      // what went wrong instead of being left at the submit button.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setSubmitting(true);
    showLoading();
    try {
      const response = await AddMember({
        ...formState,
        // validate() already rejected anything normalizePhMobile cannot parse.
        phone: Number(normalizePhMobile(String(formState.phone))),
      });
      if (response?.id) {
        toast.success(`${formState.name} added.`);
        setFormState(EMPTY);
        setErrors({});
        // router.refresh() revalidates the server data in place. The old code
        // called window.location.reload(), which threw away the whole app shell
        // and flashed the page white after every save.
        router.refresh();
        return;
      }
      toast.error("Failed to add member.");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add member.");
    } finally {
      setSubmitting(false);
      hideLoading();
    }
  };

  const errorList = Object.values(errors).filter(Boolean) as string[];

  return (
    <form onSubmit={handleOnSubmit} noValidate className="mx-auto w-full max-w-xl space-y-6 p-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">Create a new member</h1>
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
            placeholder="Juan Dela Cruz"
            autoComplete="name"
            className="capitalize"
            value={formState.name}
            onChange={(e) => handleInputChange(capitalizeWords(e.target.value), "name")}
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
            value={String(formState.phone ?? "")}
            onChange={(e) => handleInputChange(e.target.value, "phone")}
          />
        )}
      </Field>

      <Field label="Email" error={errors.email} hint="Optional. Used for renewal reminders and receipts.">
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={formState.email ?? ""}
            onChange={(e) => handleInputChange(e.target.value, "email")}
          />
        )}
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-foreground mb-2 text-sm leading-none font-medium">
          Gender <span className="text-destructive">*</span>
        </legend>
        <RadioGroup
          className="grid grid-cols-3 gap-2"
          value={formState.gender}
          onValueChange={(value: Gender) => handleInputChange(value, "gender")}
        >
          {(["female", "male", "other"] as const).map((value) => (
            // The whole tile is the label, so the entire box is clickable and
            // comfortably over the 44px touch minimum — previously only the
            // 16px radio dot and its word were targets.
            <Label
              key={value}
              className="border-input has-data-[state=checked]:border-brand has-data-[state=checked]:bg-brand/5 flex cursor-pointer items-center gap-2 rounded-md border p-3 capitalize shadow-xs transition-colors"
            >
              <RadioGroupItem value={value} />
              {value}
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      <Field label="Date of birth" required error={errors.DOB}>
        {() => (
          <DatePickerDemo
            defaultDate={formState.DOB}
            onDateChange={(e) => handleInputChange(e, "DOB")}
          />
        )}
      </Field>

      <Field label="Joining date" required error={errors.DOJ}>
        {() => (
          <DatePickerDemo
            defaultDate={formState.DOJ}
            onDateChange={(e) => handleInputChange(e, "DOJ")}
          />
        )}
      </Field>

      <Field label="Address" hint="Optional.">
        {(p) => (
          <Input
            {...p}
            type="text"
            autoComplete="street-address"
            placeholder="Barangay, City"
            value={formState.address ?? ""}
            onChange={(e) => handleInputChange(e.target.value, "address")}
          />
        )}
      </Field>

      <Button type="submit" disabled={submitting} className="w-full px-8 md:w-fit">
        {submitting ? "Creating…" : "Create member"}
      </Button>
    </form>
  );
};

export default NewMemberPage;
