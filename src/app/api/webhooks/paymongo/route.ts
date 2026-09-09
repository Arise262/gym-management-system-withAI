import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  centavosToPesos,
  formatCentavos,
  verifyWebhookSignature,
  HANDLED_EVENTS,
  type PayMongoEvent,
} from "@/lib/paymongo";
import { notifyMember } from "@/lib/notifications";

/**
 * PayMongo webhook receiver.
 *
 * This endpoint is deliberately excluded from the auth middleware (see the
 * matcher in middleware.ts): PayMongo has no session, and authenticates by
 * signing the request instead. That makes the signature check the entire
 * security boundary here, so it runs before anything is parsed or written.
 *
 * It is also the only place a payment is marked PAID. The browser is never
 * trusted for that — a member returning to the success URL proves they came
 * back from PayMongo, not that money moved.
 */

/** Node runtime, not edge: the signature check needs node:crypto. */
export const runtime = "nodejs";

/** Never cache a webhook. */
export const dynamic = "force-dynamic";

type Extracted = {
  eventType: string;
  paymentId: string | null;
  checkoutId: string | null;
  amountCentavos: number | null;
  method: string | null;
  memberId: string | null;
  saleId: string | null;
  paid: boolean;
};

/**
 * Pulls the fields we care about out of an event.
 *
 * PayMongo nests differently per event type — a checkout_session event carries
 * its payments in an array, a payment event is the payment itself — so this
 * normalises both rather than the caller branching everywhere.
 */
function extract(event: PayMongoEvent): Extracted {
  const eventType = event.data?.attributes?.type ?? "";
  const node = event.data?.attributes?.data;
  const attrs = (node?.attributes ?? {}) as Record<string, unknown>;

  const metadata = (attrs.metadata ?? {}) as Record<string, string>;
  const isCheckout = eventType.startsWith("checkout_session.");

  // A checkout session holds an array of payments; take the most recent.
  const payments = (attrs.payments ?? []) as Array<{ id?: string; attributes?: Record<string, unknown> }>;
  const payment = isCheckout ? payments[payments.length - 1] : { id: node?.id, attributes: attrs };
  const pAttrs = (payment?.attributes ?? {}) as Record<string, unknown>;

  const status = String(pAttrs.status ?? attrs.status ?? "");

  return {
    eventType,
    paymentId: payment?.id ?? null,
    checkoutId: isCheckout ? (node?.id ?? null) : ((attrs.checkout_session_id as string) ?? null),
    amountCentavos:
      typeof pAttrs.amount === "number"
        ? pAttrs.amount
        : typeof attrs.amount === "number"
          ? (attrs.amount as number)
          : null,
    method: (pAttrs.source as { type?: string })?.type ?? (pAttrs.payment_method_used as string) ?? null,
    memberId: metadata.memberId ?? null,
    saleId: metadata.saleId ?? null,
    paid: eventType.endsWith(".paid") || status === "paid",
  };
}

