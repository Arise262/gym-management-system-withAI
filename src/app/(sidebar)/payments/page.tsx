import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GetAllPayments } from "@/action/payment.action";
import { formatCentavos } from "@/lib/paymongo";

export const metadata = { title: "Online payments" };

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-600 text-white hover:bg-emerald-600",
  PENDING: "bg-amber-400 text-black hover:bg-amber-400",
  PROCESSING: "bg-amber-400 text-black hover:bg-amber-400",
  FAILED: "bg-red-600 text-white hover:bg-red-600",
  EXPIRED: "bg-muted text-muted-foreground hover:bg-muted",
  REFUNDED: "bg-slate-500 text-white hover:bg-slate-500",
};

export default async function AdminPaymentsPage() {
  const payments = await GetAllPayments();
  const settled = payments.filter((p) => p.status === "PAID");
  const total = settled.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Online payments</h1>
        <p className="text-muted-foreground text-sm">
          Collected through PayMongo. {settled.length} settled ·{" "}
          <span className="text-foreground font-medium">{formatCentavos(total)}</span> total.
          Cash taken at the desk lives under Sales.
        </p>
      </div>

      <Card>
        <CardContent className="px-0">
          {payments.length === 0 ? (
            <p className="text-muted-foreground px-6 py-10 text-center text-sm">
              No online payments yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.member.name}</div>
                      <div className="text-muted-foreground text-xs">{p.member.memberCode}</div>
                    </TableCell>
                    <TableCell>{p.sale?.service.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentavos(p.amount)}
                    </TableCell>
                    <TableCell className="capitalize">{p.method ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLE[p.status] ?? ""}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(p.paidAt ?? p.createdAt), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
