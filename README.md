# 🏥 MediCura — Care, Decoded

MediCura is an AI-powered healthcare assistant designed to decode medical bills, surface cheaper medication alternatives, and help users manage their medication reminders with absolute privacy.

By uploading a medical bill (image or PDF), MediCura automatically analyzes CPT/HCPCS codes, flags duplicate or unusually high charges, suggests generic equivalents, sets up medication schedules, and provides a conversational AI assistant to navigate healthcare billing questions.

---

## 🌟 Key Features

### 1. AI-Powered Medical Bill Parser
* **Multi-Format Ingestion**: Supports drag-and-drop uploads of PDF, JPG, and PNG medical bills.
* **Document Extraction**: Leverages Google Gemini 2.5 Flash via Lovable's AI Gateway to securely parse billing entities.
* **Plain-English Summaries**: Provides direct, readable 2-to-3 sentence overviews of complex billing items.
* **Itemized Billing Audit**: Flags duplicate billing line-items, vague fees, or overpriced services using severity scales (`info`, `warning`, `high`).
* **Automated Medication Extraction**: Detects prescription drugs within the bill and suggests appropriate dosing schedules.

### 2. Medication Cost Optimizer
* **Reference Database Matching**: Performs instant partial matches against a local reference database of brand-to-generic pricing.
* **AI Generic Alternatives**: For off-database prescriptions, queries Gemini to retrieve FDA-approved generic equivalents, estimated retail brand vs. generic pricing, and savings opportunities.

### 3. Medication Reminders & Logs
* **Calendar Scheduling**: Set dosages, times, and day-of-week frequencies.
* **In-Tab Web Scheduler**: Regularly checks active reminders and fires native browser notification alerts when a dose is due.
* **Adherence Logging**: Allows users to check off medications as "Taken", creating a persistent history log in the database.

### 4. Billing Office Review Coordinator
* **Dispute Templates**: Automatically structures polite review request letters detailing flagged charges.
* **Resend Integration**: Sends requests directly to the hospital's billing department.
* **Client-Side Fallbacks**: Provides one-click copy-to-clipboard and `mailto:` links if the mail server is unconfigured.

### 5. Grounded AI Assistant Chatbot
* **Context-Aware Assistance**: Floats throughout the dashboard, populated with the user's latest bill items and history.
* **Medical Policy Alignment**: Guided by strict prompt constraints that restrict responses to billing, medication alternatives, and insurance questions, redirecting generic off-topic prompts or diagnostic requests.

---

## 🛠️ Technology Stack

