# NanoDrop

Nano cryptocurrency (XNO) Faucet. Easy, clean and fast!

![faucet](https://github.com/nanodrop/nanodrop.io/assets/32111208/2b180e12-e07b-4c3c-9d1e-d6963a8ae8ba)

Visit: https://nanodrop.io

### Introduction

This project was created to help bring <a href="https://nano.org">Nano</a> to the masses.

Faucets are efficient ways to introduce cryptocurrency to new users.
Any amount is enough to show the benefits of Nano cryptocurrency: simple, instant, no fees.

NanoDrop is not only another Nano faucet, but the first open source Nano's Faucet.

It's built with **React**, **Next.JS**, **Tailwind** and **Material UI**

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
  - Cryptographically signed tickets with amount, ip and expiration
  - Invisible anti-bot verification
  - Limit per Nano account
  - Limit per IP address

### API

To ensure scalability and fast transactions, we created a separate codebase just for the API, found in the following repository: https://github.com/nanodrop/nanodrop-api

### Donations

NanoDrop is a free, voluntary and open source initiative.
We don't use ads, we don't sell personal data.
Our focus is to bring Nano to the masses.

If you like it consider making a small donation, helping to distribute Nano to other users.

https://nanodrop.io/donate

### Contact:

hello@nanodrop.io