export async function POST(req: Request) {
  // Raw body, read once and untouched: the signature covers the exact bytes
  // PayMongo sent, so re-serialising parsed JSON would break verification.
  const rawBody = await req.text();

  const check = verifyWebhookSignature({
    rawBody,
    signatureHeader: req.headers.get("paymongo-signature"),
    secret: process.env.PAYMONGO_WEBHOOK_SECRET ?? "",
  });

  if (!check.ok) {
    console.warn(`[paymongo] rejected webhook: ${check.reason}`);
    // 401, not 400: this is an authentication failure, and PayMongo's retry
    // behaviour treats them differently.
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: PayMongoEvent;
  try {
    event = JSON.parse(rawBody) as PayMongoEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const e = extract(event);

  // Acknowledge anything we do not handle. Returning an error would make
  // PayMongo retry an event that will never succeed, forever.
  //
  // Filtering on the event type first matters: PayMongo sends plenty of other
  // events (source.chargeable, link.*, and whatever it adds later) whose data
  // node also has an id. Without this check that id is mistaken for a payment
  // id, and an unrelated event carrying metadata would record a payment that
  // never happened.
  if (!HANDLED_EVENTS.includes(e.eventType as (typeof HANDLED_EVENTS)[number])) {
    console.info(`[paymongo] ignoring unhandled event ${e.eventType || "(none)"}`);
    return NextResponse.json({ received: true, handled: false });
  }

  if (!e.paymentId) {
    console.warn(`[paymongo] ${e.eventType} carried no payment id — ignored`);
    return NextResponse.json({ received: true, handled: false });
  }

  // Set inside the transaction when this webhook is the first to mark the
  // payment PAID; the receipt notification goes out after the commit.
  let receiptFor: { memberId: string; amount: number } | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      // providerPaymentId is unique, so a replayed webhook updates the row it
      // already wrote instead of recording the money twice.
      const existing = await tx.payment.findUnique({
        where: { providerPaymentId: e.paymentId! },
        select: { id: true, status: true, memberId: true, saleId: true, amount: true },
      });

      // Fall back to the pending row StartCheckout wrote, so the payment
      // settles that row instead of recording a second one beside it.
      //
      // Two ways to find it, because the two events PayMongo sends for one
      // payment carry different identifiers. A checkout_session.* event names
      // the session, so the checkout id matches. A payment.* event has NO
      // checkout_session_id attribute at all — only the metadata we set on the
      // session — and it always arrives FIRST. Matching on the checkout id
      // alone therefore missed every time: payment.paid created a duplicate
      // row, checkout_session.payment.paid then found that duplicate by
      // providerPaymentId, and the original PENDING row was orphaned for good.
      const pendingWhere: Prisma.PaymentWhereInput[] = [];
      if (e.checkoutId) pendingWhere.push({ providerCheckoutId: e.checkoutId });
      if (e.saleId && e.memberId) {
        pendingWhere.push({
          saleId: e.saleId,
          memberId: e.memberId,
          ...(e.amountCentavos !== null ? { amount: e.amountCentavos } : {}),
        });
      }

      // providerPaymentId must still be null: a row already tied to a payment
      // belongs to that payment, never to this one.
      const pending =
        existing || pendingWhere.length === 0
          ? null
          : await tx.payment.findFirst({
              where: { status: "PENDING", providerPaymentId: null, OR: pendingWhere },
              orderBy: { createdAt: "desc" },
              select: { id: true, memberId: true, saleId: true, amount: true },
            });

      const memberId = e.memberId ?? existing?.memberId ?? pending?.memberId;
      if (!memberId) {
        // Nothing ties this to a member. Recording it would create an orphan
        // row nobody can reconcile; logging it loudly is more useful.
        console.error(`[paymongo] payment ${e.paymentId} has no member — skipped`);
        return;
      }

      const status = e.paid ? "PAID" : "FAILED";
      const amount = e.amountCentavos ?? existing?.amount ?? pending?.amount ?? 0;
      const saleId = e.saleId ?? existing?.saleId ?? pending?.saleId ?? null;

      const target = existing?.id ?? pending?.id;
      const alreadyPaid = existing?.status === "PAID";
      if (e.paid && !alreadyPaid) receiptFor = { memberId, amount };

      if (target) {
        await tx.payment.update({
          where: { id: target },
          data: {
            status,
            amount,
            saleId,
            method: e.method,
            providerPaymentId: e.paymentId!,
            providerCheckoutId: e.checkoutId ?? undefined,
            paidAt: e.paid ? new Date() : null,
            rawPayload: event as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            memberId,
            saleId,
            amount,
            status,
            method: e.method,
            providerPaymentId: e.paymentId!,
            providerCheckoutId: e.checkoutId,
            paidAt: e.paid ? new Date() : null,
            rawPayload: event as unknown as Prisma.InputJsonValue,
          },
        });
      }

      // Credit the sale only on a first successful payment. Without the
      // alreadyPaid guard a retried webhook would keep incrementing Sales.paid
      // and eventually show the member as having overpaid.
      if (e.paid && !alreadyPaid && saleId) {
        const sale = await tx.sales.findUnique({
          where: { id: saleId },
          select: { amount: true, paid: true },
        });
        if (sale) {
          // Sales.paid is WHOLE PESOS; PayMongo amounts are centavos.
          const credited = sale.paid + Math.round(centavosToPesos(amount));
          await tx.sales.update({
            where: { id: saleId },
            data: { paid: Math.min(sale.amount, credited) },
          });
        }
      }
    });

    console.info(`[paymongo] ${e.eventType} -> payment ${e.paymentId} ${e.paid ? "PAID" : "FAILED"}`);

    // Receipt. Outside the transaction so a slow mail call cannot hold a
    // pooler connection, and after it so the member is never told about a
    // payment that then failed to record. Keyed on the provider payment id,
    // so a retried webhook cannot send a second receipt.
    if (receiptFor) {
      const { memberId, amount } = receiptFor as { memberId: string; amount: number };
      await notifyMember(memberId, {
        type: "PAYMENT_RECEIVED",
        title: `Payment received: ${formatCentavos(amount)}`,
        body:
          `Thanks — we received your payment of ${formatCentavos(amount)}` +
          (e.method ? ` via ${e.method.replace(/_/g, " ")}` : "") +
          `. Your membership record has been updated. Reference: ${e.paymentId}.`,
        channel: "BOTH",
        actionUrl: "/member/payments",
        metadata: { paymentId: e.paymentId, amount, method: e.method },
        dedupeKey: `payment-received:${e.paymentId}`,
      });
    }

    return NextResponse.json({ received: true, handled: true });
  } catch (err) {
    console.error("[paymongo] webhook processing failed:", err);
    // 500 so PayMongo retries — the signature was good, so this is our fault.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
