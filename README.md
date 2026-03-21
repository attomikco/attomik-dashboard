# Attomik Dashboard

Multi-tenant ecommerce analytics dashboard. Built with Next.js 14, Supabase, and Recharts.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind
- **Auth**: Supabase Auth (magic link)
- **Database**: Supabase (Postgres + Row-Level Security)
- **Charts**: Recharts
- **Deployment**: Vercel

---

## Local Setup

### 1. Prerequisites

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node, Git, GitHub CLI
brew install node git gh

# Install VS Code
brew install --cask visual-studio-code
```

### 2. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/attomik-dashboard.git
cd attomik-dashboard
npm install
```

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your Supabase credentials (from supabase.com → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 4. Database setup

Go to your Supabase project → SQL Editor → run the contents of `supabase/schema.sql`.

### 5. Create your first org + user

After running the schema, create your org manually in the SQL editor:

```sql
-- 1. Create the org
INSERT INTO organizations (name, slug)
VALUES ('Attomik LLC', 'attomik');

-- 2. After logging in via magic link, link your user to the org:
-- (replace the email and org slug with your values)
UPDATE profiles
SET org_id = (SELECT id FROM organizations WHERE slug = 'attomik'),
    role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'you@attomik.co');
```

### 6. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── app/
│   ├── auth/login/          ← Login page (magic link)
│   ├── api/
│   │   ├── upload/csv/      ← CSV import endpoint
│   │   └── sync/shopify/    ← Shopify sync endpoint
│   └── dashboard/
│       ├── revenue/         ← Revenue & Sales page
│       ├── customers/       ← Customers & Retention page
│       ├── import/          ← CSV upload UI
│       └── settings/        ← Org settings
├── components/
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   ├── KpiCard.tsx
│   ├── RevenueChart.tsx
│   ├── OrdersTable.tsx
│   └── CsvUpload.tsx
├── lib/
│   └── supabase/
│       ├── client.ts        ← Browser client
│       └── server.ts        ← Server + service role client
├── middleware.ts             ← Auth gate (protects all dashboard routes)
└── types/index.ts            ← Shared TypeScript types
```

---

## Adding a New Client

1. Insert a row into `organizations`
2. Have the client sign in via magic link
3. Run the SQL to link their `profiles.org_id`
4. Their data is automatically isolated via Row-Level Security

```sql
INSERT INTO organizations (name, slug) VALUES ('Client Name', 'client-slug');

UPDATE profiles
SET org_id = (SELECT id FROM organizations WHERE slug = 'client-slug'),
    role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'client@email.com');
```

---

## CSV Import

The importer auto-detects file type (orders vs ad spend) and column names. Supports exports from:

- Shopify (orders export)
- Meta Ads (campaign performance export)
- Amazon (flat file orders report)
- Custom formats

---

## Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Add all `.env.local` variables to your Vercel project's Environment Variables.

---

## Roadmap

- [ ] Shopify OAuth (auto-connect instead of manual token)
- [ ] Meta Ads API sync
- [ ] Amazon SP-API sync
- [ ] Google Ads sync
- [ ] Date range picker on all charts
- [ ] Client-switching dropdown (for agency view)
- [ ] Email reports
