'use client'
import { RecordCashPayment } from "@/action/payment.action"
import { Field } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { pesos } from "@/lib/format"
import React from "react"
import { toast } from "sonner"

interface Props {
    sale_id: string,
    sale: any,
    onSuccess?: () => void
}

/**
 * Cash taken at the desk against a membership balance. Online payments go
 * through the member's own Pay button; this is the counter.
 */
export function PayPendingDialog({
    sale_id,
    sale,
    onSuccess
}: Props) {
    // A string, not parseInt on every keystroke — clearing the field used to
    // store NaN and send it to the server.
    const [amount, setAmount] = React.useState(String(sale.due))
    const [error, setError] = React.useState<string>()
    const [saving, setSaving] = React.useState(false)
    const [open, setOpen] = React.useState(false)

    const handleSubmit = async () => {
        const value = Number(amount)
        if (!Number.isInteger(value) || value <= 0) return setError('Enter an amount in whole pesos.')
        if (value > sale.due) return setError(`Only ${pesos(sale.due)} is due.`)
        setError(undefined)
        setSaving(true)
        const res = await RecordCashPayment(sale_id, value)
        setSaving(false)
        if (!res.success) return setError(res.error)
        toast.success(`${pesos(value)} cash recorded`)
        setOpen(false)
        onSuccess && onSuccess()
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setAmount(String(sale.due)); setError(undefined) } }}>
            <DialogTrigger asChild>
                <Button variant="outline">Pay</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Take a cash payment</DialogTitle>
                    <DialogDescription>
                        {sale.member_name} owes {pesos(sale.due)} on {sale.service_name}. It will show in today&apos;s collections.
                    </DialogDescription>
                </DialogHeader>
                <Field label="Cash received" error={error} hint="Whole pesos. Less than the balance is fine — the rest stays pending.">
                    {(p) => (
                        <Input
                            {...p}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={sale.due}
                            step={1}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />
                    )}
                </Field>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
