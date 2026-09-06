import { createHmac, timingSafeEqual } from "crypto";

/**
 * PayMongo client.
 *
 * Test mode only, deliberately: live keys require DTI or SEC registration
 * documents, which a student project does not have. Everything here works
 * identically against live keys — only the credentials change.
 *
 * MONEY UNITS ARE THE THING TO GET RIGHT. PayMongo works entirely in
 * centavos. `Sales.amount` and `Services.price` in this schema are whole
 * pesos; `Payment.amount` is centavos, matching PayMongo. Conversion happens
 * at this boundary and nowhere else — mixing the two is how you charge
 * someone a hundred times what they owe.
 */

const API_BASE = "https://api.paymongo.com/v1";

export class PayMongoError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export const pesosToCentavos = (pesos: number): number => Math.round(pesos * 100);
export const centavosToPesos = (centavos: number): number => centavos / 100;

/** Formats centavos for display: 1234567 -> "₱12,345.67". */
export function formatCentavos(centavos: number): string {
  return `₱${centavosToPesos(centavos).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function hasPayMongoKey(): boolean {
  const k = process.env.PAYMONGO_SECRET_KEY?.trim();
  // The .env ships with a bare "sk_test_" prefix as a placeholder. A real key
  // is far longer, so length is what separates configured from not.
  return Boolean(k && k.length > 20);
}

/** PayMongo authenticates with HTTP Basic: the secret key as the username. */
function authHeader(): string {
  const key = process.env.PAYMONGO_SECRET_KEY ?? "";
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!hasPayMongoKey()) {
    throw new PayMongoError(
      "PAYMONGO_SECRET_KEY is not configured. Add a test key from the PayMongo dashboard."
    );
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    // PayMongo returns { errors: [{ detail, code, ... }] }. Surface the first
    // detail rather than a bare status — "amount below minimum" is actionable,
    // "422" is not.
    const detail =
      body?.errors?.[0]?.detail ?? body?.errors?.[0]?.code ?? `PayMongo returned ${res.status}`;
    throw new PayMongoError(detail, res.status);
  }

  return body as T;
}

/* ─────────────────────────── checkout sessions ─────────────────────────── */

export type CheckoutLineItem = {
  name: string;
  /** CENTAVOS. */
  amount: number;
  quantity: number;
  description?: string;
};

export type CheckoutSession = {
  id: string;
  /** Where to send the member to pay. */
  checkoutUrl: string;
};

/**
 * Creates a hosted checkout page.
 *
 * Hosted rather than a custom card form on purpose: card details never touch
 * this application, which removes the entire class of PCI obligations a
 * student project cannot meet.
 */
export async function createCheckoutSession(opts: {
  lineItems: CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  /** Echoed back on the webhook — how a payment is tied to a member and sale. */
  metadata: Record<string, string>;
  description: string;
  referenceNumber?: string;
}): Promise<CheckoutSession> {
  const payload = {
    data: {
      attributes: {
        line_items: opts.lineItems.map((li) => ({
          name: li.name,
          amount: li.amount,
          currency: "PHP",
          quantity: li.quantity,
          ...(li.description ? { description: li.description } : {}),
        })),
        // GCash and GrabPay matter more than cards in the Philippines; both are
        // enabled in test mode without extra onboarding.
        payment_method_types: ["card", "gcash", "grab_pay", "paymaya"],
        success_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
        description: opts.description,
        ...(opts.referenceNumber ? { reference_number: opts.referenceNumber } : {}),
        metadata: opts.metadata,
      },
    },
  };

  const body = await call<{ data: { id: string; attributes: { checkout_url: string } } }>(
    "/checkout_sessions",
    { method: "POST", body: JSON.stringify(payload) }
  );

  return { id: body.data.id, checkoutUrl: body.data.attributes.checkout_url };
}

/* ──────────────────────────── webhook signing ──────────────────────────── */

/**
 * Verifies a `Paymongo-Signature` header.
 *
 * The header looks like:  t=1496734173,te=<test sig>,li=<live sig>
 * The signed payload is `${t}.${rawBody}`, HMAC-SHA256 with the webhook
 * secret. `te` is sent in test mode, `li` in live mode.
 *
 * This is the only thing standing between the payment table and anyone who
 * knows the webhook URL, so it verifies before parsing, compares in constant
 * time, and rejects stale timestamps to stop a captured request being replayed
 * later.
 */
export function verifyWebhookSignature(opts: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  /** Requests older than this are refused. Default five minutes. */
  toleranceSeconds?: number;
  /** Injectable for tests. */
  now?: Date;
}): { ok: true } | { ok: false; reason: string } {
  const { rawBody, signatureHeader, secret } = opts;
  const tolerance = opts.toleranceSeconds ?? 300;
  const now = opts.now ?? new Date();

  if (!secret) return { ok: false, reason: "PAYMONGO_WEBHOOK_SECRET is not configured" };
  if (!signatureHeader) return { ok: false, reason: "missing Paymongo-Signature header" };

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const i = p.indexOf("=");
      return i === -1 ? [p.trim(), ""] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  ) as Record<string, string>;

  const timestamp = parts.t;
  // Accept whichever mode this account is in; only one of the two is sent.
  const provided = parts.te || parts.li;
  if (!timestamp || !provided) return { ok: false, reason: "malformed Paymongo-Signature header" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid timestamp" };

  const ageSeconds = Math.abs(now.getTime() / 1000 - ts);
  if (ageSeconds > tolerance) {
    return { ok: false, reason: `timestamp outside tolerance (${Math.round(ageSeconds)}s)` };
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  // timingSafeEqual throws on a length mismatch, so check that first — and a
  // wrong length is already a failed signature.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return { ok: false, reason: "signature mismatch" };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };

  return { ok: true };
}

/** Builds a header the way PayMongo does. Used by the tests, not by the app. */
export function signWebhookPayload(rawBody: string, secret: string, timestamp: number): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},te=${sig},li=${sig}`;
}

/* ────────────────────────────── event shapes ────────────────────────────── */

export type PayMongoEvent = {
  data: {
    id: string;
    attributes: {
      type: string;
      data: {
        id: string;
        attributes: Record<string, unknown>;
      };
    };
  };
};

/** Events worth acting on. Anything else is acknowledged and ignored. */
export const HANDLED_EVENTS = [
  "checkout_session.payment.paid",
  "payment.paid",
  "payment.failed",
] as const;
