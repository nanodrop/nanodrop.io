# NanoDrop

Nano cryptocurrency (XNO) faucet. Easy, clean, and fast.

![faucet](https://github.com/nanodrop/nanodrop.io/assets/32111208/2b180e12-e07b-4c3c-9d1e-d6963a8ae8ba)

Visit: https://nanodrop.io

### Introduction

This project was created to help bring <a href="https://nano.org">Nano</a> to the masses.

Faucets are efficient ways to introduce cryptocurrency to new users.
Any amount is enough to show the benefits of Nano cryptocurrency: simple, instant, no fees.

NanoDrop is not just another Nano faucet; it is an open source Nano faucet.

It's built with **React**, **Next.js**, **OpenNext**, **Cloudflare Workers** and **Tailwind**.

### Features

- Clean and responsive UI with light and dark mode
- Automatic, rounded amount based on 0.01% of balance
- QR code reader
- Transaction history with geolocation
- PoW cache for instant transactions
- XNO price ticker
- Error tracking with Sentry
- Anti-spam and anti-bot barriers such as:
  - CAPTCHA for anti-bot verification
  - Limit per Nano account
  - Limit per IP address
  - Admin-managed IP and account blacklists

### Admin Dashboard

The admin dashboard is served at `/admin` and uses `ADMIN_TOKEN` for authentication.
Administrative routes are served under `/api/admin/*`.

The dashboard manages faucet settings, wallet operations, whitelist entries, and blacklist entries.
Blacklist rules take precedence over whitelist exemptions.

### Local development

Default local development starts both the UI and the Worker API:

```bash
npm install
npm run dev
```

This runs:

- `next dev` for the UI
- `wrangler dev --config wrangler.dev.jsonc` for the Worker API and Durable Objects

If you want to run only the UI, use:

```bash
npm run dev:ui
```

If you want to run only the Worker API, use:

```bash
npm run dev:api
```

If you run Wrangler manually, apply the local D1 migrations first:

```bash
npm run db:local:migrate
```

Setup checklist:

1. Copy `example.env.local` to `.env.local`
2. Fill the Next.js values and faucet Worker vars/secrets in `.env.local`
3. Do not keep an active `.dev.vars` file locally; Wrangler gives `.dev.vars` precedence and will not load `.env*` values into the local Worker env when it exists

For runtime-accurate validation, use preview mode:

```bash
npm run preview
```

### Production

Create the Cloudflare D1 database once. D1 is the SQLite database used by the Worker runtime:

```bash
npx wrangler d1 create nanodrop-db-production
```

Copy the generated `database_id` into the `NANODROP_DB` binding in `wrangler.jsonc`.
Use the same command with a different name if you also need a staging database, then update the `env.staging.d1_databases` entry.

Apply the remote D1 migrations before the first deploy and whenever new migrations are added:

```bash
npm run db:production:migrate
```

For staging:

```bash
npm run db:staging:migrate
```

Configure all runtime environment values as Cloudflare secrets:

```bash
npx wrangler secret put NEXT_PUBLIC_SITE_URL
npx wrangler secret put DEFAULT_RPC_URLS
npx wrangler secret put DEFAULT_WORKER_URLS
npx wrangler secret put DEFAULT_REPRESENTATIVE
npx wrangler secret put NEXT_PUBLIC_DONATION_ADDRESS
npx wrangler secret put NEXT_PUBLIC_SENTRY_DSN
npx wrangler secret put PRIVATE_KEY
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put HCAPTCHA_SECRET
npx wrangler secret put CMC_PRO_API_KEY
```

For staging secrets, add `--env staging`.

Deploy to production:

```bash
npm run deploy
```

### Donations

NanoDrop is a free, voluntary and open source initiative.
We don't use ads, we don't sell personal data.
Our focus is to bring Nano to the masses.

If you like it, consider making a small donation to help distribute Nano to other users.

https://nanodrop.io/donate

### Contact:

hello@nanodrop.io
