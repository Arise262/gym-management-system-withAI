# 🏋️‍♂️ Gym Management Software – atharvaarbat-gym-5

A full-featured, modern Gym Management Platform built with **Next.js**, **TypeScript**, **Prisma**, and **Tailwind CSS**. This project is a comprehensive tool for gym owners and trainers to manage members, attendance, sales, enquiries, diet plans, workout tracking, and much more – all from a responsive and intuitive dashboard.

---

![Plot](screenshots/1%20(1).png)
![.](screenshots/1%20(2).png)
![.](screenshots/1%20(3).png)
![.](screenshots/1%20(4).png)
![.](screenshots/1%20(5).png)
![.](screenshots/1%20(6).png)

## 🔧 Tech Stack

| Category       | Technology                          |
|----------------|--------------------------------------|
| Frontend       | React, Next.js (App Router), Tailwind CSS |
| Styling        | TailwindCSS, ShadCN UI               |
| Backend        | Next.js API Actions (Server Actions) |
| Database       | PostgreSQL (via Prisma ORM)          |
| Auth & Session | JWT-based authentication             |
| UI Components  | ShadCN UI, Lucide Icons              |
| State/Utils    | React hooks, utility modules         |
| Deployment     | Vercel (ideal), Docker-ready         |

---

## 📦 Features

### 👥 Member Management
- Register new members
- View, edit, or delete member details
- Track attendance history
- Birthday tracking
- View individual workout records

### 📅 Attendance
- Mark and view daily attendance
- Attendance summary per member
- Attendance history tab for reports

### 🏋️‍♀️ Exercise & Workout Management
- Create, edit and list exercises
- Assign workout plans per user
- Exercise data input system with categorized JSON structure

### 🥗 Diet Management
- Manage food items
- Create personalized diet plans
- Diet planner with dynamic input system

### 💰 Sales & Invoicing
- Manage gym service sales
- Generate and view invoices per sale
- Handle follow-ups and pending payments

### 📞 Enquiry Management
- Record and follow up on potential client enquiries
- Manage enquiry status and track conversions

### 💼 Services
- Add new services offered by the gym (e.g., personal training, Zumba, etc.)

### 📊 Dashboard & Analytics
- Administrative dashboard: KPI row (members, billed vs collected, outstanding balance, check-ins, members at risk, engagement score, active plans, trainer sessions), 30-day attendance, 6-month revenue, workouts per week, retention risk bands, memberships ending this week, pending payments
- Member progress page: workouts per week, week streak, plan adherence, training volume, body-weight trend, weekly engagement score
- Trainer roster: each client's plan, days since their last logged workout, sessions this month, engagement score
- Engagement monitoring: one `EngagementMetric` row per member per week (attendance, plan consistency, 0–100 score), recomputed by the daily job
- Every chart has a plain-table twin, a validated colour-blind-safe palette, and light/dark variants
- Custom tools: BMI, BMR, WHR calculators

### ✅ To-Do & Task Management
- Inbuilt to-do tracker for staff or admins

### 🛠 Tools Section
- Health metric calculators (BMI, BMR, WHR)

### 🔔 Notifications & scheduled jobs
- In-app notifications panel for members, trainers and admins (bell with unread badge)
- Email delivery through Brevo's transactional API, with retry for anything that did not go out
- Daily job at `/api/cron/daily` (guarded by `CRON_SECRET`, triggered by cron-job.org):
  - membership renewal warnings 7, 3 and 1 day(s) before expiry and on the day
  - workout reminders for members with an active plan and nothing logged for 3+ days (once a week)
  - retention re-scoring, with admin alerts for HIGH/CRITICAL members and a gentle nudge to the member that never mentions risk
  - a Monday progress summary of last week's workouts
- Event notifications: booking requested / confirmed / cancelled, payment receipt from the PayMongo webhook
- Trainer and admin announcements to their members, optionally by email
- Every automated notification carries a dedupe key, so re-running the job never sends a duplicate

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (locally or remote)
- Optional: Docker (for containerization)

### Setup

```bash
# Clone the repository
git clone https://github.com/atharvaarbat/gym-5.git
cd atharvaarbat-gym-5

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Add your DB credentials and JWT secret etc.

# Push database schema
npx prisma db push

# Run the development server
npm run dev
````

### Email and the daily job (optional)

1. **Brevo** — create a free account at https://app.brevo.com, verify a sender address under *Senders & IP → Senders*, then generate an API key under *Settings → SMTP & API → API Keys*. Put the key in `BREVO_API_KEY` and the verified address in `MAIL_FROM`. With the key empty, notifications are in-app only.
2. **CRON_SECRET** — `openssl rand -hex 32` and paste it into `.env` (and into the Vercel project's environment variables).
3. **cron-job.org** — create a job for `GET https://<your-host>/api/cron/daily`, daily at 07:00 Asia/Manila, with a custom header `Authorization: Bearer <CRON_SECRET>`. Enable failure notifications so a broken run emails you. The same request keeps the Supabase free-tier project from pausing after seven idle days.
4. Test it from the admin **Notifications** page with *Run now*, or by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-host>/api/cron/daily
```

---

## 🧠 Why this project?

This project was built to demonstrate:

* Full-stack application architecture using modern tools
* Real-world state and data management
* Clean component-based structure
* Reusable hooks and custom logic
* Scalable code patterns ideal for production
* Business logic via server actions (Next.js App Router)

---


**Crafted with 💪 by Atharva Arbat**