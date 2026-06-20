# 🏥 MediCura — Care, Decoded

MediCura is an AI-powered healthcare companion that decodes medical bills, surfaces cheaper medication alternatives, automates medication reminders, and offers a grounded conversational assistant — all behind strict, per-user privacy. Upload a bill (PDF, JPG, or PNG) in any currency, and MediCura parses every line item, flags duplicate or unusually high charges, extracts prescribed medications, and builds a dosing schedule automatically.

---

## ✨ Features

- **Multi-currency bill parsing** — Drag-and-drop PDF/JPG/PNG bills. Google Gemini 2.5 Flash (via Lovable AI Gateway) extracts hospital name, total, ISO 4217 currency (USD, INR, EUR, GBP, JPY, AED…), and every line item exactly as printed — no currency conversion, no item merging.
- **Itemized billing audit** — Each line item is flagged for duplicates, vague charges, or pricing outliers with `info`, `warning`, or `high` severity badges.
- **Plain-English summaries** — Every bill gets a friendly 2–3 sentence explanation.
- **Medication cost optimizer** — Partial matches against the bundled reference dataset, with an LLM fallback for off-database prescriptions returning generic equivalents and estimated savings.
- **Automatic medication reminders** — Prescriptions detected on a bill are turned into daily reminders with native browser notifications and an adherence log.
- **Billing-office review email** — Generates a polite, line-itemized dispute letter and sends it via Resend (through the Lovable connector gateway). Falls back to a one-click *Copy* / *Open in mail app* flow when the provider isn't configured.
- **Grounded AI chat assistant** — Floating + full-screen chatbot scoped to the user's bills and medications; refuses off-topic, diagnostic, or jailbreak requests.
- **Consistent currency formatting everywhere** — Dashboard totals, savings badges, bill detail, alternative-medication prices, and outbound emails all render in the bill's original currency via a shared `formatCurrency` helper.
- **Private by default** — Row-Level Security on every user-owned table; uploaded files isolated per-user in Supabase Storage.

---

## 🛠️ Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) v1 (React 19, file-based routing, server functions)
- **Build**: Vite 7
- **Styling**: Tailwind CSS v4, Radix UI primitives, shadcn/ui, Lucide icons, Framer Motion
- **State / data**: TanStack Query
- **Backend**: Lovable Cloud (Postgres, Auth, Storage, RLS)
- **AI**: Lovable AI Gateway → `google/gemini-2.5-flash`
- **Email**: Resend via Lovable connector gateway
- **Runtime**: [Bun](https://bun.sh)

---

## 📁 Project Layout

```text
src/
├── components/          # App shell, sidebar, chat widget, shadcn primitives
├── hooks/               # use-current-user, use-active-thread, use-mobile
├── integrations/supabase/  # Auto-generated clients & middleware (do not edit)
├── lib/
│   ├── bills.functions.ts       # Bill parsing (Gemini) + reminder seeding
│   ├── medications.functions.ts # DB + AI alternative finder
│   ├── email.functions.ts       # Billing-review draft + Resend send
│   └── currency.ts              # Shared multi-currency formatter
├── routes/
│   ├── _authenticated/  # Gated dashboard, bills, reminders, chat, profile
│   ├── api/chat.ts      # Chatbot server endpoint
│   ├── auth.tsx         # Sign in / sign up (email + Google)
│   └── __root.tsx       # Global shell, providers, error boundary
└── styles.css
supabase/migrations/     # Schema, RLS, triggers
```

---

## 🗄️ Database

| Table            | Purpose                                       | RLS                |
| ---------------- | --------------------------------------------- | ------------------ |
| `profiles`       | User metadata (name, insurance provider)      | Owner-only         |
| `bills`          | Parsed bills, items (JSONB), currency, totals | Owner-only         |
| `reminders`      | Scheduled medication doses                    | Owner-only         |
| `reminder_logs`  | Doses marked as taken                         | Owner-only         |
| `medications`    | Brand → generic pricing reference dataset     | Public read        |
| `chat_threads`   | Assistant conversation metadata               | Owner-only         |
| `chat_messages`  | Assistant message history                     | Owner-only         |

Triggers: `set_updated_at()` keeps `updated_at` fresh; `handle_new_user()` auto-creates a profile on signup.

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- A Lovable Cloud (Supabase) project

### Install & run

```bash
bun install
bun run dev
```

Open <http://localhost:3000>.

### Production build

```bash
bun run build
bun run start
```

---

## 🔐 Environment Variables

Create a `.env` in the project root. Placeholders only — never commit real keys.

```env
# Lovable Cloud / Supabase
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx          # server-only, never expose
SUPABASE_DB_URL=postgresql://...                  # for migrations

# Client-visible (Vite)
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_SUPABASE_PROJECT_ID=your-project-id

# Lovable AI Gateway (auto-provisioned in Lovable Cloud)
LOVABLE_API_KEY=lov_xxx

# Resend (via Lovable connector — optional, email falls back to mailto: if unset)
RESEND_API_KEY=lovc_xxx                           # connector connection key
RESEND_FROM_EMAIL=MediCura <onboarding@resend.dev>
```

On Lovable Cloud, `LOVABLE_API_KEY`, the Supabase keys, and `RESEND_API_KEY` (via the Resend connector) are managed automatically — no manual setup required.

---

## 📦 Deployment

### Lovable Hosting (recommended)

1. Click **Publish** in the Lovable editor.
2. Frontend changes go live after pressing **Update** in the publish dialog; backend (server functions, migrations) deploys immediately.
3. Attach a custom domain in **Project Settings → Domains**.

Routing works out-of-the-box — deep links and hard refreshes on nested routes (e.g. `/bills/:billId`) resolve correctly with no `_redirects` or rewrite rules.

### Self-hosting

Any platform that runs a Node/Bun server and Cloudflare Worker-compatible runtime works. Build with `bun run build`, then serve the output. See the [TanStack Start deployment docs](https://tanstack.com/start/latest/docs/framework/react/hosting) for platform-specific guides.

---

## 🔒 Security & Privacy

- Row-Level Security on every user-owned table; policies scoped to `auth.uid()`.
- The `bills` storage bucket enforces per-user folders (`auth.uid()`); signed URLs can't escape your own folder.
- Service role key stays server-only — never imported into client code.
- The AI assistant has strict guardrails: it refuses diagnostic, off-topic, or code/roleplay requests and stays within billing, medication, and insurance questions.

---

## 📝 License

MIT
