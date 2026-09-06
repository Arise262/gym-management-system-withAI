'use client'
import { UpdateSaleById } from "@/action/sales.action"
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
import { Label } from "@/components/ui/label"
import React from "react"
import { toast } from "sonner"

interface Props {
    sale_id: string,
    sale: any,
    onSuccess?: () => void
}
export function PayPendingDialog({
    sale_id,
    sale,
    onSuccess
}: Props) {
    const [amount, setAmount] = React.useState(0)
    const [open, setOpen] = React.useState(false) // Add state for dialog control
    
    const handleSubmit = async () => {
        if(amount > sale.due) {
            toast.error('Amount cannot be greater than due')
            return
        }
        const res = await UpdateSaleById(sale_id, {paid: amount + sale.paid})
        if(res.id) {
            toast.success('Paid successfully')
            setAmount(0)
            setOpen(false) // Close the dialog on success
            onSuccess && onSuccess()
            return
        }
        toast.error('Failed to pay')
    }
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">Pay</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Pay remaining due</DialogTitle>
                    <p className="">Payment for {sale.service_name} of ₱{sale.due} by {sale.member_name}</p>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Amount
                        </Label>
                        <Input 
                            id="name" 
                            type='number' 
                            className="col-span-3" 
                            value={amount}
                            onChange={(e) => setAmount(parseInt(e.target.value))} 
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}