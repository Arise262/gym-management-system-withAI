"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DatePickerDemo } from "@/components/custom/date-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field } from "@/components/form-field";
import { SaveMyDetails, type MyDetails, type DetailsResult } from "@/action/profile.action";
import { formatPhMobile } from "@/lib/phone";

const GENDERS = [
  ["male", "Male"],
  ["female", "Female"],
  ["other", "Other"],
] as const;

/**
 * Lets a member fix their own details.
 *
 * Everything a member can get wrong at registration is editable here — a
 * mistyped name, the wrong mobile number, a date of birth off by a year.
 * Before this existed the only way to correct a typo was to ask an admin.
 *
 * The controls are uncontrolled apart from the two that cannot be: the date
 * picker has its own callback, and gender is a radio group whose value the
 * form needs to submit as a single field.
 */
export function PersonalDetailsForm({ details }: { details: MyDetails }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<DetailsResult | null, FormData>(
    SaveMyDetails,
    null
  );

  const [gender, setGender] = useState(details.gender);
  const [dob, setDob] = useState(details.DOB);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Your details were saved.");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const errorFor = (field: string) =>
    state && !state.success && state.field === field ? state.error : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your details</CardTitle>
        <CardDescription>
          Member {details.memberCode}. Correct anything that was mistyped when you signed up.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <Field label="Full name" required error={errorFor("name")}>
            {(p) => <Input {...p} name="name" defaultValue={details.name} autoComplete="name" />}
          </Field>

          <Field
            label="Mobile number"
            required
            error={errorFor("phone")}
            hint="Any format — 0917 123 4567, +63 917 123 4567 or 9171234567."
          >
            {(p) => (
              <Input
                {...p}
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                defaultValue={formatPhMobile(details.phone)}
              />
            )}
          </Field>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none">Gender</legend>
            <RadioGroup
              value={gender}
              onValueChange={setGender}
              className="flex flex-wrap gap-4 pt-1"
            >
              {GENDERS.map(([value, label]) => (
                <Label key={value} className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value={value} />
                  {label}
                </Label>
              ))}
            </RadioGroup>
            <input type="hidden" name="gender" value={gender} />
          </fieldset>

          <Field label="Date of birth" required error={errorFor("DOB")}>
            {() => <DatePickerDemo defaultDate={dob} onDateChange={(v: string) => setDob(v)} />}
          </Field>
          <input type="hidden" name="DOB" value={dob} />

          <Field label="Address" error={errorFor("address")} hint="Optional.">
            {(p) => (
              <Input {...p} name="address" defaultValue={details.address} autoComplete="street-address" />
            )}
          </Field>

          <div className="text-muted-foreground text-sm">
            Signed in as <span className="text-foreground">{details.email}</span>. To change the
            address you sign in with, ask the front desk.
          </div>

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
