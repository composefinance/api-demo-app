# Compose Finance API Demo

Interactive simulator for the [Compose Finance Customers API v2](https://compose.finance). Walk through complete API flows with simulated responses, webhook events, and code snippets — no backend required.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Flows

| Flow | Steps | Endpoints Covered |
|------|-------|-------------------|
| **Onboarding** | 14 | Create customer, KYC verification, document upload, wallet setup, deposit details |
| **Virtual Accounts** | 4 | Create virtual account, IBAN assignment, list accounts, deposit simulation |
| **Withdrawals** | 5 | Add bank, list banks, check allowance, create withdrawal, track status |
| **Revenue** | 4 | Org balances, developer fee balance, claim fees, transfer confirmation |
| **Wallets** | 4 | List wallets, get detail, update address, delete wallet |

## Features

- **Simulated API responses** aligned with the [openapi-v2.json](https://compose.finance/openapi-v2.json) spec
- **Real-time webhook simulation** showing the exact event payloads your server will receive
- **Code snippets** in cURL, JavaScript, and Python for every endpoint
- **Error mode** toggle to demo failure scenarios (KYC rejection, insufficient balance, etc.)
- **Autoplay** walks through an entire flow automatically
- **Sequence diagrams** showing the interaction between your app, Compose API, providers, and webhooks
- **Keyboard shortcuts** for fast navigation (`?` to view)

## API Coverage

All 31 endpoints from the Customers API v2 spec are demonstrated, including:

- `POST /api/v2/customers` — Create customer
- `POST /api/v2/customers/{id}/kyc` — Initiate KYC
- `POST /api/v2/customers/{id}/documents` — Upload KYC document
- `GET /api/v2/customers/{id}/kyc/address` — Get verified address
- `POST /api/v2/customers/{id}/deposit/wallets` — Configure wallets
- `POST /api/v2/verify-address` — Verify Ethereum address
- `PATCH /api/v2/customers/{id}/developer-fees` — Set developer fees
- `GET /api/v2/customers/{id}/deposit` — Get deposit instructions
- `POST /api/v2/customers/{id}/virtual-account` — Create virtual account
- `POST /api/v2/customers/{id}/withdrawal` — Create withdrawal
- `GET /api/v2/balances` — Organization balances

15 webhook event types are simulated across all flows.

## Tech Stack

- React 19 + Vite 5
- Single-file component (`demo.jsx`) — no external UI dependencies
- Compose Finance dark mode brand palette

## Build

```bash
npm run build    # Production build to dist/
npm run preview  # Preview production build
```
