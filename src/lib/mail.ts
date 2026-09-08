/**
 * Transactional email via Brevo's HTTP API.
 *
 * HTTP rather than SMTP on purpose: the app runs as serverless functions, where
 * an SMTP handshake is slow, occasionally blocked, and needs a dependency
 * (nodemailer) for a single POST. Brevo's REST endpoint is one fetch call,
 * and the free tier (300 emails/day) is more than a gym of this size sends.
 *
 * Nothing here throws to the caller on a delivery failure — the notification
 * row is written first and `sentAt` stays null, so the daily cron can retry.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** Domains that only ever exist inside this app. Mail to them can never arrive. */
const UNDELIVERABLE_TLDS = [".local", ".localhost", ".test", ".invalid", ".example"];

export type MailInput = {
  to: string;
  toName?: string | null;
  subject: string;
  /** Plain-text body. HTML is derived from it unless `html` is given. */
  text: string;
  html?: string;
};

export type MailResult =
  | { sent: true; messageId: string | null }
  | { sent: false; reason: "unconfigured" | "undeliverable" | "rejected" | "network"; detail?: string };

/** True when Brevo can be called. Mirrors hasPayMongoKey()/hasClaudeKey(). */
export function hasMailKey(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim()) && Boolean(process.env.MAIL_FROM?.trim());
}

/**
 * Whether an address is worth attempting.
 *
 * Members with no real email get a generated `<code>@members.cbgfitness.local`
 * login (see lib/accounts.ts), and the seed admin is `admin@cbgfitness.local`.
 * Sending to those bounces, and bounces are what get a free Brevo account
 * suspended — so they are filtered here, once, rather than at every call site.
 */
export function isDeliverable(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase() ?? "";
  const at = e.indexOf("@");
  if (at < 1 || at === e.length - 1) return false;
  const domain = e.slice(at + 1);
  if (!domain.includes(".")) return false;
  return !UNDELIVERABLE_TLDS.some((tld) => domain.endsWith(tld));
}

/** Parses `Name <addr>` or a bare address out of MAIL_FROM. */
export function parseSender(raw: string | undefined): { name: string; email: string } | null {
  const v = raw?.trim();
  if (!v) return null;
  const m = v.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].replace(/^"|"$/g, "").trim() || "CBG Fitness Center", email: m[2].trim() };
  return { name: "CBG Fitness Center", email: v };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A minimal, deliberately plain template. Inline styles only — email clients
 * strip stylesheets — and no images, so nothing depends on a public asset URL.
 */
export function renderEmail(title: string, text: string, actionUrl?: string | null): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px 0;line-height:1.5">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = actionUrl
    ? `<p style="margin:20px 0 0 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">Open in CBG Fitness Center</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;padding:28px;border:1px solid #e5e7eb">
<p style="margin:0 0 16px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">CBG Fitness Center</p>
<h1 style="margin:0 0 16px 0;font-size:20px">${escapeHtml(title)}</h1>
${paragraphs}${button}
<p style="margin:24px 0 0 0;font-size:12px;color:#6b7280">You are receiving this because you have an account at CBG Fitness Center.</p>
</div></body></html>`;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const sender = parseSender(process.env.MAIL_FROM);
  const key = process.env.BREVO_API_KEY?.trim();
  if (!key || !sender) return { sent: false, reason: "unconfigured" };
  if (!isDeliverable(input.to)) return { sent: false, reason: "undeliverable" };

  const payload = {
    sender,
    to: [{ email: input.to.trim(), ...(input.toName ? { name: input.toName } : {}) }],
    subject: input.subject,
    textContent: input.text,
    htmlContent: input.html ?? renderEmail(input.subject, input.text),
  };

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error(`[mail] Brevo rejected (${res.status}): ${detail}`);
      return { sent: false, reason: "rejected", detail };
    }
    const data = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { sent: true, messageId: data.messageId ?? null };
  } catch (e) {
    console.error("[mail] Brevo request failed:", e);
    return { sent: false, reason: "network", detail: e instanceof Error ? e.message : String(e) };
  }
}
