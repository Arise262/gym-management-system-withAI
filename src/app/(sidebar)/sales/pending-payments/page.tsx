import { Separator } from '@/components/ui/separator'
import PendingPayments from './PendingPayments'

/**
 * This page was a copy-paste stub: it rendered the heading "Create a new sale"
 * and a separator, and nothing else — while the working table sat unused in
 * PendingPayments.tsx beside it, imported only by the dashboard. Anyone who
 * reached this route got a wrong title above an empty page.
 */
export const metadata = { title: 'Pending payments' }

export default function Page() {
    return (
        <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
            <div>
                <h1 className="font-display text-3xl font-semibold">Pending payments</h1>
                <p className="text-muted-foreground text-sm">
                    Memberships with an outstanding balance. Message a member to chase it, or press
                    Pay to record cash taken at the desk.
                </p>
            </div>
            <Separator />
            <PendingPayments />
        </div>
    )
}
