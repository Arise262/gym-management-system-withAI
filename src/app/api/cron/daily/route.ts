import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDailyJob } from "@/notifications/daily";

/**
 * Daily scheduled job — called once a day by cron-job.org.
 *
 * Excluded from the auth middleware (see the matcher in middleware.ts): the
 * caller has no session and authenticates with a shared secret instead. The
 * secret is compared in constant time so the endpoint does not leak how many
 * leading characters were right.
 *
 * Why cron-job.org and not Vercel Cron: the Hobby plan allows two daily crons
 * with no guarantee on the minute they fire, and this project already leans on
 * the free tier everywhere else. The external ping also keeps the Supabase
 * project from pausing after seven idle days, which matters more than it
 * sounds for a demo that may sit untouched for a fortnight before the defence.
 *
 * GET and POST both work: cron-job.org defaults to GET, and POST is what
 * "run now" from the admin page uses.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Seconds. Headroom for a cold pooler; the job itself is a few dozen queries. */
export const maxDuration = 60;
/**
 * Sydney — the same AWS region as the Supabase project (aws-0-ap-southeast-2).
 * The job is a chain of small sequential queries, so its runtime is almost
 * entirely round-trip latency; putting the function next to the database
 * turns each hop from ~1 s (measured from a home connection) into a few ms.
 */
export const preferredRegion = "syd1";

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return false;

  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-cron-key")?.trim() ?? "";
  const presented = bearer || alt;
  if (!presented) return false;

  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request): Promise<Response> {
  if (!authorised(req)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const url = new URL(req.url);
  const forceWeekly = url.searchParams.get("weekly") === "1";

  try {
    const report = await runDailyJob(new Date(), { forceWeekly });
    console.info(`[cron] daily ok in ${report.durationMs}ms`, JSON.stringify(report));
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    console.error("[cron] daily failed:", e);
    // 500 so cron-job.org marks the run failed and emails the account owner.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "daily job failed" },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
