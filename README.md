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
| **Onboarding** | 14 | Create customer, KYC verification, document upload, wallet setup, deposit details (SEPA / FEDWIRE / SWIFT rails) |
| **Virtual Accounts** | 4 | Create virtual account, IBAN assignment, list accounts, deposit simulation |
| **Withdrawals** | 5 | Add SEPA / FEDWIRE / SWIFT bank, list banks, check allowance, create withdrawal (source or target amount), track status (PROCESSING → PROPOSED → PARTIALLY_SIGNED → COMPLETED, plus FAILED/CANCELLED/EXPIRED in error mode) |
| **Revenue** | 4 | Org balances, developer fee balance, claim fees, transfer confirmation |
| **Wallets** | 4 | List wallets, get detail, update address, delete wallet |
| **Rates** | 3 | Indicative deposit quote, withdrawal quote, customer-specific quote (with `developer_fee` breakdown) |

## Features

- **Simulated API responses** aligned with the [openapi-v2.json](https://compose.finance/openapi-v2.json) spec
- **Real-time webhook simulation** showing the exact event payloads your server will receive
- **Code snippets** in cURL, JavaScript, and Python for every endpoint
- **Error mode** toggle to demo failure scenarios (KYC rejection, insufficient balance, etc.)
- **Autoplay** walks through an entire flow automatically
- **Sequence diagrams** showing the interaction between your app, Compose API, providers, and webhooks
- **Keyboard shortcuts** for fast navigation (`?` to view)

## API Coverage

All 30 endpoints from the Customers API v2 spec (`2026-09-03`) are demonstrated, including:

- `POST /api/v2/customers` — Create customer
- `POST /api/v2/customers/{id}/kyc` — Initiate KYC
- `POST /api/v2/customers/{id}/documents` — Upload KYC document
- `GET /api/v2/customers/{id}/kyc/address` — Get verified address
- `POST /api/v2/customers/{id}/deposit/wallets` — Configure wallets
- `POST /api/v2/verify-address` — Verify Ethereum address
- `PATCH /api/v2/customers/{id}/developer-fees` — Set developer fees
- `GET /api/v2/customers/{id}/deposit?paymentRail=SEPA|FEDWIRE|SWIFT` — Get deposit instructions per payment rail
- `POST /api/v2/customers/{id}/virtual-account` — Create virtual account
- `POST /api/v2/customers/{id}/withdrawal/banks` — Add a SEPA (IBAN/BIC), FEDWIRE (account/routing), or SWIFT (account/BIC + bank) bank
- `POST /api/v2/customers/{id}/withdrawal` — Create withdrawal (`sourceAmount` or `targetAmount`)
- `GET /api/v2/balances` — Organization balances
- `GET /api/v2/rates` — Indicative rate quote (EUR↔USDC, EUR↔EURC, USD→USDC), optionally per `payment_rail` with a `developer_fee` breakdown

> **Payment rails (spec `2026-07-02`):** withdrawal banks and deposit details are now modeled by payment rail — **SEPA** (EUR), **FEDWIRE** (USD domestic), and **SWIFT** (USD international) — replacing the earlier EUR/USD split. The discriminator is `paymentRail`.

> **Spec `2026-09-03`:** bank responses carry `fundingSource` (`VIRTUAL_ACCOUNT` or `COMPOSE_SHARED`, which determines the sender name your customer sees) plus a required `postalCode`. USD SWIFT deposits now route through ClearBank and are identified by IBAN rather than an account number.

### Travel Rule

Deposit wallets declare `walletType` (`SELF_CUSTODY` or `CUSTODIAL`, with `vaspName` for the latter) and require `ownershipAttested` on every create and address change. Untick the attestation box in the wallet panel to see the 400.

### Webhooks

16 webhook event types are simulated across all flows (including `customer.updated`). Envelopes are camelCase — `eventId`, `eventType`, `createdAt`, `apiVersion`, `orgId`, `data` — matching what your server actually receives.

Not demonstrated, as no flow triggers them: `customer.enabled`, `customer.disabled`. Note there is no webhook for developer fee claims — poll `GET /api/v2/developer-fees` to confirm a claim settled.

## Linting

```bash
npm run lint      # ESLint (React + hooks) and a JSX-escape check
npm run lint:fix  # apply autofixes
```

`scripts/check-jsx-escapes.mjs` catches `\uXXXX` escapes written into JSX *text*, where they render as literal characters instead of the intended glyph. ESLint does not flag this, and it has reached the rendered page more than once.

`react-hooks/set-state-in-effect` and `exhaustive-deps` are currently set to **warn** rather than error: `demo.jsx` has six pre-existing violations in the autoplay loop and the unread-webhook badge that need a real refactor of those effects. Please burn them down rather than adding to them, then raise both back to `error` in `eslint.config.js`.

## Tech Stack

- React 19 + Vite 5
- Single-file component (`demo.jsx`) — no external UI dependencies
- Compose Finance dark mode brand palette

## Build

```bash
npm run build    # Production build to dist/
npm run preview  # Preview production build
```
