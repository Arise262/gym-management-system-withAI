'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GetAllMembers, MemberResponse } from '@/action/member.action'
import { AddSales, SalesInput } from '@/action/sales.action'
import { GetAllServices, ServiceResponse } from '@/action/service.action'
import { DatePickerDemo } from '@/components/custom/date-picker'
import ItemSelector from '@/components/custom/item-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Field, FormErrorSummary } from '@/components/form-field'
import { pesos } from '@/lib/format'

/**
 * Money fields are strings while typing and coerced once at submit. They were
 * previously uncontrolled (`onChange` only, no `value`), so resetting the state
 * after a successful save left the old numbers sitting visibly in the boxes.
 */
type Draft = {
    member_id: string
    service_id: string
    description: string
    discount: string
    amount: number
    paid: string
    startDate: string
}

const EMPTY: Draft = {
    member_id: '',
    service_id: '',
    description: '',
    discount: '',
    amount: 0,
    paid: '',
    startDate: '',
}

type Errors = Partial<Record<keyof Draft, string>>

const NewSalePage = () => {
    const router = useRouter()
    const [members, setMembers] = useState<MemberResponse[]>([])
    const [services, setServices] = useState<ServiceResponse[]>([])
    const [draft, setDraft] = useState<Draft>(EMPTY)
    const [errors, setErrors] = useState<Errors>({})
    const [submitting, setSubmitting] = useState(false)
    // Bumped on reset so the uncontrolled selectors/date picker remount empty.
    const [formKey, setFormKey] = useState(0)
    const summaryRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        async function fetchData() {
            setMembers(await GetAllMembers())
            setServices(await GetAllServices())
        }
        fetchData()
    }, [])

    const set = <K extends keyof Draft>(value: Draft[K], field: K) => {
        setDraft((prev) => ({ ...prev, [field]: value }))
        setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
    }

    const discount = Number(draft.discount || 0)
    const paid = Number(draft.paid || 0)
    const payable = draft.amount - discount
    const due = payable - paid

    function validate(): Errors {
        const e: Errors = {}
        if (!draft.member_id) e.member_id = 'Choose a member.'
        if (!draft.service_id) e.service_id = 'Choose a service.'
        // Only meaningful once a service HAS been chosen. Run unconditionally,
        // it overwrote "Choose a service." on an empty form and blamed the
        // price of a service the user had not picked yet.
        else if (draft.amount <= 0) e.service_id = 'That service has no price set.'
        if (!draft.startDate) e.startDate = 'Pick a start date.'

        if (!Number.isFinite(discount) || discount < 0) e.discount = 'Discount cannot be negative.'
        else if (discount > draft.amount)
            e.discount = `Discount cannot exceed the ${pesos(draft.amount)} charge.`

        // The old form gave this its own rule (paid must be > 0) but hid it
        // behind the generic "fill all the required fields" toast, under a
        // label with no required marker.
        if (!draft.paid.trim()) e.paid = 'Enter how much was collected today (0 if nothing).'
        else if (!Number.isFinite(paid) || paid < 0) e.paid = 'Amount paid cannot be negative.'
        else if (paid > payable) e.paid = `That is more than the ${pesos(payable)} payable.`
        return e
    }

    const handleOnSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault()
        const found = validate()
        if (Object.keys(found).length > 0) {
            setErrors(found)
            requestAnimationFrame(() => summaryRef.current?.focus())
            return
        }

        setSubmitting(true)
        try {
            const payload: SalesInput = {
                member_id: draft.member_id,
                service_id: draft.service_id,
                description: draft.description.trim(),
                discount,
                amount: draft.amount,
                paid,
                startDate: draft.startDate,
            }
            const response = await AddSales(payload)
            if (response?.id) {
                toast.success('Sale recorded.')
                setDraft(EMPTY)
                setErrors({})
                setFormKey((k) => k + 1)
                router.refresh()
                return
            }
            toast.error('Failed to add sale.')
        } catch (err: any) {
            toast.error(err?.message ?? 'Failed to add sale.')
        } finally {
            setSubmitting(false)
        }
    }

    const errorList = Object.values(errors).filter(Boolean) as string[]

    return (
        <form onSubmit={handleOnSubmit} noValidate className="mx-auto w-full max-w-xl space-y-6 p-4">
            <div>
                <h1 className="font-display text-3xl font-semibold">Create a new sale</h1>
                <p className="text-muted-foreground text-sm">
                    Fields marked with <span className="text-destructive">*</span> are required.
                </p>
            </div>
            <Separator />

            <FormErrorSummary ref={summaryRef} errors={errorList} />

            <Field label="Member" required error={errors.member_id}>
                {() => (
                    <ItemSelector
                        key={`member-${formKey}`}
                        data={members}
                        valueKey="id"
                        labelKey="name"
                        onSelect={(value) => set(value, 'member_id')}
                        placeholder="Select a member"
                        searchPlaceholder="Search members..."
                    />
                )}
            </Field>

            <Field label="Service" required error={errors.service_id}>
                {() => (
                    <ItemSelector
                        key={`service-${formKey}`}
                        data={services}
                        valueKey="id"
                        labelKey="name"
                        onSelect={(value) => set(value, 'service_id')}
                        placeholder="Select a service"
                        searchPlaceholder="Search services..."
                        onSelectGetRow={(row) => {
                            setDraft((prev) => ({ ...prev, amount: row.price }))
                        }}
                    />
                )}
            </Field>

            <Field label="Start date" required error={errors.startDate}>
                {() => (
                    <DatePickerDemo
                        key={`date-${formKey}`}
                        onDateChange={(e) => set(e, 'startDate')}
                    />
                )}
            </Field>

            <Field label="Description" hint="Optional. Appears on the invoice.">
                {(p) => (
                    <Textarea
                        {...p}
                        rows={2}
                        placeholder="Anything worth noting about this sale."
                        value={draft.description}
                        onChange={(e) => set(e.target.value, 'description')}
                    />
                )}
            </Field>

            <Separator />

            {/* The money block reads as one unit: what is charged, what is taken
                off, what was collected, what is left. Every figure is formatted
                as pesos — the old page printed bare integers. */}
            <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground text-sm">Amount charged</span>
                    <span className="font-display text-xl font-semibold tabular-nums">
                        {draft.amount > 0 ? pesos(draft.amount) : '—'}
                    </span>
                </div>

                <Field label="Discount" error={errors.discount} hint="Optional. Whole pesos.">
                    {(p) => (
                        <Input
                            {...p}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            placeholder="0"
                            value={draft.discount}
                            onChange={(e) => set(e.target.value, 'discount')}
                        />
                    )}
                </Field>

                <Field
                    label="Amount paid"
                    required
                    error={errors.paid}
                    hint="Cash the member is handing over now — it goes into today's collections. Enter 0 if they are paying later."
                >
                    {(p) => (
                        <Input
                            {...p}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            placeholder="0"
                            value={draft.paid}
                            onChange={(e) => set(e.target.value, 'paid')}
                        />
                    )}
                </Field>

                <Card className="bg-muted/40">
                    <CardContent className="flex items-baseline justify-between">
                        <span className="text-sm font-medium">Balance due</span>
                        <span
                            className={`font-display text-2xl font-semibold tabular-nums ${
                                due > 0 ? 'text-brand' : ''
                            }`}
                        >
                            {pesos(Math.max(0, due))}
                        </span>
                    </CardContent>
                </Card>
            </div>

            <Button type="submit" disabled={submitting} className="w-full px-8 md:w-fit">
                {submitting ? 'Saving…' : 'Create sale'}
            </Button>
        </form>
    )
}

export default NewSalePage
