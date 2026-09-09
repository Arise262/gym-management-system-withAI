import Link from "next/link";
import { format } from "date-fns";
import { IconArrowLeft, IconCheck, IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PayButton } from "@/components/pay-button";
import { GetMyOutstanding, GetMyPayments } from "@/action/payment.action";
import { formatCentavos } from "@/lib/paymongo";

export const metadata = { title: "Payments" };

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-600 text-white hover:bg-emerald-600",
  PENDING: "bg-amber-400 text-black hover:bg-amber-400",
  PROCESSING: "bg-amber-400 text-black hover:bg-amber-400",
  FAILED: "bg-red-600 text-white hover:bg-red-600",
  EXPIRED: "bg-muted text-muted-foreground hover:bg-muted",
  REFUNDED: "bg-slate-500 text-white hover:bg-slate-500",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; cancelled?: string }>;
}) {
  const sp = await searchParams;
  const outstanding = await GetMyOutstanding();
  const payments = await GetMyPayments();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/member">
        <Button variant="ghost" size="sm" className="-ml-2">
          <IconArrowLeft className="mr-1 size-4" />
          Back
        </Button>
      </Link>

      <h1 className="text-2xl font-semibold">Payments</h1>

      {/*
        These banners report what the browser was told, not what settled. The
        webhook is what actually marks a payment paid and it may land a moment
        later, so the wording promises a confirmation, not a result.
      */}
      {sp.paid && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-600/40 px-4 py-3 text-sm">
          <IconCheck className="size-4 text-emerald-600" />
          Thanks — your payment is being confirmed. It will appear below once PayMongo settles it.
        </div>
      )}
      {sp.cancelled && (
        <div className="text-muted-foreground flex items-center gap-2 rounded-md border px-4 py-3 text-sm">
          <IconX className="size-4" />
          Payment cancelled. Nothing was charged.
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Outstanding</h2>
        {outstanding.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nothing due</CardTitle>
              <CardDescription>Your membership is paid up.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          outstanding.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{s.serviceName}</CardTitle>
                    <CardDescription>
                      {s.startDate} to {s.endDate} · ₱{s.paid.toLocaleString()} of ₱
                      {s.amount.toLocaleString()} paid
                    </CardDescription>
                  </div>
                  <PayButton saleId={s.id} amountLabel={`₱${s.due.toLocaleString()}`} />
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">History</h2>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payments yet.</p>
        ) : (
          payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div>
                  <div className="font-medium tabular-nums">{formatCentavos(p.amount)}</div>
                  <p className="text-muted-foreground text-sm">
                    {p.sale?.service.name ?? "Payment"}
                    {p.method ? ` · ${p.method}` : ""} ·{" "}
                    {/* Not toLocaleDateString() — with no locale argument that
                        renders per the viewer's machine, so the same receipt
                        reads "9/9/2026" here and "09/09/2026" elsewhere. Pin it
                        to the app's date format (see lib/format.ts). */}
                    {format(new Date(p.paidAt ?? p.createdAt), "d MMM yyyy")}
                  </p>
                </div>
                <Badge className={STATUS_STYLE[p.status] ?? ""}>{p.status}</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
