# NanoDrop

Nano cryptocurrency (XNO) Faucet. Easy, clean and fast!

![faucet](https://github.com/nanodrop/nanodrop.io/assets/32111208/2b180e12-e07b-4c3c-9d1e-d6963a8ae8ba)

Visit: https://nanodrop.io

### Introduction

This project was created to help bring <a href="https://nano.org">Nano</a> to the masses.

Faucets are efficient ways to introduce cryptocurrency to new users.
Any amount is enough to show the benefits of Nano cryptocurrency: simple, instant, no fees.

NanoDrop is not only another Nano faucet, but the first open source Nano's Faucet.

It's built with **React**, **Next.JS**, **OpenNext**, **Cloudflare Workers**, **Tailwind** and **Material UI**

### Features:

- Clean and responsive UI with light and dark mode
- Automatic, rounded amount based on 0.01% of balance
- Custom checkbox.
- QR code reader.
- Transactions history with geolocation.
- PoW cache, allowing for always instant transactions.
- Public API for faucet data.
- XNO Price
- Error tracking with Sentry
- Anti-spam and anti-bot barriers such as:
  - Server-side faucet status checks before bot verification
  - Invisible anti-bot verification
  - Limit per Nano account
  - Limit per IP address
  - Admin-managed IP and account blacklists

### API

The faucet API is now internalized in this project and served from the same Worker under `/api/*`.
Only endpoints consumed by public pages are exposed under the public API namespace.
Administrative faucet operations are exposed through `/api/admin/*`.
The price API is also Worker-owned and served from `/api/price`.

The internal API keeps the original architecture:

- Hono for HTTP routing
- Durable Objects for wallet state and anti-spam coordination
- D1 for drop history and country/proxy metadata
- A SQL-backed `CoinMarketCapDO` Durable Object for XNO price cache state

The custom Worker entrypoint lives in [`worker.ts`](/home/anarkrypto/workspace/nanodrop/nanodrop.io/worker.ts) and forwards non-API traffic to the OpenNext-generated handler.

### Admin Dashboard

The admin dashboard is served at `/admin` and authenticates through `ADMIN_TOKEN`.
Privileged dashboard requests go through `/api/admin/*`.
The custom Worker validates the admin session for those requests and forwards them to the faucet Durable Object with the `ADMIN_TOKEN` bearer contract.

The faucet Durable Object stores admin-managed whitelist and blacklist entries in its local SQL storage.
Blacklist checks run before drop-limit whitelist exemptions, so a blocked IP address or Nano account cannot receive faucet status or drops until it is removed from the blacklist.

### Local development

Default local development now starts both the UI and the faucet API without building OpenNext first:

```bash
npm install
npm run dev
```

This runs:

- `next dev` for the UI
- `wrangler dev --config wrangler.dev.jsonc` for the faucet API and Durable Object

During `npm run dev`, the browser still calls the same-origin public API under `/api`.
The dev-only route handler at [`src/app/api/[[...path]]/route.ts`](/home/anarkrypto/workspace/nanodrop/nanodrop.io/src/app/api/[[...path]]/route.ts) proxies the public API paths to the local faucet worker on `http://127.0.0.1:8787`.
Admin dashboard requests still call `/api/admin/*`; the dev route handler proxies those requests to the local faucet worker under its internal `/admin/*` route namespace.
The same local Worker also serves `/api/price`; a Next dev rewrite proxies `/api/price` to `http://127.0.0.1:8787/api/price`.

If you want to run only the UI, use:

```bash
npm run dev:ui
```

If you want to run only the faucet worker, use:

```bash
npm run dev:api
```

Before the first local API run, apply the local D1 migrations:

```bash
npm run db:local:migrate
```

Setup checklist:

1. Copy `example.env.local` to `.env.local`
2. Fill the Next.js values and faucet Worker vars/secrets in `.env.local`
3. Do not keep an active `.dev.vars` file locally; Wrangler gives `.dev.vars` precedence and will not load `.env*` values into the local Worker env when it exists

For runtime-accurate unified Worker validation, use preview mode:

Start the Worker preview:

```bash
npm run preview
```

In production-like runtimes, the frontend also talks to the same-origin public API under `/api`.
The admin dashboard talks to the same-origin admin route at `/api/admin`.
The frontend price ticker talks to the same-origin Worker route at `/api/price`.

### Donations

NanoDrop is a free, voluntary and open source initiative.
We don't use ads, we don't sell personal data.
Our focus is to bring Nano to the masses.

If you like it consider making a small donation, helping to distribute Nano to other users.

https://nanodrop.io/donate

### Contact:

hello@nanodrop.io
