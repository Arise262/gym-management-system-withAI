# CBG Fitness Center — AI-Powered Gym Management System

A production web application for a real gym in Makati, Philippines. It handles membership, attendance, payments, trainer booking and messaging, and adds three AI features: a workout planner, a churn-risk model, and a member assistant grounded in that member's own records.

Built as a capstone project. **Live:** https://gym-management-mauve.vercel.app

---

## What it does

**Admin** — dashboard (revenue, attendance, engagement, members at risk), members, sales and invoices, payments, retention scoring, enquiries, services, attendance, notifications.

**Member** — AI workout plan with logging, progress and streaks, trainer browsing and booking, chat with a trainer, the AI assistant, balance and receipts. Installable as a PWA.

**Trainer** — schedule with confirm / complete / no-show, client list with engagement, announcements to their own members.

Roles are enforced by default-deny middleware, and every server action re-checks the session rather than trusting an id from the client.

---

## The AI features

### 1. Workout planner — `claude-sonnet-5`

The model generates **one week**. `applyProgression()` expands it to the full programme in TypeScript: baseline, then +1 rep, then +1 set and +2 reps, then a deload, repeating every fourth week. Progression is arithmetic, so it belongs in code — that also makes it deterministic and cuts generation cost.

Plans are assembled from a seeded library of real exercises and the response is schema-validated before anything is stored, so the model cannot invent an exercise or write a malformed plan. Inputs are the member's fitness goal, body type, experience level, days per week, and any stated injuries.

### 2. Retention prediction — no LLM

A deterministic weighted score over six signals:

| Signal | Weight |
|---|---|
| Recency of last visit | 0.30 |
| Frequency trend | 0.20 |
| Frequency level | 0.15 |
| Membership expiry | 0.15 |
| Plan adherence | 0.10 |
| Payment arrears | 0.10 |

Each normalises to 0–1; the weighted sum × 100 gives a risk score, with bands at 25 / 50 / 75. Under fourteen days of membership the score is damped toward zero — a new member has no history, not a problem. Chosen over an LLM because it must be free to run nightly, identical on every run, and explainable line by line. **The weights are reasoned, not fitted** — the gym has no historical churn labels to train against.

### 3. Member assistant — `claude-haiku-4-5`

Answers from one member's own plan, logged workouts, bookings and balance. Their churn score is passed in as a tone hint the model is instructed never to surface, and medical questions are redirected to a trainer or doctor rather than answered.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript, server actions |
| Database | PostgreSQL via Prisma — 15 models / 25 tables |
| Auth | Auth.js v5, credentials provider, bcrypt cost 12 |
| UI | Tailwind CSS v4, shadcn/ui, Recharts |
| AI | Claude API (`@anthropic-ai/sdk`), structured output validated with Zod |
| Payments | PayMongo hosted checkout — GCash, card, GrabPay, Maya |
| Email | Brevo HTTP API |
| Scheduling | External cron caller hitting an authenticated route |
| Mobile | Progressive Web App — hand-written service worker, no PWA dependency |

Functions and database are deployed to the **same region**. The daily job takes ~48 s run from a laptop in Manila against a Sydney database and ~650 ms from a function co-located with it.

---

## Getting started

### Prerequisites

- Node.js 18+
- A PostgreSQL database
- An Anthropic API key (for the planner and assistant)

### Setup

```bash
git clone https://github.com/Arise262/gym-management-system-withAI.git
cd gym-management-system-withAI

npm install

cp .env.example .env
# fill in the values described below

npx prisma db push
npm run db:seed
npm run dev
```

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Pooled connection string |
| `DIRECT_URL` | yes | Direct connection for migrations. On Supabase use the **Session pooler** host — the `db.<ref>.supabase.co` host is IPv6-only on new projects and `prisma db push` fails on IPv4 |
| `AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | yes | Must be **scoped to a workspace**; an org-level key returns 400 on every request |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | seeding | The first admin account |
| `PAYMONGO_SECRET_KEY` / `PAYMONGO_PUBLIC_KEY` / `PAYMONGO_WEBHOOK_SECRET` | optional | Absent keys degrade checkout to "pay at the front desk" rather than erroring |
| `BREVO_API_KEY` / `MAIL_FROM` | optional | Absent key makes notifications in-app only |
| `CRON_SECRET` | optional | `openssl rand -hex 32`; required by the daily job route |
| `APP_URL` | optional | Falls back to the platform's deployment URL |

`AUTH_URL` is deliberately unset — `trustHost: true` derives the origin from the request, so any port or host works.

### Seed data

```bash
npm run db:seed            # admin account and base data
npm run db:seed:exercises  # the exercise library the planner selects from
npm run db:seed:demo       # demo member and trainer accounts
npm run db:seed:retention  # members spanning every churn risk band
npm run db:seed:activity   # check-ins, logged workouts and bookings for one member
```

`db:seed:activity` clears that member's own history before rebuilding it, so it is re-runnable — but it also rewrites their sales, which will detach any real payment already recorded against them.

### Payments and the daily job

1. **PayMongo** — test keys are available without KYC; only live keys require business registration. Point a webhook at `https://<your-host>/api/webhooks/paymongo` for `checkout_session.payment.paid`, `payment.paid` and `payment.failed`, and put its signing secret in `PAYMONGO_WEBHOOK_SECRET`. The webhook is the **only** place a payment is marked paid.
2. **Brevo** — verify a sender address, then generate an API key. An unverified sender makes a working key look broken.
3. **Cron** — schedule `GET https://<your-host>/api/cron/daily` daily with header `Authorization: Bearer <CRON_SECRET>`. Every automated notification carries a dedupe key, so re-running the job creates no duplicates. On a free-tier database the same request also prevents the project pausing when idle.

Test it from the admin **Notifications** page with *Run now*, or:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-host>/api/cron/daily
```

---

## Design decisions worth knowing

- **The webhook is the only source of truth for payments.** A redirect back from a payment page proves the browser returned, not that money moved. The provider sends more than one event per payment and they do not arrive in the obvious order, so matching is idempotent on the provider's payment id.
- **Money units.** The payment provider works in centavos, this schema in whole pesos. Conversion happens in one file and nowhere else.
- **Chat polls; it is not a realtime subscription.** Realtime would need row-level security policies this schema does not have, and shipping it without them would expose every conversation.
- **Signed-in pages are never cached by the service worker.** Gym phones get shared.
- **Dates are stored as `dd-MM-yyyy` strings** (inherited from the original schema), so they cannot be ordered in SQL and are parsed in application code. `formatAppDate()` renders them; real `DateTime` columns are formatted with date-fns. Nothing uses the viewer's locale.

## Current limitations

- Payments run in the provider's **test mode**. Live keys require business registration documents.
- Web Push is not implemented; notifications are in-app and email.
- The retention weights are reasoned rather than trained on outcome data.

---

## Attribution

This project began as a fork of [atharvaarbat/gym-management](https://github.com/atharvaarbat/gym-management), which provided the initial CRUD scaffolding for members, sales and enquiries. Everything since — authentication and role-based access, the schema as it now stands, all three AI features, payments, notifications and the scheduled job, the dashboards, the PWA, and the current interface — was built on top of it.
