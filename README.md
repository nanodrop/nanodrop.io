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

### API

The faucet API is now internalized in this project and served from the same Worker under `/api/faucet/*`.

The internal API keeps the original architecture:

- Hono for HTTP routing
- Durable Objects for wallet state and anti-spam coordination
- D1 for drop history and country/proxy metadata

The custom Worker entrypoint lives in [`worker.ts`](/home/anarkrypto/workspace/nanodrop/nanodrop.io/worker.ts) and forwards all non-faucet traffic to the OpenNext-generated handler.

### Local development

Default local development now starts both the UI and the faucet API without building OpenNext first:

```bash
npm install
npm run dev
```

This runs:

- `next dev` for the UI
- `wrangler dev --config wrangler.faucet-dev.jsonc` for the faucet API and Durable Object

During `npm run dev`, the browser still calls the same-origin faucet route at `/api/faucet`.
The dev-only route handler at [`src/app/api/faucet/[[...path]]/route.ts`](/home/anarkrypto/workspace/nanodrop/nanodrop.io/src/app/api/faucet/[[...path]]/route.ts) proxies that path to the local faucet worker on `http://127.0.0.1:8787`.

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
2. Copy `.dev.vars.example` to `.dev.vars` and fill the faucet secrets/vars

For runtime-accurate unified Worker validation, use preview mode:

3. Start the Worker preview:

```bash
npm run preview
```

In production-like runtimes, the frontend also talks to the same-origin faucet route at `/api/faucet`.

### Donations

NanoDrop is a free, voluntary and open source initiative.
We don't use ads, we don't sell personal data.
Our focus is to bring Nano to the masses.

If you like it consider making a small donation, helping to distribute Nano to other users.

https://nanodrop.io/donate

### Contact:

hello@nanodrop.io
