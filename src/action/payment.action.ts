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

/** Every payment, for the back office. */
export async function GetAllPayments(limit = 100) {
  await requireRole("ADMIN");

  return prisma.payment.findMany({
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
