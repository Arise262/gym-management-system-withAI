"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireMemberId, requireRole, requireUser } from "@/lib/session";
import {
  createCheckoutSession,
  hasPayMongoKey,
  pesosToCentavos,
  PayMongoError,
} from "@/lib/paymongo";

/**
 * Payments.
 *
 * The flow is: member presses Pay -> we create a PayMongo checkout session and
 * a PENDING Payment row -> member pays on PayMongo's hosted page -> PayMongo
 * calls our webhook -> the webhook marks it PAID and credits the sale.
 *
 * The browser never marks anything paid. A member landing on the success URL
 * proves only that they came back, which is not the same as money moving, and
 * the difference is trivially forged by editing a URL.
 */

export type CheckoutResult =
  | { success: true; checkoutUrl: string }
  | { success: false; error: string };

/**
 * The app's own origin, for PayMongo's return URLs.
 *
 * Read from the request rather than an env var because AUTH_URL is
 * deliberately unset in this project (auth.config.ts uses trustHost), so the
 * app has to work on whatever host and port it is served from.
 */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/* ─────────────────────────────── reading ─────────────────────────────── */

export type OutstandingSale = {
  id: string;
  serviceName: string;
  startDate: string;
  endDate: string;
  /** Whole pesos. */
  amount: number;
  paid: number;
  due: number;
};

/** Memberships this member still owes money on. */
export async function GetMyOutstanding(): Promise<OutstandingSale[]> {
  const memberId = await requireMemberId();

  const sales = await prisma.sales.findMany({
    where: { member_id: memberId },
    orderBy: { createdAt: "desc" },
    include: { service: { select: { name: true } } },
  });

  return sales
    .map((s) => ({
      id: s.id,
      serviceName: s.service.name,
      startDate: s.startDate,
      endDate: s.endDate,
      amount: s.amount,
      paid: s.paid,
      due: Math.max(0, s.amount - s.discount - s.paid),
    }))
    .filter((s) => s.due > 0);
}

/** This member's payment history, newest first. */
export async function GetMyPayments() {
  const memberId = await requireMemberId();

  return prisma.payment.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, amount: true, status: true, method: true, paidAt: true,
      createdAt: true, currency: true,
      sale: { select: { service: { select: { name: true } } } },
    },
  });
}

/** Every online payment, for the back office. Desk cash is on /sales/collections. */
export async function GetAllPayments(limit = 100) {
  await requireRole("ADMIN");

  return prisma.payment.findMany({
    where: { provider: "paymongo" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, amount: true, status: true, method: true, paidAt: true,
      createdAt: true, currency: true, providerPaymentId: true,
      member: { select: { name: true, memberCode: true } },
      sale: { select: { service: { select: { name: true } } } },
    },
  });
}

/* ─────────────────────────── cash at the desk ─────────────────────────── */

export type CashPaymentResult = { success: true } | { success: false; error: string };

/**
 * Takes cash at the front desk against a membership balance.
 *
 * This used to be a bare `UpdateSaleById({ paid: old + amount })`: the sale's
 * running total moved, but nothing recorded that money changed hands, when,
 * or how — so a day's cash could never be counted back. Now the same step
 * writes a PAID Payment row (provider "cash") in the same transaction, which
 * puts desk payments in the member's history beside their online ones.
 *
 * The due check is here, not only in the dialog, so a stale screen or a
 * second tab cannot push a sale into overpayment.
 */
export async function RecordCashPayment(saleId: string, amountPesos: number): Promise<CashPaymentResult> {
  await requireRole("ADMIN");

  if (!Number.isInteger(amountPesos) || amountPesos <= 0) {
    return { success: false, error: "Enter an amount in whole pesos." };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sales.findUnique({
          where: { id: saleId },
          select: { member_id: true, amount: true, discount: true, paid: true },
        });
        if (!sale) return { success: false, error: "That sale no longer exists." } as const;

        const due = Math.max(0, sale.amount - sale.discount - sale.paid);
        if (amountPesos > due) {
          return { success: false, error: `Only ₱${due.toLocaleString("en-PH")} is due on this sale.` } as const;
        }

        await tx.sales.update({ where: { id: saleId }, data: { paid: { increment: amountPesos } } });
        await tx.payment.create({
          data: {
            memberId: sale.member_id,
            saleId,
            amount: pesosToCentavos(amountPesos),
            provider: "cash",
            method: "cash",
            status: "PAID",
            paidAt: new Date(),
          },
        });
        return { success: true } as const;
      },
      // Three round trips to the Sydney pooler can pass Prisma's 5 s default.
      { timeout: 30_000, maxWait: 10_000 }
    );
  } catch (e) {
    console.error("RecordCashPayment failed:", e);
    return { success: false, error: "Could not record the payment. Please try again." };
  } finally {
    revalidatePath("/sales/collections");
  }
}

/* ────────────────────────────── checkout ────────────────────────────── */

/**
 * Starts a hosted checkout for one outstanding sale.
 *
 * A PENDING Payment row is written alongside the session so the webhook has
 * something to attach to even if PayMongo's metadata does not come back — the
 * checkout id is the fallback link.
 */
export async function StartCheckout(saleId: string): Promise<CheckoutResult> {
  const user = await requireUser();
  const memberId = await requireMemberId();

  if (!hasPayMongoKey()) {
    return {
      success: false,
      error: "Online payment is not configured yet. Please pay at the front desk.",
    };
  }

  const sale = await prisma.sales.findFirst({
    where: { id: saleId, member_id: memberId },
    include: { service: { select: { name: true } }, member: { select: { name: true, memberCode: true } } },
  });
  if (!sale) return { success: false, error: "That invoice is not yours." };

  const duePesos = Math.max(0, sale.amount - sale.discount - sale.paid);
  if (duePesos <= 0) return { success: false, error: "That membership is already paid." };

  // PayMongo rejects anything under ₱20. Saying so beats a raw 422.
  if (duePesos < 20) {
    return { success: false, error: "The minimum online payment is ₱20. Please pay at the front desk." };
  }

  const base = await origin();

  try {
    const session = await createCheckoutSession({
      lineItems: [
        {
          name: sale.service.name,
          amount: pesosToCentavos(duePesos),
          quantity: 1,
          description: `${sale.startDate} to ${sale.endDate}`,
        },
      ],
      successUrl: `${base}/member/payments?paid=1`,
      cancelUrl: `${base}/member/payments?cancelled=1`,
      description: `${sale.service.name} — ${sale.member.name} (${sale.member.memberCode})`,
      referenceNumber: sale.id,
      // Echoed back on the webhook. This is how a payment finds its member and
      // sale without trusting anything the browser sends.
      metadata: { memberId, saleId: sale.id, userId: user.id },
    });

    await prisma.payment.create({
      data: {
        memberId,
        saleId: sale.id,
        amount: pesosToCentavos(duePesos),
        status: "PENDING",
        providerCheckoutId: session.id,
      },
    });

    revalidatePath("/member/payments");
    return { success: true, checkoutUrl: session.checkoutUrl };
  } catch (e) {
    console.error("StartCheckout failed:", e);
    return {
      success: false,
      error:
        e instanceof PayMongoError
          ? e.message
          : "Could not start the payment. Please try again in a moment.",
    };
  }
}