* **Frontend & SSR Framework**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (React 19, TypeScript, and Server Functions).
* **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL database, Row Level Security, Storage buckets, and automatic Profile triggers).
* **AI Provider**: Lovable AI Gateway (wrapping `google/gemini-2.5-flash`).
* **Styling**: Tailwind CSS v4, Lucide React icons, Radix UI Primitives, and Framer Motion animations.
* **Package Manager**: [Bun](https://bun.sh/).

---

## 📁 Repository Structure

```text
medicura/
├── supabase/                    # Database migrations and configurations
│   ├── config.toml              # Supabase configuration
│   └── migrations/              # PostgreSQL schema migrations and security policies
├── src/                         # Application source code
│   ├── components/              # UI Components
│   │   ├── ui/                  # Reusable Radix UI & Shadcn primitives
│   │   ├── app-shell.tsx        # Responsive dashboard framing & page headers
│   │   ├── app-sidebar.tsx      # Main application navigation menu & signout
│   │   └── chat-widget.tsx      # Floating grounded AI assistant chatbot
│   ├── hooks/                   # Custom React Hooks
│   │   ├── use-active-thread.ts # Manages the active assistant chat session ID
│   │   ├── use-current-user.ts  # Fetches current Supabase User & Profile data
│   │   └── use-mobile.tsx       # Handles sidebar responsive toggle state
│   ├── integrations/            # Database and API clients
│   │   └── supabase/
│   │       ├── auth-attacher.ts # Global client-side RPC header authorization middleware
│   │       ├── auth-middleware.ts # Server-side token validation & RLS verification
│   │       ├── client.server.ts # Service role admin client (bypasses RLS)
│   │       ├── client.ts        # Client-side Supabase instance
│   │       └── types.ts         # Generated TypeScript schema mappings
│   ├── lib/                     # Server functions and shared utilities
│   │   ├── bills.functions.ts   # Gemini-powered bill scanning and parser
│   │   ├── email.functions.ts   # Resend email templates and integrations
│   │   ├── medications.functions.ts # Pricing search & generic alternative finder
│   │   └── utils.ts             # Tailwind merging utilities
│   ├── routes/                  # TanStack Router Pages (Vite-mapped filesystem routing)
│   │   ├── _authenticated/      # Route-guarded pages
│   │   │   ├── bills.$billId.tsx# Individual bill itemization and optimizer details
│   │   │   ├── bills.tsx        # History of all parsed bills
│   │   │   ├── bills.upload.tsx # PDF & Image drag-and-drop bill decoder
│   │   │   ├── chat.tsx         # Full-screen conversational assistant interface
│   │   │   ├── index.tsx        # Main stats dashboard
│   │   │   ├── profile.tsx      # Insurance provider and user profile settings
│   │   │   ├── reminders.tsx    # Medication scheduler and logging interface
│   │   │   └── route.tsx        # Authentication wall and state manager
│   │   ├── api/
│   │   │   └── chat.ts          # Server endpoint handling chatbot requests
│   │   ├── __root.tsx           # Global Shell, TanStack Query, and Sonner providers
│   │   ├── auth.callback.tsx    # OAuth callback handler
│   │   ├── auth.tsx             # Login / Register forms (password & magic link)
│   │   ├── reset-password.tsx   # Password recovery verification
│   │   └── verify-email.tsx     # Signup email activation banner
│   ├── server.ts                # SSR wrapper & catastrophic error customizer
│   ├── start.ts                 # TanStack Start hydration configuration
│   └── styles.css               # Core CSS & Tailwind configurations
├── tsconfig.json                # TypeScript compiler configurations
└── vite.config.ts               # Vite bundler, path aliases, & routing plugin config
```

---

## 🗄️ Database Schema & RLS Policies

All database interactions utilize PostgreSQL Row Level Security (RLS) policies to ensure absolute user privacy. Users can only view, insert, or modify their own data.

### Database Tables

| Table Name | Description | Key Fields & Relationships | Security (RLS) Policy |
| :--- | :--- | :--- | :--- |
| `profiles` | Stores user metadata. | `id` (FK to `auth.users`), `full_name`, `insurance_provider` | Read/Write restricted to owner. |
| `bills` | Decoded bill history. | `id` (UUID), `user_id` (FK), `billing_items` (JSONB), `potential_savings` | Read/Write/Delete restricted to owner. |
| `reminders` | Active pill reminders. | `id` (UUID), `user_id` (FK), `medication_name`, `schedule_time` (Time) | Read/Write/Delete restricted to owner. |
| `reminder_logs` | Doses checked off as taken. | `id` (UUID), `reminder_id` (FK to `reminders`), `taken_at` | Read/Write/Delete restricted to owner. |
| `medications` | Brand-to-generic pricing data. | `name`, `generic_equivalent`, `cheaper_alternative`, `average_cost` | Publicly readable. |
| `chat_threads` | Chatbot session metadata. | `id` (UUID), `user_id` (FK), `title` | Read/Write/Delete restricted to owner. |
| `chat_messages` | Conversation history. | `id` (UUID), `thread_id` (FK to `chat_threads`), `role`, `parts` (JSONB) | Read/Write/Delete restricted to owner. |

### PostgreSQL Triggers & Functions
1. **`public.set_updated_at()`**: Automatically bumps the `updated_at` timestamp on row modifications (`profiles`, `bills`, `reminders`, `chat_threads`).
2. **`public.handle_new_user()`**: Fired `AFTER INSERT` on `auth.users` to automatically instantiate a corresponding profile row in `public.profiles`.

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase Project Connection Details
SUPABASE_URL=your-supabase-project-url
SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Vite x Supabase Integration
VITE_SUPABASE_PROJECT_ID="crwynbqevbfoarhofgqm"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable__FmpU1_9a3P_qXES0vgymg_mKE51Mkd"
VITE_SUPABASE_URL="https://crwynbqevbfoarhofgqm.supabase.co"

# Transactional Mail (Optional; for sending dispute review emails)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=MediCura <onboarding@resend.dev>
```

---

## 🚀 Getting Started

### Prerequisites
* [Bun](https://bun.sh/) runtime installed.
* A running Supabase instance (Cloud or Local).

### Installation & Run

1. **Clone the repository and install dependencies**:
   ```bash
   bun install
   ```

2. **Database setup**:
   Apply migrations to your Supabase PostgreSQL instance:
   ```bash
   # If using Supabase CLI locally:
   supabase migration up
   ```

3. **Start the local development server**:
   ```bash
   bun run dev
   ```
   Open `http://localhost:3000` in your web browser.

4. **Production Build**:
   ```bash
   bun run build
   bun run preview
   ```

---

## 🔒 Security & Privacy Features

* **Data Isolation**: Database-level Row Level Security policies guarantee that medical data and uploaded documents are strictly private to each authenticated account.
* **Storage Isolation**: The Supabase Storage `bills` bucket enforces folders keyed by User ID (`auth.uid()`). A user cannot generate signed URLs or request downloads for files residing outside their corresponding folder.
* **AI Guardrails**: The chatbot includes strict instructions to reject non-healthcare/non-billing requests, ensuring the model never writes code, roleplays, or attempts diagnoses.
