import { useState, useEffect, useRef, useCallback } from "react";

// ─── Simulated API data based on actual OpenAPI spec ───
// Webhook events not demonstrated in this demo (no matching flow):
// - customer.updated: No flow modifies customer-level fields (name, email, etc.)
// - customer.enabled / customer.disabled: No enable/disable customer lifecycle flows
const DEMO_CUSTOMER = {
  customerId: "550e8400-e29b-41d4-a716-446655440001",
  email: "marco.rossi@example.com",
  name: "MARCO ROSSI",
  accountType: "individual",
  expectedMonthlyVolume: 25000,
};

const KYC_RESPONSE = {
  kycFlowLink: "https://in.sumsub.com/websdk/p/sbx_AbCdEfGhIj",
  kycVerified: false,
};

const CUSTOMER_DETAIL_PENDING = {
  customerId: "550e8400-e29b-41d4-a716-446655440001",
  email: "marco.rossi@example.com",
  name: "MARCO ROSSI",
  accountType: "individual",
  expectedMonthlyVolume: 25000,
  kyc: {
    kycVerified: false,
    stepsStatus: "pending",
    attempts: 1,
    levelName: "customers-api-basic",
    steps: {
      identity: { status: "approved", documentType: "PASSPORT", documentsCount: 1 },
      proofOfAddress: { status: "approved", documentType: "UTILITY_BILL", documentsCount: 1 },
      questionnaire: { status: "uploaded" },
    },
  },
};

const CUSTOMER_DETAIL_APPROVED = {
  ...CUSTOMER_DETAIL_PENDING,
  kyc: {
    ...CUSTOMER_DETAIL_PENDING.kyc,
    kycVerified: true,
    stepsStatus: "approved",
    steps: {
      identity: { status: "approved", documentType: "PASSPORT", documentsCount: 1 },
      proofOfAddress: { status: "approved", documentType: "UTILITY_BILL", documentsCount: 1 },
      questionnaire: { status: "approved" },
    },
  },
};

const WALLET_RESPONSE = {
  id: "wallet_abc123",
  customerId: "550e8400-e29b-41d4-a716-446655440001",
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
  currency: "usdc",
  chain: "base",
  enabled: true,
  createdAt: "2026-02-18T10:30:00.000Z",
  updatedAt: "2026-02-18T10:30:00.000Z",
};

// ─── Feature: Wallet Management flow data ───
const WALLET_LIST_RESPONSE = {
  wallets: [
    { id: "wallet_abc123", customerId: "550e8400-e29b-41d4-a716-446655440001", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68", currency: "usdc", chain: "base", enabled: true, createdAt: "2026-02-18T10:30:00.000Z", updatedAt: "2026-02-18T10:30:00.000Z" },
    { id: "wallet_def456", customerId: "550e8400-e29b-41d4-a716-446655440001", address: "0xA91bcd35Cc6634C0532925a3b844Bc9e7595f9A1", currency: "usdc", chain: "base", enabled: false, createdAt: "2026-01-10T08:00:00.000Z", updatedAt: "2026-01-10T08:00:00.000Z" },
  ],
};
const WALLET_SINGLE_RESPONSE = { ...WALLET_RESPONSE };
const WALLET_UPDATED_RESPONSE = { ...WALLET_RESPONSE, address: "0xNewAddr4B52e8400e29b41d4a716446655440099", updatedAt: "2026-02-19T09:00:00.000Z" };
const WALLET_DELETE_RESPONSE = { success: true, message: "Wallet deleted successfully" };
const WALLET_LIST_EMPTY = { wallets: [] };
const WALLET_NOT_FOUND = { error: "Wallet not found" };
const WALLET_ADDR_CONFLICT = { error: "Address already in use by another wallet" };
const WALLET_DELETE_FORBIDDEN = { error: "Unlicensed organizations cannot delete customer wallets. A wallet is required for deposits to be processed." };

// ─── Feature: Document Upload data ───
const DOC_UPLOAD_RESPONSE = { success: true, idDocType: "PASSPORT", idDocSubType: "FRONT_SIDE", country: "GBR", reviewTriggered: true };
const DOC_UPLOAD_CONFLICT = { error: "Verification already in progress for this customer" };

// ─── Feature: Transaction Detail data ───
const TXN_DETAIL_RESPONSE = {
  id: "txn_7f8a9b0c1d2e", type: "DEPOSIT", status: "COMPLETED",
  createdAt: "2026-02-18T11:00:00.000Z", completedAt: "2026-02-18T11:04:32.000Z",
  reference: "A7B3C9D2E1",
  sourceCurrency: "EUR", targetCurrency: "USDC",
  sourceAmount: "5000", targetAmount: "5412.89", exchangeRate: "1.0926", fee: "5.00",
  depositInstructions: { accountType: "sharedAccount", reference: "A7B3C9D2E1" },
  walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
  developerFee: { developerSpreadFeeBps: 100, amount: "54.13" },
  txHash: "0x3a1b...7e2f",
};
const TXN_NOT_FOUND = { error: "Transaction not found" };

// ─── Feature: List Customers data ───
const CUSTOMERS_LIST = [
  { customerId: "550e8400-e29b-41d4-a716-446655440001", email: "marco.rossi@example.com", name: "MARCO ROSSI", accountType: "individual", expectedMonthlyVolume: 25000 },
  { customerId: "660f9511-f30c-52e5-b827-557766551002", email: "sofia.mueller@example.com", name: "SOFIA MUELLER", accountType: "individual", expectedMonthlyVolume: 10000 },
  { customerId: "770a0622-a41d-63f6-c938-668877662003", email: "ops@acme-corp.com", name: "ACME CORP", accountType: "business", expectedMonthlyVolume: 100000 },
];
const CUSTOMERS_LIST_EMPTY = [];

// ─── Feature: KYC Submit data ───
const KYC_SUBMIT_RESPONSE = { success: true, message: "KYC verification submitted for review successfully." };
const KYC_SUBMIT_CONFLICT = { error: "Review already in progress for this customer" };

// ─── Feature: Get Customer Fees data ───
const GET_CUSTOMER_FEES_RESPONSE = { customerId: "550e8400-e29b-41d4-a716-446655440001", developerSpreadFeeBps: 100, updatedAt: "2026-02-18T10:35:00.000Z" };
const GET_CUSTOMER_FEES_NOT_FOUND = { error: "Customer not found" };

// ─── Feature: List Banks data ───
const WITHDRAWAL_BANKS_LIST = [
  { id: "bank_d4e5f6a7b8", beneficiaryName: "MARCO ROSSI", iban: "DE89370400440532013000", bic: "COBADEFFXXX", currency: "EUR", status: "ACTIVE", createdAt: "2026-02-18T11:00:00.000Z", wallets: [] },
];
const WITHDRAWAL_BANKS_EMPTY = [];

// ─── Feature: List Virtual Accounts data ───
const VA_LIST_RESPONSE = [
  { virtualAccountId: "corr-a8f3k-9xm2p", status: "APPROVED", currency: "EUR", virtualAccount: { iban: "GB82WEST12345698765432", bic: "WESTGB2L", accountName: "MARCO ROSSI", bankName: "ClearBank", bankCountry: "GB" }, createdAt: "2026-02-18T10:45:00.000Z" },
];
const VA_LIST_EMPTY = [];

const DEPOSIT_DETAILS = {
  customerId: "550e8400-e29b-41d4-a716-446655440001",
  currency: "eur",
  reference: "A7B3C9D2E1",
  accountName: "Compose Finance UAB",
  accountAddress: "Vilniaus g. 31, LT-01402 Vilnius, Lithuania",
  iban: "LU28 0019 4006 4475 0000",
  bic: "BCEELULL",
  bankName: "Banque et Caisse d'\u00C9pargne de l'\u00C9tat",
  bankAddress: "1, Place de Metz, L-2954 Luxembourg",
  bankCountry: "Luxembourg",
  depositInstructions: "Transfer EUR from your bank using the reference and bank details below.",
  warningText: "Include your unique reference in the transfer details",
  thirdPartyEnabled: false,
  depositModel: "reference",
};

const DEVELOPER_FEES_RESPONSE = {
  customerId: "550e8400-e29b-41d4-a716-446655440001",
  developerSpreadFeeBps: 100,
  updatedAt: "2026-02-18T10:35:00.000Z",
};

const TRANSACTIONS = [
  {
    id: "txn_7f8a9b0c1d2e",
    type: "DEPOSIT",
    status: "COMPLETED",
    createdAt: "2026-02-18T11:00:00.000Z",
    completedAt: "2026-02-18T11:04:32.000Z",
    reference: "A7B3C9D2E1",
    sourceCurrency: "EUR",
    targetCurrency: "USDC",
    sourceAmount: "5000",
    targetAmount: "5412.89",
    exchangeRate: "1.0926",
    fee: "5.00",
    depositInstructions: { accountType: "sharedAccount", reference: "A7B3C9D2E1" },
    walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
    developerFee: { developerSpreadFeeBps: 100, amount: "54.13" },
    txHash: "0x3a1b...7e2f",
  },
];

const VIRTUAL_ACCOUNT_ID = "corr-a8f3k-9xm2p";

const VA_RESPONSE_PENDING = {
  customerId: "550e8400-e29b-41d4-a716-446655440001",
  status: "PENDING",
  virtualAccountId: VIRTUAL_ACCOUNT_ID,
  virtualAccount: null,
  message: "Virtual account creation initiated. IBAN will be provided via webhook once the provider processes the request.",
};

const VA_RESPONSE_APPROVED = {
  customerId: "550e8400-e29b-41d4-a716-446655440001",
  status: "APPROVED",
  virtualAccountId: VIRTUAL_ACCOUNT_ID,
  virtualAccount: {
    iban: "LU28 0019 4006 4475 0000",
    bic: "BCEELULL",
    accountName: "MARCO ROSSI",
    accountNumber: "64475000",
    addressDetails: {
      addressLine1: "10 Boulevard Royal",
      city: "Luxembourg",
      postcode: "L-2449",
      country: "LU",
      nationality: "IT",
      dateOfBirth: "1990-03-15",
    },
    bankName: "Banque et Caisse d'\u00C9pargne de l'\u00C9tat",
    bankCountry: "Luxembourg",
    bankAddress: "1 Place de Metz, L-2954 Luxembourg",
  },
  message: "Virtual account is active",
};

const BANK_ID = "bank_d4e5f6a7b8";

const WITHDRAWAL_BANK_RESPONSE = {
  id: BANK_ID,
  customerId: "550e8400-e29b-41d4-a716-446655440001",
  beneficiaryName: "MARCO ROSSI",
  iban: "DE89370400440532013000",
  bic: "COBADEFFXXX",
  addressLine1: "Friedrichstra\u00DFe 123",
  city: "Berlin",
  country: "DE",
  currency: "EUR",
  recipientType: "CUSTOMER",
  recipientEmail: "marco.rossi@example.com",
  notificationEnabled: false,
  status: "ACTIVE",
  createdAt: "2026-02-18T11:30:00.000Z",
  wallets: [],
};

const ALLOWANCE_RESPONSE = {
  enabled: true,
  allowance: {
    limit: "10000",
    spent: "2500",
    available: "7500",
    resetPeriodMinutes: 1440,
    nextResetAt: "2026-02-19T00:00:00.000Z",
  },
};

const WITHDRAWAL_TXN_ID = "txn_w9c8d7e6f5";

const WITHDRAWAL_RESPONSE = {
  id: WITHDRAWAL_TXN_ID,
  type: "WITHDRAWAL",
  status: "PROCESSING",
  requiresUiAction: false,
  createdAt: "2026-02-18T12:00:00.000Z",
  completedAt: null,
  sourceCurrency: "USDC",
  targetCurrency: "EUR",
  sourceAmount: "1000",
  targetAmount: "865.50",
  exchangeRate: "0.8655",
  fee: "2.50",
  withdrawalBank: {
    id: BANK_ID,
    beneficiaryName: "MARCO ROSSI",
    iban: "DE89370400440532013000",
  },
  walletAddress: null,
  developerFee: null,
  txHash: null,
};

const WEBHOOK_BASE = {
  api_version: "v2",
  org_id: "96884f9b-6ec3-4c1b-8efa-a3ffbda8b960",
};

function makeWebhook(type, data) {
  return {
    event_id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    event_type: type,
    created_at: new Date().toISOString(),
    ...WEBHOOK_BASE,
    data,
  };
}

// ─── Feature 7: Error simulation data ───
const KYC_REJECTED_RESPONSE = {
  ...CUSTOMER_DETAIL_PENDING,
  kyc: {
    ...CUSTOMER_DETAIL_PENDING.kyc,
    kycVerified: false,
    stepsStatus: "rejected",
    steps: {
      identity: { status: "rejected", documentType: "PASSPORT", documentsCount: 1 },
      proofOfAddress: { status: "approved", documentType: "UTILITY_BILL", documentsCount: 1 },
      questionnaire: { status: "approved" },
    },
  },
};

const VA_REJECTED_RESPONSE = {
  customerId: "550e8400-e29b-41d4-a716-446655440001",
  status: "REJECTED",
  virtualAccountId: VIRTUAL_ACCOUNT_ID,
  virtualAccount: null,
  message: "Virtual account rejected \u2014 customer requires enhanced due diligence.",
};

const WITHDRAWAL_BANK_ERROR = {
  error: "BENEFICIARY_NAME_MISMATCH",
  message: "Beneficiary name does not match the customer's registered name.",
  statusCode: 400,
};

const INSUFFICIENT_BALANCE_ERROR = {
  error: "INSUFFICIENT_BALANCE",
  message: "Insufficient USDC balance. Available: 412.89, Required: 1000.00",
  statusCode: 400,
};

// ─── Feature: KYC Verified Address data ───
const KYC_ADDRESS_RESPONSE = {
  addressLine1: "Via Roma 42",
  city: "Milan",
  country: "IT",
  postalCode: "20121",
};
const KYC_ADDRESS_NOT_FOUND = { error: "Customer KYC not yet approved" };

// ─── Feature: Verify Address data ───
const VERIFY_ADDRESS_RESPONSE = {
  isValid: true,
  isContract: false,
  isSafeWallet: false,
  warnings: [],
  errors: [],
};

const VERIFY_ADDRESS_ERROR_RESPONSE = {
  isValid: true,
  isContract: true,
  isSafeWallet: false,
  warnings: ["This is an unknown contract or smart account address."],
  errors: [],
};

// ─── Feature: Organization Balances data ───
const ORG_BALANCES_RESPONSE = [
  { currency: "USDC", chain: "base", available: "15420.50", pending: "500.00" },
];
const ORG_BALANCES_EMPTY = [];

// ─── Feature: Revenue flow data ───
const DEV_FEE_BALANCE = {
  balance: "1250.50",
  pendingClaims: "0",
  availableBalance: "1250.50",
  currencyId: "usdc_base",
  currencyTicker: "USDC",
};

const DEV_FEE_CLAIM_RESPONSE = {
  success: true,
  transactionId: "txn_abc123",
  amount: "1250.50",
  message: "Claim of 1250.50 USDC initiated. Transfer is being processed.",
};

const DEV_FEE_NO_BALANCE = {
  balance: "0",
  pendingClaims: "0",
  availableBalance: "0",
  currencyId: "usdc_base",
  currencyTicker: "USDC",
};

const DEV_FEE_CLAIM_ERROR = {
  error: "No developer fees to claim",
  statusCode: 400,
};

// ─── Feature: Sequence Diagram data ───
const STEP_ACTORS = {
  create: [{ from: 0, to: 1, label: "POST /customers", type: "request" }, { from: 1, to: 0, label: "201 Created", type: "response" }, { from: 1, to: 3, label: "customer.created", type: "webhook" }],
  kyc: [{ from: 0, to: 1, label: "POST /kyc", type: "request" }, { from: 1, to: 0, label: "kycFlowLink", type: "response" }],
  verify: [{ from: 0, to: 1, label: "GET /customers/{id}", type: "request" }, { from: 1, to: 2, label: "check KYC", type: "internal" }, { from: 2, to: 1, label: "approved", type: "internal" }, { from: 1, to: 3, label: "kyc.approved", type: "webhook" }],
  wallet: [{ from: 0, to: 1, label: "POST /deposit/wallets", type: "request" }, { from: 1, to: 0, label: "201 Created", type: "response" }],
  "verify-addr": [{ from: 0, to: 1, label: "POST /verify-address", type: "request" }, { from: 1, to: 2, label: "chain lookup", type: "internal" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  fees: [{ from: 0, to: 1, label: "PATCH /developer-fees", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  deposit: [{ from: 0, to: 1, label: "GET /deposit", type: "request" }, { from: 1, to: 0, label: "bank details", type: "response" }],
  transactions: [{ from: 0, to: 1, label: "GET /transactions", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }, { from: 1, to: 3, label: "deposit.completed", type: "webhook" }],
  "va-create": [{ from: 0, to: 1, label: "POST /virtual-account", type: "request" }, { from: 1, to: 2, label: "request IBAN", type: "internal" }, { from: 1, to: 0, label: "202 Accepted", type: "response" }],
  "va-poll": [{ from: 0, to: 1, label: "GET /virtual-account", type: "request" }, { from: 2, to: 1, label: "IBAN assigned", type: "internal" }, { from: 1, to: 3, label: "va.approved", type: "webhook" }],
  "va-deposit": [{ from: 2, to: 1, label: "EUR received", type: "internal" }, { from: 1, to: 3, label: "deposit.completed", type: "webhook" }],
  "wd-bank": [{ from: 0, to: 1, label: "POST /withdrawal/banks", type: "request" }, { from: 1, to: 0, label: "201 Created", type: "response" }, { from: 1, to: 3, label: "bank.approved", type: "webhook" }],
  "wd-allowance": [{ from: 0, to: 1, label: "GET /allowance", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  "wd-create": [{ from: 0, to: 1, label: "POST /withdrawal", type: "request" }, { from: 1, to: 2, label: "init transfer", type: "internal" }, { from: 1, to: 0, label: "201 Created", type: "response" }],
  "wd-status": [{ from: 2, to: 1, label: "status update", type: "internal" }, { from: 1, to: 3, label: "withdrawal.completed", type: "webhook" }],
  "org-balances": [{ from: 0, to: 1, label: "GET /balances", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  "rev-balance": [{ from: 0, to: 1, label: "GET /developer-fees", type: "request" }, { from: 1, to: 0, label: "200 balance", type: "response" }],
  "rev-claim": [{ from: 0, to: 1, label: "POST /developer-fees", type: "request" }, { from: 1, to: 0, label: "claim initiated", type: "response" }],
  "rev-confirm": [{ from: 1, to: 2, label: "process transfer", type: "internal" }, { from: 2, to: 1, label: "completed", type: "internal" }, { from: 1, to: 3, label: "claim.completed", type: "webhook" }],
  // Wallet Management flow
  "wm-list": [{ from: 0, to: 1, label: "GET /deposit/wallets", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  "wm-get": [{ from: 0, to: 1, label: "GET /wallets/{id}", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  "wm-update": [{ from: 0, to: 1, label: "PATCH /wallets/{id}", type: "request" }, { from: 1, to: 0, label: "200 Updated", type: "response" }],
  "wm-delete": [{ from: 0, to: 1, label: "DELETE /wallets/{id}", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  // Document Upload
  "doc-upload": [{ from: 0, to: 1, label: "POST /documents", type: "request" }, { from: 1, to: 2, label: "submit for review", type: "internal" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  // Transaction Detail
  "txn-detail": [{ from: 0, to: 1, label: "GET /transactions/{id}", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  // Round 4: final 5 endpoints
  "list-customers": [{ from: 0, to: 1, label: "GET /customers", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  "kyc-submit": [{ from: 0, to: 1, label: "POST /kyc/submit", type: "request" }, { from: 1, to: 2, label: "trigger review", type: "internal" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  "kyc-addr": [{ from: 0, to: 1, label: "GET /kyc/address", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  "get-fees": [{ from: 0, to: 1, label: "GET /developer-fees", type: "request" }, { from: 1, to: 0, label: "fee config", type: "response" }],
  "wd-list-banks": [{ from: 0, to: 1, label: "GET /withdrawal/banks", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
  "va-list": [{ from: 0, to: 1, label: "GET /virtual-accounts", type: "request" }, { from: 1, to: 0, label: "200 OK", type: "response" }],
};

const ACTOR_LABELS = ["Your App", "Compose API", "Provider", "Webhooks"];

// ─── Steps config ───
const ONBOARDING_STEPS = [
  { id: "list-customers", label: "List Customers", endpoint: "GET /api/v2/customers" },
  { id: "create", label: "Create Customer", endpoint: "POST /api/v2/customers" },
  { id: "kyc", label: "Initiate KYC", endpoint: "POST /api/v2/customers/{id}/kyc" },
  { id: "doc-upload", label: "Upload Document", endpoint: "POST /api/v2/customers/{id}/documents" },
  { id: "kyc-submit", label: "Submit KYC", endpoint: "POST /api/v2/customers/{id}/kyc/submit" },
  { id: "verify", label: "Verification", endpoint: "GET /api/v2/customers/{id}" },
  { id: "kyc-addr", label: "Verified Address", endpoint: "GET /api/v2/customers/{id}/kyc/address" },
  { id: "wallet", label: "Setup Wallet", endpoint: "POST /api/v2/customers/{id}/deposit/wallets" },
  { id: "verify-addr", label: "Verify Address", endpoint: "POST /api/v2/verify-address" },
  { id: "fees", label: "Developer Fees", endpoint: "PATCH /api/v2/customers/{id}/developer-fees" },
  { id: "get-fees", label: "Verify Fees", endpoint: "GET /api/v2/customers/{id}/developer-fees" },
  { id: "deposit", label: "Deposit Details", endpoint: "GET /api/v2/customers/{id}/deposit" },
  { id: "transactions", label: "Transactions", endpoint: "GET /api/v2/customers/{id}/transactions" },
  { id: "txn-detail", label: "Transaction Detail", endpoint: "GET /api/v2/customers/{id}/transactions/{transactionId}" },
];

const VA_STEPS = [
  { id: "va-create", label: "Create Account", endpoint: "POST /api/v2/customers/{id}/virtual-account" },
  { id: "va-poll", label: "IBAN Assigned", endpoint: "GET /api/v2/customers/{id}/virtual-account" },
  { id: "va-list", label: "List Accounts", endpoint: "GET /api/v2/customers/{id}/virtual-accounts" },
  { id: "va-deposit", label: "Simulate Deposit", endpoint: "\u2014 webhook simulation \u2014" },
];

const WITHDRAWAL_STEPS = [
  { id: "wd-bank", label: "Add Bank", endpoint: "POST /api/v2/customers/{id}/withdrawal/banks" },
  { id: "wd-list-banks", label: "List Banks", endpoint: "GET /api/v2/customers/{id}/withdrawal/banks" },
  { id: "wd-allowance", label: "Check Allowance", endpoint: "GET /api/v2/customers/withdrawal/allowance" },
  { id: "wd-create", label: "Create Withdrawal", endpoint: "POST /api/v2/customers/{id}/withdrawal" },
  { id: "wd-status", label: "Track Status", endpoint: "\u2014 status progression \u2014" },
];

const REVENUE_STEPS_CONFIG = [
  { id: "org-balances", label: "Org Balances", endpoint: "GET /api/v2/balances" },
  { id: "rev-balance", label: "Check Balance", endpoint: "GET /api/v2/developer-fees" },
  { id: "rev-claim", label: "Claim Fees", endpoint: "POST /api/v2/developer-fees" },
  { id: "rev-confirm", label: "Confirmation", endpoint: "\u2014 transfer tracking \u2014" },
];

const WALLET_MANAGEMENT_STEPS = [
  { id: "wm-list", label: "List Wallets", endpoint: "GET /api/v2/customers/{id}/deposit/wallets" },
  { id: "wm-get", label: "Get Wallet", endpoint: "GET /api/v2/customers/{id}/deposit/wallets/{walletId}" },
  { id: "wm-update", label: "Update Address", endpoint: "PATCH /api/v2/customers/{id}/deposit/wallets/{walletId}" },
  { id: "wm-delete", label: "Delete Wallet", endpoint: "DELETE /api/v2/customers/{id}/deposit/wallets/{walletId}" },
];

const FLOWS = {
  onboarding: { label: "Onboarding", steps: ONBOARDING_STEPS, icon: "\u{1F464}" },
  "virtual-accounts": { label: "Virtual Accounts", steps: VA_STEPS, icon: "\u{1F3E6}" },
  withdrawals: { label: "Withdrawals", steps: WITHDRAWAL_STEPS, icon: "\u{1F4B8}" },
  revenue: { label: "Revenue", steps: REVENUE_STEPS_CONFIG, icon: "\u{1F4B0}" },
  wallets: { label: "Wallets", steps: WALLET_MANAGEMENT_STEPS, icon: "\u{1F511}" },
};

// ─── Feature 6: Code snippet generator (outside component) ───
function generateCodeSnippet(call, language) {
  const baseUrl = "https://api.compose.finance";
  const url = `${baseUrl}${call.path}`;
  const hasBody = call.body && call.method !== "GET";
  switch (language) {
    case "curl": {
      let lines = [`curl -X ${call.method} "${url}" \\`];
      lines.push(`  -H "Authorization: Bearer YOUR_API_KEY" \\`);
      lines.push(`  -H "Content-Type: application/json"`);
      if (hasBody) {
        lines[lines.length - 1] += " \\";
        lines.push(`  -d '${JSON.stringify(call.body, null, 2)}'`);
      }
      return lines.join("\n");
    }
    case "node": {
      let lines = [];
      lines.push(`const response = await fetch("${url}", {`);
      lines.push(`  method: "${call.method}",`);
      lines.push(`  headers: {`);
      lines.push(`    "Authorization": "Bearer YOUR_API_KEY",`);
      lines.push(`    "Content-Type": "application/json",`);
      lines.push(`  },`);
      if (hasBody) {
        lines.push(`  body: JSON.stringify(${JSON.stringify(call.body, null, 2).split("\n").map((l, i) => i === 0 ? l : "  " + l).join("\n")}),`);
      }
      lines.push(`});`);
      lines.push(``);
      lines.push(`const data = await response.json();`);
      lines.push(`console.log(data);`);
      return lines.join("\n");
    }
    case "python": {
      const method = call.method.toLowerCase();
      let lines = [];
      lines.push(`import requests`);
      lines.push(``);
      lines.push(`headers = {`);
      lines.push(`    "Authorization": "Bearer YOUR_API_KEY",`);
      lines.push(`    "Content-Type": "application/json",`);
      lines.push(`}`);
      lines.push(``);
      if (hasBody) {
        lines.push(`payload = ${JSON.stringify(call.body, null, 2).split("\n").map((l, i) => i === 0 ? l : "  " + l).join("\n")}`);
        lines.push(``);
        lines.push(`response = requests.${method}(`);
        lines.push(`    "${url}",`);
        lines.push(`    headers=headers,`);
        lines.push(`    json=payload,`);
        lines.push(`)`);
      } else {
        lines.push(`response = requests.${method}(`);
        lines.push(`    "${url}",`);
        lines.push(`    headers=headers,`);
        lines.push(`)`);
      }
      lines.push(``);
      lines.push(`data = response.json()`);
      lines.push(`print(data)`);
      return lines.join("\n");
    }
    default:
      return "";
  }
}

// ─── Brand color palette (Compose Finance dark mode — neutral grayscale) ───
const C = {
  bgApp: '#0A0A0A', bgSurface: '#171717', bgElevated: '#262626', bgDisabled: '#1A1A1A',
  border: '#262626', borderLight: '#333333', borderDisabled: '#1F1F1F',
  text: '#F5F5F5', textBody: '#E5E5E5', textSecondary: '#A3A3A3', textMuted: '#737373', textDisabled: '#525252',
  accent: '#3B82F6', accentBg: '#1E3A5F', accentBorder: '#2563EB',
  success: '#10B981', successBg: '#064E3B', successBorder: '#047857',
  warning: '#F59E0B', warningBg: '#451A03', warningBorder: '#92400E',
  error: '#EF4444', errorBg: '#450A0A', errorBorder: '#991B1B',
  ctaBg: '#FFFFFF', ctaText: '#0A0A0A', ctaBorder: 'rgba(255,255,255,0.15)',
  webhook: '#A855F7',
};

// ─── Design tokens ───
const T = {
  fontSans: "'Inter', sans-serif",
  fontMono: "'IBM Plex Mono', monospace",
  radius: { sm: 6, md: 8, lg: 12, full: 9999 },
  transition: 'all 0.15s ease',
};

// ─── Shared style objects ───
const headingStyle = { fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 6px 0", fontFamily: T.fontSans, letterSpacing: "-0.025em" };
const labelStyle = { display: "block", fontSize: 11, color: C.textMuted, marginBottom: 5, fontFamily: T.fontMono, textTransform: "uppercase", letterSpacing: "0.06em" };
const inputStyle = { width: "100%", padding: "10px 14px", background: C.bgApp, border: `1px solid ${C.borderLight}`, borderRadius: T.radius.md, color: C.text, fontSize: 13, fontFamily: T.fontSans, outline: "none", transition: T.transition };

// ─── Utility components ───
function JsonBlock({ data, title }) {
  return (
    <div style={{ marginTop: 8 }}>
      {title && (
        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, fontFamily: T.fontMono, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {title}
        </div>
      )}
      <pre
        style={{
          background: C.bgSurface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "14px 16px",
          fontSize: 11.5,
          lineHeight: 1.55,
          color: C.textBody,
          overflow: "auto",
          maxHeight: 320,
          fontFamily: T.fontMono,
          margin: 0,
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    COMPLETED: { bg: C.successBg, color: C.success, border: C.successBorder },
    PROCESSING: { bg: C.warningBg, color: C.warning, border: C.warningBorder },
    PROPOSED: { bg: C.warningBg, color: C.warning, border: C.warningBorder },
    FAILED: { bg: C.errorBg, color: C.error, border: C.errorBorder },
    approved: { bg: C.successBg, color: C.success, border: C.successBorder },
    pending: { bg: C.warningBg, color: C.warning, border: C.warningBorder },
    uploaded: { bg: C.accentBg, color: C.accent, border: C.accentBorder },
    not_started: { bg: C.bgDisabled, color: C.textDisabled, border: C.borderDisabled },
    ACTIVE: { bg: C.successBg, color: C.success, border: C.successBorder },
    PENDING: { bg: C.warningBg, color: C.warning, border: C.warningBorder },
    rejected: { bg: C.errorBg, color: C.error, border: C.errorBorder },
    REJECTED: { bg: C.errorBg, color: C.error, border: C.errorBorder },
  };
  const c = colors[status] || colors.not_started;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        fontFamily: T.fontSans,
        letterSpacing: "0.01em",
      }}
    >
      {status}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={{
        background: "none",
        border: `1px solid ${C.borderLight}`,
        borderRadius: 6,
        color: copied ? C.success : C.textMuted,
        cursor: "pointer",
        padding: "3px 8px",
        fontSize: 11,
        fontFamily: T.fontMono,
        transition: "all 0.2s",
      }}
    >
      {copied ? "\u2713" : "Copy"}
    </button>
  );
}

// ─── Step panels (Customer-facing left side) ───
function CreateCustomerPanel({ onExecute, executed }) {
  const [form, setForm] = useState({ name: "Marco Rossi", email: "marco.rossi@example.com", volume: "25000" });
  return (
    <div>
      <h2 style={headingStyle}>Create Customer</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Register a new customer with their basic information to begin the onboarding process.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { label: "Full Name", key: "name", placeholder: "JOHN DOE" },
          { label: "Email", key: "email", placeholder: "john@example.com" },
          { label: "Expected Monthly Volume (EUR)", key: "volume", placeholder: "25000" },
        ].map((f) => (
          <div key={f.key}>
            <label style={labelStyle}>
              {f.label}
            </label>
            <input
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              disabled={executed}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: executed ? C.bgElevated : C.bgSurface,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 8,
                color: C.textBody,
                fontSize: 14,
                fontFamily: T.fontSans,
                outline: "none",
                boxSizing: "border-box",
                opacity: executed ? 0.6 : 1,
              }}
            />
          </div>
        ))}
      </div>
      {!executed && (
        <button onClick={() => onExecute({ name: form.name, email: form.email, volume: form.volume })} style={btnStyle}>
          Create Customer {"\u2192"}
        </button>
      )}
      {executed && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
          <span style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>Customer created — ID: {DEMO_CUSTOMER.customerId.slice(0, 8)}...</span>
        </div>
      )}
    </div>
  );
}

function KycPanel({ onExecute, executed }) {
  return (
    <div>
      <h2 style={headingStyle}>Initiate KYC Verification</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Generate a verification link for the customer. They'll complete identity verification, liveness check, and proof of address.</p>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, fontFamily: T.fontMono }}>VERIFICATION STEPS</div>
        {["Identity Document (Passport, ID Card, etc.)", "Proof of Address (Utility Bill, Bank Statement)", "Questionnaire (auto-submitted via API)"].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 2 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: executed ? C.successBg : C.bgDisabled, border: `1px solid ${executed ? C.successBorder : C.borderDisabled}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: executed ? C.success : C.textDisabled }}>
              {executed ? "\u2713" : i + 1}
            </div>
            <span style={{ color: C.textSecondary, fontSize: 13 }}>{s}</span>
          </div>
        ))}
      </div>
      {!executed && (
        <button onClick={onExecute} style={btnStyle}>
          Generate KYC Link {"\u2192"}
        </button>
      )}
      {executed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          <div style={{ padding: "12px 16px", background: C.accentBg, border: `1px solid ${C.accentBorder}`, borderRadius: 8, fontSize: 13 }}>
            <div style={{ color: C.accent, fontWeight: 600, marginBottom: 4 }}>WebSDK Link Generated</div>
            <div style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono, wordBreak: "break-all" }}>{KYC_RESPONSE.kycFlowLink}</div>
          </div>
          <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5 }}>
            {"\u21B3"} Redirect your customer to this link. They'll complete all verification steps in the browser. The link is valid for 1 week.
          </div>
        </div>
      )}
    </div>
  );
}

function VerifyPanel({ onExecute, executed, polling, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>Check Verification Status</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Poll the customer endpoint to check KYC progress. In production, use webhooks for real-time notifications.</p>

      {!executed && !polling && (
        <button onClick={onExecute} style={btnStyle}>
          Poll Status {"\u2192"}
        </button>
      )}

      {polling && !executed && (
        <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8 }}>
            <div className="spin" style={{ width: 16, height: 16, border: `2px solid ${C.warningBorder}`, borderTopColor: C.warning, borderRadius: "50%" }} />
            <span style={{ color: C.warning, fontSize: 13, fontWeight: 500 }}>Verification in progress...</span>
          </div>
          {Object.entries(CUSTOMER_DETAIL_PENDING.kyc.steps).map(([key, val]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textSecondary, fontSize: 13, textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
              <StatusBadge status={val.status} />
            </div>
          ))}
        </div>
      )}

      {executed && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8 }}>
            <span style={{ fontSize: 18 }}>{"\u2713"}</span>
            <div>
              <div style={{ color: C.success, fontSize: 14, fontWeight: 600 }}>KYC Approved</div>
              <div style={{ color: C.success, fontSize: 12, opacity: 0.8 }}>All verification steps passed</div>
            </div>
          </div>
          {Object.entries(CUSTOMER_DETAIL_APPROVED.kyc.steps).map(([key, val]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textSecondary, fontSize: 13, textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
              <StatusBadge status={val.status} />
            </div>
          ))}
        </div>
      )}

      {executed && isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8 }}>
            <span style={{ fontSize: 18, color: C.error }}>{"\u2717"}</span>
            <div>
              <div style={{ color: C.error, fontSize: 14, fontWeight: 600 }}>KYC Rejected</div>
              <div style={{ color: C.error, fontSize: 12, opacity: 0.8 }}>Identity verification failed</div>
            </div>
          </div>
          {Object.entries(KYC_REJECTED_RESPONSE.kyc.steps).map(([key, val]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textSecondary, fontSize: 13, textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
              <StatusBadge status={val.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WalletPanel({ onExecute, executed }) {
  return (
    <div>
      <h2 style={headingStyle}>Setup Customer Wallet</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Register a USDC wallet address (Base network) where deposits will be automatically sent after fiat conversion.</p>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <label style={labelStyle}>
          Wallet Address (Base {"\u00B7"} USDC)
        </label>
        <input
          value="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68"
          disabled={executed}
          readOnly
          style={{
            width: "100%",
            padding: "10px 14px",
            background: C.bgElevated,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 8,
            color: C.textBody,
            fontSize: 13,
            fontFamily: T.fontMono,
            outline: "none",
            boxSizing: "border-box",
            opacity: executed ? 0.6 : 1,
          }}
        />
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <div style={{ fontSize: 11, color: C.textMuted }}><span style={{ color: C.accent }}>Chain:</span> Base</div>
          <div style={{ fontSize: 11, color: C.textMuted }}><span style={{ color: C.accent }}>Token:</span> USDC</div>
        </div>
      </div>
      <div style={{ padding: "10px 14px", background: C.accentBg, border: `1px solid ${C.accentBorder}`, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ color: C.accent, fontSize: 12, lineHeight: 1.5 }}>
          {"\u{1F4A1}"} When your customer deposits EUR, funds are automatically converted to USDC and sent to this wallet. No manual intervention required.
        </div>
      </div>
      {!executed && (
        <button onClick={onExecute} style={btnStyle}>
          Register Wallet {"\u2192"}
        </button>
      )}
      {executed && (
        <div style={{ padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
          <span style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>Wallet registered — direct-to-wallet deposits enabled</span>
        </div>
      )}
    </div>
  );
}

function FeesPanel({ onExecute, executed }) {
  const [bps, setBps] = useState("100");
  const amount = 5000;
  const usdcRate = 1.0926;
  const grossUsdc = (amount * usdcRate).toFixed(2);
  const spreadFee = ((amount * usdcRate * parseInt(bps || 0)) / 10000).toFixed(2);
  const netUsdc = (grossUsdc - spreadFee).toFixed(2);

  return (
    <div>
      <h2 style={headingStyle}>Configure Developer Fees</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Earn revenue on every customer deposit. Set a spread fee that's automatically deducted and accumulated in your balance.</p>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <label style={labelStyle}>
          Spread Fee (Basis Points)
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="number"
            value={bps}
            onChange={(e) => setBps(e.target.value)}
            disabled={executed}
            style={{
              width: 100,
              padding: "10px 14px",
              background: executed ? C.bgElevated : C.bgSurface,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 8,
              color: C.textBody,
              fontSize: 16,
              fontWeight: 700,
              fontFamily: T.fontSans,
              outline: "none",
              textAlign: "center",
              opacity: executed ? 0.6 : 1,
            }}
          />
          <span style={{ color: C.textMuted, fontSize: 13 }}>BPS = {((parseInt(bps || 0)) / 100).toFixed(2)}%</span>
        </div>
        <div style={{ marginTop: 16, padding: 14, background: C.bgElevated, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10, fontFamily: T.fontMono }}>EXAMPLE: {"\u20AC"}{amount.toLocaleString()} DEPOSIT</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: C.textMuted }}>Gross USDC</span>
              <span style={{ color: C.textBody, fontFamily: T.fontMono }}>{grossUsdc}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: C.warning }}>Your spread fee</span>
              <span style={{ color: C.warning, fontFamily: T.fontMono, fontWeight: 600 }}>{"\u2212"}{spreadFee}</span>
            </div>
            <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: C.textMuted }}>Customer receives</span>
              <span style={{ color: C.success, fontFamily: T.fontMono, fontWeight: 600 }}>{netUsdc} USDC</span>
            </div>
          </div>
        </div>
      </div>
      {!executed && (
        <button onClick={() => onExecute({ bps })} style={btnStyle}>
          Set Developer Fees {"\u2192"}
        </button>
      )}
      {executed && (
        <div style={{ padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
          <span style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>Spread fee set to {bps} BPS — you earn on every deposit</span>
        </div>
      )}
    </div>
  );
}

function DepositPanel({ onExecute, executed }) {
  return (
    <div>
      <h2 style={headingStyle}>Deposit Instructions</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Retrieve bank details your customer uses to deposit EUR. Funds are automatically converted to USDC.</p>
      {!executed && (
        <button onClick={onExecute} style={btnStyle}>
          Get Deposit Details {"\u2192"}
        </button>
      )}
      {executed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: "12px 16px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8 }}>
            <div style={{ color: C.warning, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{"\u26A0"} {DEPOSIT_DETAILS.warningText}</div>
          </div>
          <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
            {[
              { label: "Reference", value: DEPOSIT_DETAILS.reference, highlight: true },
              { label: "IBAN", value: DEPOSIT_DETAILS.iban },
              { label: "BIC", value: DEPOSIT_DETAILS.bic },
              { label: "Account Name", value: DEPOSIT_DETAILS.accountName },
              { label: "Bank", value: DEPOSIT_DETAILS.bankName },
              { label: "Bank Country", value: DEPOSIT_DETAILS.bankCountry },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: f.highlight ? C.accent : C.textBody, fontSize: 13, fontWeight: f.highlight ? 700 : 400, fontFamily: T.fontMono }}>{f.value}</span>
                  <CopyButton text={f.value} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionsPanel({ onExecute, executed, onSelectTxn }) {
  return (
    <div>
      <h2 style={headingStyle}>Transaction History</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>View all deposits and withdrawals for the customer. Click a transaction to view full details.</p>
      {!executed && (
        <button onClick={onExecute} style={btnStyle}>
          Fetch Transactions {"\u2192"}
        </button>
      )}
      {executed &&
        TRANSACTIONS.map((tx) => (
          <div key={tx.id} style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, cursor: onSelectTxn ? "pointer" : "default" }} onClick={() => onSelectTxn && onSelectTxn(tx.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: C.successBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{"\u2193"}</div>
                <div>
                  <div style={{ color: C.textBody, fontSize: 14, fontWeight: 600 }}>{tx.type}</div>
                  <div style={{ color: C.textMuted, fontSize: 11, fontFamily: T.fontMono }}>{tx.id}</div>
                </div>
              </div>
              <StatusBadge status={tx.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Sent", value: `\u20AC${parseFloat(tx.sourceAmount).toLocaleString()}` },
                { label: "Received", value: `${parseFloat(tx.targetAmount).toLocaleString()} USDC` },
                { label: "Rate", value: tx.exchangeRate },
                { label: "Platform Fee", value: `\u20AC${tx.fee}` },
                { label: "Your Revenue", value: `${tx.developerFee.amount} USDC`, highlight: true },
                { label: "Tx Hash", value: tx.txHash },
              ].map((f) => (
                <div key={f.label} style={{ padding: "8px 12px", background: C.bgElevated, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontFamily: T.fontMono, textTransform: "uppercase", marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: f.highlight ? C.warning : C.textBody, fontWeight: f.highlight ? 700 : 400, fontFamily: T.fontMono }}>{f.value}</div>
                </div>
              ))}
            </div>
            {onSelectTxn && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end" }}>
                <span style={{ color: C.accent, fontSize: 11, fontFamily: T.fontMono }}>View detail {"\u2192"}</span>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

// ─── Feature: Document Upload panel ───
function DocUploadPanel({ onExecute, executed, isError }) {
  const [docType, setDocType] = useState("PASSPORT");
  const [country, setCountry] = useState("GBR");
  const [fileDragging, setFileDragging] = useState(false);
  return (
    <div>
      <h2 style={headingStyle}>Upload Identity Document</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 16px 0" }}>Submit a document via API as an alternative to the WebSDK KYC flow. Reviewed by the compliance team.</p>
      <div style={{ padding: "12px 16px", background: C.accentBg, border: `1px solid ${C.accentBorder}`, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ color: C.accent, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{"\u{1F4A1}"} API-Based KYC Alternative</div>
        <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.6 }}>Instead of redirecting to the WebSDK link, you can collect and upload documents directly via this endpoint. Useful for native mobile apps or custom identity flows.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Document Type</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} disabled={executed} style={{ width: "100%", padding: "10px 14px", background: executed ? C.bgElevated : C.bgSurface, border: `1px solid ${C.borderLight}`, borderRadius: 8, color: C.textBody, fontSize: 14, fontFamily: T.fontSans, outline: "none", boxSizing: "border-box", opacity: executed ? 0.6 : 1, cursor: executed ? "default" : "pointer" }}>
            <option value="PASSPORT">Passport</option>
            <option value="ID_CARD">ID Card</option>
            <option value="DRIVERS">Driver License</option>
            <option value="PROOF_OF_ADDRESS">Proof of Address</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Country (ISO 3166-1 alpha-3)</label>
          <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 3))} disabled={executed} placeholder="GBR" style={{ width: "100%", padding: "10px 14px", background: executed ? C.bgElevated : C.bgSurface, border: `1px solid ${C.borderLight}`, borderRadius: 8, color: C.textBody, fontSize: 14, fontFamily: T.fontMono, outline: "none", boxSizing: "border-box", opacity: executed ? 0.6 : 1 }} />
        </div>
        <div>
          <label style={labelStyle}>Document File (Simulated)</label>
          <div onDragOver={(e) => { e.preventDefault(); setFileDragging(true); }} onDragLeave={() => setFileDragging(false)} onDrop={(e) => { e.preventDefault(); setFileDragging(false); }} style={{ border: `2px dashed ${fileDragging ? C.accent : C.borderLight}`, borderRadius: 8, padding: "24px 16px", textAlign: "center", background: fileDragging ? C.accentBg : C.bgSurface, transition: "all 0.2s", opacity: executed ? 0.6 : 1 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{"\u{1F4C4}"}</div>
            <div style={{ color: C.textMuted, fontSize: 13 }}>{executed ? "passport_scan.jpg" : "Drop passport_scan.jpg here"}</div>
            <div style={{ color: C.textDisabled, fontSize: 11, marginTop: 4, fontFamily: T.fontMono }}>{executed ? "42.3 KB \u00B7 JPEG" : "JPEG, PNG, PDF \u00B7 max 10 MB"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, padding: "10px 12px", background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 6, textAlign: "center" }}>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>FRONT_SIDE</div>
            <div style={{ color: C.textDisabled, fontSize: 10 }}>Selected</div>
          </div>
          <div style={{ flex: 1, padding: "10px 12px", background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 6, textAlign: "center", opacity: 0.4 }}>
            <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>BACK_SIDE</div>
            <div style={{ color: C.textDisabled, fontSize: 10 }}>Optional</div>
          </div>
        </div>
      </div>
      {!executed && <button onClick={onExecute} style={{ ...btnStyle, marginTop: 20 }}>Upload Document {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
            <div>
              <div style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>Document uploaded successfully</div>
              <div style={{ color: C.success, fontSize: 11, opacity: 0.8 }}>Review triggered — compliance team notified</div>
            </div>
          </div>
          {[{ label: "Document Type", value: `${docType} / FRONT_SIDE` }, { label: "Country", value: country }, { label: "Review Triggered", value: "true" }].map((f) => (
            <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
              <span style={{ color: C.textBody, fontSize: 12, fontFamily: T.fontMono }}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
          <div>
            <div style={{ color: C.error, fontSize: 13, fontWeight: 500 }}>409 Conflict</div>
            <div style={{ color: C.error, fontSize: 11, opacity: 0.8 }}>Verification already in progress for this customer</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Feature: Transaction Detail panel ───
function TxnDetailPanel({ onExecute, executed, isError }) {
  const tx = TXN_DETAIL_RESPONSE;
  return (
    <div>
      <h2 style={headingStyle}>Transaction Detail</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 16px 0" }}>Full detail for deposit <span style={{ color: C.accent, fontFamily: T.fontMono }}>{tx.id}</span>.</p>
      {!executed && <button onClick={onExecute} style={btnStyle}>Fetch Transaction Detail {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: T.fontMono, textTransform: "uppercase", marginBottom: 12 }}>Status Timeline</div>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {["PROCESSING", "COMPLETED"].map((stage, i) => (
                <div key={stage} style={{ display: "flex", alignItems: "center", flex: i < 1 ? 1 : "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.successBg, border: `1px solid ${C.successBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.success, fontWeight: 700 }}>{"\u2713"}</div>
                    <span style={{ fontSize: 10, color: C.success, fontFamily: T.fontMono, whiteSpace: "nowrap" }}>{stage}</span>
                  </div>
                  {i < 1 && <div style={{ flex: 1, height: 2, background: C.successBg, margin: "0 8px", marginBottom: 16 }} />}
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: T.fontMono, textTransform: "uppercase", marginBottom: 10 }}>Conversion</div>
            {[
              { label: "Source", value: `\u20AC${parseFloat(tx.sourceAmount).toLocaleString()} ${tx.sourceCurrency}` },
              { label: "Target", value: `${parseFloat(tx.targetAmount).toLocaleString()} ${tx.targetCurrency}` },
              { label: "Exchange Rate", value: tx.exchangeRate },
              { label: "Platform Fee", value: `\u20AC${tx.fee}` },
              { label: "Completed At", value: new Date(tx.completedAt).toLocaleString() },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
                <span style={{ color: C.textBody, fontSize: 12, fontFamily: T.fontMono }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: T.fontMono, textTransform: "uppercase", marginBottom: 10 }}>Developer Fee Breakdown</div>
            {[
              { label: "Spread Fee (bps)", value: String(tx.developerFee.developerSpreadFeeBps) },
              { label: "Fee Amount", value: `${tx.developerFee.amount} USDC`, highlight: true },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
                <span style={{ color: f.highlight ? C.warning : C.textBody, fontSize: 12, fontFamily: T.fontMono, fontWeight: f.highlight ? 700 : 400 }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: T.fontMono, textTransform: "uppercase", marginBottom: 10 }}>Deposit Instructions</div>
            {[
              { label: "Account Type", value: tx.depositInstructions.accountType },
              { label: "Reference", value: tx.depositInstructions.reference, copy: true },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: f.copy ? C.accent : C.textBody, fontSize: 12, fontFamily: T.fontMono, fontWeight: f.copy ? 700 : 400 }}>{f.value}</span>
                  {f.copy && <CopyButton text={f.value} />}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: T.fontMono, textTransform: "uppercase", marginBottom: 10 }}>On-Chain</div>
            {[
              { label: "Wallet Address", value: tx.walletAddress },
              { label: "Tx Hash", value: tx.txHash },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.accent, fontSize: 12, fontFamily: T.fontMono }}>{f.value.length > 20 ? `${f.value.slice(0, 10)}...${f.value.slice(-6)}` : f.value}</span>
                  <CopyButton text={f.value} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {executed && isError && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
          <div>
            <div style={{ color: C.error, fontSize: 14, fontWeight: 600 }}>404 Not Found</div>
            <div style={{ color: C.error, fontSize: 12, opacity: 0.8 }}>Transaction not found</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Round 4: Final 5 endpoint panels ───
function ListCustomersPanel({ onExecute, executed, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>List Customers</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Browse all customers in your organization before creating a new one.</p>
      {!executed && <button onClick={onExecute} style={btnStyle}>List Customers {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CUSTOMERS_LIST.map((c) => (
            <div key={c.customerId} style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: C.textBody, fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                <div style={{ color: C.textMuted, fontSize: 11, fontFamily: T.fontMono }}>{c.email}</div>
                <div style={{ color: C.textDisabled, fontSize: 10, fontFamily: T.fontMono, marginTop: 2 }}>{c.accountType} \u00B7 {c.customerId.slice(0, 8)}...</div>
              </div>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: C.bgElevated, color: C.textMuted, border: `1px solid ${C.borderLight}`, fontFamily: T.fontMono }}>{c.accountType}</span>
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "16px 20px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8 }}>
          <div style={{ color: C.warning, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{"\u26A0"} No Customers Found</div>
          <div style={{ color: C.warning, fontSize: 12 }}>Your organization has no customers yet. Use POST /customers to create one.</div>
        </div>
      )}
    </div>
  );
}

function KycSubmitPanel({ onExecute, executed, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>Submit KYC for Review</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 16px 0" }}>Manually submit the uploaded documents for compliance review.</p>
      <div style={{ padding: "12px 16px", background: C.accentBg, border: `1px solid ${C.accentBorder}`, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ color: C.accent, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{"\u{1F4A1}"} Manual Fallback</div>
        <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.6 }}>Normally auto-triggered when all required documents are uploaded. Use this endpoint only if auto-submission fails. Maximum 4 attempts.</div>
      </div>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <label style={labelStyle}>Customer ID</label>
        <div style={{ color: C.accent, fontSize: 13, fontFamily: T.fontMono }}>550e8400-e29b-41d4-a716-446655440001</div>
      </div>
      {!executed && <button onClick={onExecute} style={btnStyle}>Submit for Review {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
          <div>
            <div style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>KYC submitted for review</div>
            <div style={{ color: C.success, fontSize: 11, opacity: 0.8 }}>Compliance team will process within 24 hours</div>
          </div>
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
          <div>
            <div style={{ color: C.error, fontSize: 13, fontWeight: 500 }}>409 Conflict</div>
            <div style={{ color: C.error, fontSize: 11, opacity: 0.8 }}>Review already in progress for this customer</div>
          </div>
        </div>
      )}
    </div>
  );
}

function GetFeesPanel({ onExecute, executed, isError }) {
  const f = GET_CUSTOMER_FEES_RESPONSE;
  return (
    <div>
      <h2 style={headingStyle}>Verify Fee Configuration</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Read back the per-customer developer fee configuration to confirm it was set correctly.</p>
      {!executed && <button onClick={onExecute} style={btnStyle}>Get Fee Config {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          {[
            { label: "Customer ID", value: f.customerId.slice(0, 8) + "..." },
            { label: "Spread Fee", value: `${f.developerSpreadFeeBps} bps (${(f.developerSpreadFeeBps / 100).toFixed(2)}%)`, highlight: true },
            { label: "Updated At", value: new Date(f.updatedAt).toLocaleString() },
          ].map((r) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{r.label}</span>
              <span style={{ color: r.highlight ? C.warning : C.textBody, fontSize: 12, fontFamily: T.fontMono, fontWeight: r.highlight ? 700 : 400 }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
          <div>
            <div style={{ color: C.error, fontSize: 13, fontWeight: 500 }}>404 Not Found</div>
            <div style={{ color: C.error, fontSize: 11, opacity: 0.8 }}>Customer not found</div>
          </div>
        </div>
      )}
    </div>
  );
}

function WdListBanksPanel({ onExecute, executed, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>List Withdrawal Banks</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>View all configured withdrawal banks for this customer. Only ACTIVE banks can be used for withdrawals.</p>
      {!executed && <button onClick={onExecute} style={btnStyle}>List Banks {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {WITHDRAWAL_BANKS_LIST.map((b) => (
            <div key={b.id} style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: C.textBody, fontSize: 13, fontWeight: 600 }}>{b.beneficiaryName}</span>
                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: C.successBg, color: C.success, border: `1px solid ${C.successBorder}`, fontFamily: T.fontMono }}>{b.status}</span>
              </div>
              {[{ label: "IBAN", value: b.iban }, { label: "BIC", value: b.bic }, { label: "Currency", value: b.currency }, { label: "Bank ID", value: b.id }].map((f) => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMuted, fontSize: 11, fontFamily: T.fontMono }}>{f.label}</span>
                  <span style={{ color: C.textBody, fontSize: 11, fontFamily: T.fontMono }}>{f.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "16px 20px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8 }}>
          <div style={{ color: C.warning, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{"\u26A0"} No Banks Configured</div>
          <div style={{ color: C.warning, fontSize: 12 }}>This customer has no withdrawal banks. Use POST /withdrawal/banks to add one.</div>
        </div>
      )}
    </div>
  );
}

function VaListPanel({ onExecute, executed, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>List Virtual Accounts</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>View all virtual bank accounts (IBANs) for the customer, including status and account details.</p>
      {!executed && <button onClick={onExecute} style={btnStyle}>List Accounts {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {VA_LIST_RESPONSE.map((va) => (
            <div key={va.virtualAccountId} style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: C.textBody, fontSize: 13, fontWeight: 600, fontFamily: T.fontMono }}>{va.virtualAccountId}</span>
                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: C.successBg, color: C.success, border: `1px solid ${C.successBorder}`, fontFamily: T.fontMono }}>{va.status}</span>
              </div>
              {[{ label: "IBAN", value: va.virtualAccount.iban }, { label: "BIC", value: va.virtualAccount.bic }, { label: "Account Name", value: va.virtualAccount.accountName }, { label: "Bank", value: va.virtualAccount.bankName }, { label: "Currency", value: va.currency }].map((f) => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMuted, fontSize: 11, fontFamily: T.fontMono }}>{f.label}</span>
                  <span style={{ color: C.textBody, fontSize: 11, fontFamily: T.fontMono }}>{f.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "16px 20px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8 }}>
          <div style={{ color: C.warning, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{"\u26A0"} No Virtual Accounts</div>
          <div style={{ color: C.warning, fontSize: 12 }}>This customer has no virtual accounts. Use POST /virtual-account to create one.</div>
        </div>
      )}
    </div>
  );
}

// ─── Feature: KYC Verified Address panel ───
function KycAddressPanel({ onExecute, executed, isError }) {
  const addr = KYC_ADDRESS_RESPONSE;
  return (
    <div>
      <h2 style={headingStyle}>Verified Address</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>After KYC approval, retrieve the customer's verified address from their identity documents.</p>
      {!executed && <button onClick={onExecute} style={btnStyle}>Get Verified Address {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          {[
            { label: "Address", value: addr.addressLine1 },
            { label: "City", value: addr.city },
            { label: "Country", value: addr.country },
            { label: "Postal Code", value: addr.postalCode },
          ].map((f) => (
            <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
              <span style={{ color: C.textBody, fontSize: 12, fontFamily: T.fontMono }}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
          <div>
            <div style={{ color: C.error, fontSize: 13, fontWeight: 500 }}>403 Forbidden</div>
            <div style={{ color: C.error, fontSize: 11, opacity: 0.8 }}>Customer KYC not yet approved</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Feature: Org Balances panel ───
function OrgBalancesPanel({ onExecute, executed, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>Organization Balances</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Check your organization's current balances across all supported currencies and chains.</p>
      {!executed && <button onClick={onExecute} style={btnStyle}>Get Balances {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ORG_BALANCES_RESPONSE.map((b, i) => (
            <div key={i} style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.accent, fontWeight: 700, fontFamily: T.fontMono }}>{b.currency}</div>
                  <div>
                    <div style={{ color: C.textBody, fontSize: 14, fontWeight: 600 }}>{b.currency}</div>
                    <div style={{ color: C.textMuted, fontSize: 11, fontFamily: T.fontMono }}>{b.chain}</div>
                  </div>
                </div>
              </div>
              {[
                { label: "Available", value: `${parseFloat(b.available).toLocaleString()} ${b.currency}`, highlight: true },
                { label: "Pending", value: `${parseFloat(b.pending).toLocaleString()} ${b.currency}` },
              ].map((f) => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
                  <span style={{ color: f.highlight ? C.success : C.textBody, fontSize: 13, fontFamily: T.fontMono, fontWeight: f.highlight ? 600 : 400 }}>{f.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "16px 20px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8 }}>
          <div style={{ color: C.warning, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{"\u26A0"} No Balances</div>
          <div style={{ color: C.warning, fontSize: 12 }}>Your organization has no balances yet.</div>
        </div>
      )}
    </div>
  );
}

// ─── New step panels ───
function VaCreatePanel({ onExecute, executed }) {
  return (
    <div>
      <h2 style={headingStyle}>Create Virtual Account</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Request a dedicated IBAN for this customer. The IBAN is assigned asynchronously — listen for the virtual_account.approved webhook.</p>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <label style={labelStyle}>
          Currency
        </label>
        <input
          value="EUR"
          readOnly
          style={{
            width: "100%",
            padding: "10px 14px",
            background: C.bgElevated,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 8,
            color: C.textBody,
            fontSize: 14,
            fontFamily: T.fontSans,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      {!executed && (
        <button onClick={onExecute} style={btnStyle}>
          Create Virtual Account {"\u2192"}
        </button>
      )}
      {executed && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
          <span style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>Virtual account requested — polling for IBAN...</span>
        </div>
      )}
    </div>
  );
}

function VaPollPanel({ onExecute, executed, polling, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>IBAN Assigned</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>The provider has processed the request. Poll the endpoint or receive the virtual_account.approved webhook.</p>

      {!executed && !polling && (
        <button onClick={onExecute} style={btnStyle}>
          Poll for IBAN {"\u2192"}
        </button>
      )}

      {polling && !executed && (
        <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8 }}>
          <div className="spin" style={{ width: 16, height: 16, border: `2px solid ${C.warningBorder}`, borderTopColor: C.warning, borderRadius: "50%" }} />
          <span style={{ color: C.warning, fontSize: 13, fontWeight: 500 }}>Waiting for provider to assign IBAN...</span>
        </div>
      )}

      {executed && !isError && (
        <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          {[
            { label: "IBAN", value: VA_RESPONSE_APPROVED.virtualAccount.iban, highlight: true },
            { label: "BIC", value: VA_RESPONSE_APPROVED.virtualAccount.bic },
            { label: "Account Name", value: VA_RESPONSE_APPROVED.virtualAccount.accountName },
            { label: "Bank", value: VA_RESPONSE_APPROVED.virtualAccount.bankName },
            { label: "Bank Country", value: VA_RESPONSE_APPROVED.virtualAccount.bankCountry },
            { label: "Bank Address", value: VA_RESPONSE_APPROVED.virtualAccount.bankAddress },
          ].map((f) => (
            <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: f.highlight ? C.accent : C.textBody, fontSize: 13, fontWeight: f.highlight ? 700 : 400, fontFamily: T.fontMono }}>{f.value}</span>
                <CopyButton text={f.value} />
              </div>
            </div>
          ))}
        </div>
      )}

      {executed && isError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, marginTop: 8 }}>
          <span style={{ fontSize: 18, color: C.error }}>{"\u2717"}</span>
          <div>
            <div style={{ color: C.error, fontSize: 14, fontWeight: 600 }}>Virtual Account Rejected</div>
            <div style={{ color: C.error, fontSize: 12, opacity: 0.8 }}>Customer requires enhanced due diligence</div>
          </div>
        </div>
      )}
    </div>
  );
}

function VaDepositPanel({ onExecute, executed }) {
  return (
    <div>
      <h2 style={headingStyle}>Simulate Deposit</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Your customer transfers EUR to their dedicated IBAN. Compose detects the deposit, converts to USDC, and sends it to their wallet.</p>
      <div style={{ padding: "10px 14px", background: C.accentBg, border: `1px solid ${C.accentBorder}`, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ color: C.accent, fontSize: 12, lineHeight: 1.5 }}>
          In production, deposits are detected automatically when your customer sends EUR to the virtual IBAN above.
        </div>
      </div>
      {!executed && (
        <button onClick={onExecute} style={{ ...btnStyle }}>
          Simulate {"\u20AC"}1,000 Deposit {"\u2192"}
        </button>
      )}
      {executed && (
        <div style={{ marginTop: 16, padding: "16px 20px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
            <span style={{ color: C.success, fontSize: 14, fontWeight: 600 }}>Deposit Completed</span>
          </div>
          <div style={{ color: C.success, fontSize: 13, opacity: 0.9 }}>{"\u20AC"}1,000.00 {"\u2192"} 1,087.50 USDC sent to wallet</div>
        </div>
      )}
    </div>
  );
}

function WdBankPanel({ onExecute, executed, isError }) {
  const [form, setForm] = useState({
    beneficiary: "MARCO ROSSI",
    iban: "DE89370400440532013000",
    bic: "COBADEFFXXX",
    address: "Friedrichstra\u00DFe 123",
    city: "Berlin",
  });
  return (
    <div>
      <h2 style={headingStyle}>Add Withdrawal Bank</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Register a EUR bank account for the customer. Individual accounts are auto-approved.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { label: "Beneficiary Name", key: "beneficiary", placeholder: "JOHN DOE" },
          { label: "IBAN", key: "iban", placeholder: "DE89370400440532013000" },
          { label: "BIC", key: "bic", placeholder: "COBADEFFXXX" },
          { label: "Address", key: "address", placeholder: "123 Main St" },
          { label: "City", key: "city", placeholder: "Berlin" },
        ].map((f) => (
          <div key={f.key}>
            <label style={labelStyle}>
              {f.label}
            </label>
            <input
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              disabled={executed}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: executed ? C.bgElevated : C.bgSurface,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 8,
                color: C.textBody,
                fontSize: 14,
                fontFamily: T.fontSans,
                outline: "none",
                boxSizing: "border-box",
                opacity: executed ? 0.6 : 1,
              }}
            />
          </div>
        ))}
      </div>
      {!executed && (
        <button onClick={() => onExecute({ beneficiary: form.beneficiary, iban: form.iban, bic: form.bic, address: form.address, city: form.city })} style={btnStyle}>
          Add Bank Account {"\u2192"}
        </button>
      )}
      {executed && !isError && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
          <span style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>Bank account added</span>
          <span style={{ marginLeft: "auto" }}><StatusBadge status="ACTIVE" /></span>
        </div>
      )}
      {executed && isError && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
          <span style={{ color: C.error, fontSize: 13, fontWeight: 500 }}>Beneficiary name mismatch</span>
        </div>
      )}
    </div>
  );
}

function WdAllowancePanel({ onExecute, executed }) {
  const spentPct = (2500 / 10000) * 100;
  return (
    <div>
      <h2 style={headingStyle}>Check Withdrawal Allowance</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Before creating a withdrawal, verify your available allowance. Limits are configured in your Compose dashboard.</p>
      {!executed && (
        <button onClick={onExecute} style={btnStyle}>
          Check Allowance {"\u2192"}
        </button>
      )}
      {executed && (
        <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>Daily Limit</span>
            <span style={{ color: C.textBody, fontSize: 13, fontFamily: T.fontMono }}>10,000 USDC</span>
          </div>
          <div style={{ padding: "14px 0" }}>
            <div style={{ background: C.borderLight, borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div style={{ background: `linear-gradient(90deg, ${C.warning}, ${C.warning})`, width: `${spentPct}%`, height: "100%", borderRadius: 6 }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>Spent</span>
            <span style={{ color: C.textBody, fontSize: 13, fontFamily: T.fontMono }}>2,500 USDC</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>Available</span>
            <span style={{ color: C.success, fontSize: 13, fontFamily: T.fontMono }}>7,500 USDC</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>Resets</span>
            <span style={{ color: C.textBody, fontSize: 13, fontFamily: T.fontMono }}>Every 24h</span>
          </div>
        </div>
      )}
    </div>
  );
}

function WdCreatePanel({ onExecute, executed, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>Create Withdrawal</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Convert USDC to EUR and send to the customer's bank account.</p>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <label style={labelStyle}>
          Source Amount
        </label>
        <input
          value="1000"
          readOnly
          style={{
            width: "100%",
            padding: "10px 14px",
            background: C.bgElevated,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 8,
            color: C.textBody,
            fontSize: 14,
            fontFamily: T.fontSans,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 14,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: C.textMuted }}>Source</span>
            <span style={{ color: C.textBody, fontFamily: T.fontMono }}>USDC</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: C.textMuted }}>Target</span>
            <span style={{ color: C.textBody, fontFamily: T.fontMono }}>EUR</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: C.textMuted }}>Bank</span>
            <span style={{ color: C.textBody, fontFamily: T.fontMono }}>DE89...3000 (MARCO ROSSI)</span>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: "10px 14px", background: C.accentBg, border: `1px solid ${C.accentBorder}`, borderRadius: 8 }}>
          <div style={{ color: C.accent, fontSize: 12, lineHeight: 1.5 }}>
            An idempotency key ensures safe retries if the request fails.
          </div>
        </div>
      </div>
      {!executed && (
        <button onClick={onExecute} style={btnStyle}>
          Create Withdrawal {"\u2192"}
        </button>
      )}
      {executed && !isError && (
        <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginTop: 16 }}>
          {[
            { label: "Source", value: "1,000 USDC" },
            { label: "Target", value: "\u20AC865.50" },
            { label: "Rate", value: "0.8655" },
            { label: "Fee", value: "\u20AC2.50" },
          ].map((f) => (
            <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
              <span style={{ color: C.textBody, fontSize: 13, fontFamily: T.fontMono }}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
          <span style={{ color: C.error, fontSize: 13, fontWeight: 500 }}>Insufficient USDC balance</span>
        </div>
      )}
    </div>
  );
}

function WdStatusPanel({ onExecute, executed, polling, withdrawalStatus, isError }) {
  const stages = ["PROCESSING", "PROPOSED", "COMPLETED"];
  const currentIdx = stages.indexOf(withdrawalStatus);

  return (
    <div>
      <h2 style={headingStyle}>Withdrawal Status</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Track the withdrawal as it progresses. In production, listen for withdrawal.status_changed webhooks.</p>

      {!executed && !polling && (
        <button onClick={onExecute} style={btnStyle}>
          Track Status {"\u2192"}
        </button>
      )}

      {(polling || executed) && (
        <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 8 }}>
          {stages.map((stage, i) => {
            const isCompleted = i < currentIdx || (executed && !isError && i <= currentIdx);
            const isCurrent = i === currentIdx && !(executed && !isError);
            const isFuture = i > currentIdx;
            const isStuck = isError && stage === "COMPLETED" && i > currentIdx;
            return (
              <div key={stage} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: i < stages.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    background: isCompleted ? C.successBg : isCurrent ? C.warningBg : isStuck ? C.errorBg : C.bgDisabled,
                    color: isCompleted ? C.success : isCurrent ? C.warning : isStuck ? C.error : C.textDisabled,
                    border: `1px solid ${isCompleted ? C.successBorder : isCurrent ? C.warningBorder : isStuck ? C.errorBorder : C.borderDisabled}`,
                    animation: isCurrent ? "pulse 1.5s ease-in-out infinite" : "none",
                  }}
                >
                  {isCompleted ? "\u2713" : isStuck ? "\u2717" : i + 1}
                </div>
                <span style={{ color: isCompleted ? C.success : isCurrent ? C.warning : isFuture && !isStuck ? C.textDisabled : isStuck ? C.error : C.textSecondary, fontSize: 14, fontWeight: isCompleted || isCurrent ? 600 : 400 }}>
                  {stage}
                </span>
                {isCurrent && !isError && (
                  <div className="spin" style={{ width: 14, height: 14, border: `2px solid ${C.warningBorder}`, borderTopColor: C.warning, borderRadius: "50%", marginLeft: 4 }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {executed && !isError && (
        <div style={{ marginTop: 16, padding: "16px 20px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
            <span style={{ color: C.success, fontSize: 14, fontWeight: 600 }}>Withdrawal Completed</span>
          </div>
          <div style={{ color: C.success, fontSize: 13, opacity: 0.9 }}>1,000 USDC {"\u2192"} {"\u20AC"}865.50 sent to DE89...3000</div>
        </div>
      )}

      {executed && isError && (
        <div style={{ marginTop: 16, padding: "16px 20px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
            <span style={{ color: C.error, fontSize: 14, fontWeight: 600 }}>Withdrawal Stuck</span>
          </div>
          <div style={{ color: C.error, fontSize: 13, opacity: 0.9 }}>Status stuck at PROPOSED — manual review required</div>
        </div>
      )}
    </div>
  );
}

// ─── Feature: Verify Address panel ───
function VerifyAddressPanel({ onExecute, executed, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>Verify Wallet Address</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Validate the customer's wallet address before accepting deposits. Checks format, contract detection, and Safe wallet identification.</p>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <label style={labelStyle}>
          Address to Verify
        </label>
        <input
          value="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68"
          readOnly
          style={{ width: "100%", padding: "10px 14px", background: C.bgElevated, border: `1px solid ${C.borderLight}`, borderRadius: 8, color: C.textBody, fontSize: 13, fontFamily: T.fontMono, outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <div style={{ fontSize: 11, color: C.textMuted }}><span style={{ color: C.accent }}>Chain:</span> Base</div>
          <div style={{ fontSize: 11, color: C.textMuted }}><span style={{ color: C.accent }}>Network:</span> Ethereum</div>
        </div>
      </div>
      {!executed && (
        <button onClick={onExecute} style={btnStyle}>
          Verify Address {"\u2192"}
        </button>
      )}
      {executed && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
            <span style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>Address verified successfully</span>
          </div>
          {[
            { label: "Valid address format", ok: true },
            { label: "EOA (externally owned)", ok: true },
            { label: "Not a contract", ok: true },
          ].map((c) => (
            <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.success, fontSize: 14 }}>{"\u2713"}</span>
              <span style={{ color: C.textSecondary, fontSize: 13 }}>{c.label}</span>
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "12px 16px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.warning, fontSize: 16 }}>{"\u26A0"}</span>
            <div>
              <div style={{ color: C.warning, fontSize: 14, fontWeight: 600 }}>Warning: Unknown Contract</div>
              <div style={{ color: C.warning, fontSize: 12, opacity: 0.8 }}>This is an unknown contract or smart account address.</div>
            </div>
          </div>
          {[
            { label: "Valid address format", ok: true },
            { label: "Is a contract", ok: false },
            { label: "Not a Safe wallet", ok: false },
          ].map((c) => (
            <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: c.ok ? C.success : C.warning, fontSize: 14 }}>{c.ok ? "\u2713" : "\u26A0"}</span>
              <span style={{ color: C.textSecondary, fontSize: 13 }}>{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Feature: Revenue panels ───
function RevBalancePanel({ onExecute, executed, isError }) {
  const bal = isError ? DEV_FEE_NO_BALANCE : DEV_FEE_BALANCE;
  return (
    <div>
      <h2 style={headingStyle}>Developer Fee Balance</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Check your accumulated developer fees from customer deposits. Fees are earned from the spread you configured.</p>
      {!executed && (
        <button onClick={onExecute} style={btnStyle}>
          Check Balance {"\u2192"}
        </button>
      )}
      {executed && (
        <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, marginTop: 16 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: T.fontMono, textTransform: "uppercase", marginBottom: 8 }}>Available Balance</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: isError ? C.textDisabled : C.success, fontFamily: T.fontSans, marginBottom: 16 }}>
            {isError ? "$0.00" : "$1,250.50"} <span style={{ fontSize: 16, color: C.textMuted, fontWeight: 500 }}>USDC</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Total Earned", value: `${bal.balance} USDC` },
              { label: "Pending Claims", value: `${bal.pendingClaims} USDC` },
              { label: "Available", value: `${bal.availableBalance} USDC`, highlight: true },
              { label: "Currency", value: "USDC (Base)" },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
                <span style={{ color: f.highlight ? C.success : C.textBody, fontSize: 13, fontFamily: T.fontMono, fontWeight: f.highlight ? 600 : 400 }}>{f.value}</span>
              </div>
            ))}
          </div>
          {isError && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8 }}>
              <div style={{ color: C.warning, fontSize: 12 }}>{"\u{1F4A1}"} No fees earned yet. Configure developer fees on customer deposits to start earning.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RevClaimPanel({ onExecute, executed, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>Claim Developer Fees</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Initiate a transfer of your accumulated developer fees to your organization's wallet.</p>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>Amount</span>
          <span style={{ color: C.success, fontSize: 13, fontFamily: T.fontMono, fontWeight: 600 }}>1,250.50 USDC</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
          <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>Destination</span>
          <span style={{ color: C.textBody, fontSize: 13, fontFamily: T.fontMono }}>Org Wallet (Base)</span>
        </div>
      </div>
      {!executed && (
        <button onClick={onExecute} style={btnStyle}>
          Claim Fees {"\u2192"}
        </button>
      )}
      {executed && !isError && (
        <div style={{ padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
            <span style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>Claim initiated \u2014 txn_abc123</span>
          </div>
          <div style={{ color: C.success, fontSize: 12, opacity: 0.8, marginLeft: 26 }}>1,250.50 USDC transfer is being processed</div>
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
          <span style={{ color: C.error, fontSize: 13, fontWeight: 500 }}>No developer fees to claim</span>
        </div>
      )}
    </div>
  );
}

function RevConfirmPanel({ onExecute, executed, polling, claimStatus }) {
  const stages = ["PROCESSING", "COMPLETED"];
  const currentIdx = stages.indexOf(claimStatus);
  return (
    <div>
      <h2 style={headingStyle}>Transfer Confirmation</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Track the fee transfer to your organization wallet.</p>
      {!executed && !polling && (
        <button onClick={onExecute} style={btnStyle}>
          Track Transfer {"\u2192"}
        </button>
      )}
      {(polling || executed) && (
        <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 8 }}>
          {stages.map((stage, i) => {
            const isCompleted = i < currentIdx || (executed && i <= currentIdx);
            const isCurrent = i === currentIdx && !executed;
            return (
              <div key={stage} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: i < stages.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  background: isCompleted ? C.successBg : isCurrent ? C.warningBg : C.bgDisabled,
                  color: isCompleted ? C.success : isCurrent ? C.warning : C.textDisabled,
                  border: `1px solid ${isCompleted ? C.successBorder : isCurrent ? C.warningBorder : C.borderDisabled}`,
                  animation: isCurrent ? "pulse 1.5s ease-in-out infinite" : "none",
                }}>
                  {isCompleted ? "\u2713" : i + 1}
                </div>
                <span style={{ color: isCompleted ? C.success : isCurrent ? C.warning : C.textDisabled, fontSize: 14, fontWeight: isCompleted || isCurrent ? 600 : 400 }}>
                  {stage}
                </span>
                {isCurrent && (
                  <div className="spin" style={{ width: 14, height: 14, border: `2px solid ${C.warningBorder}`, borderTopColor: C.warning, borderRadius: "50%", marginLeft: 4 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
      {executed && (
        <div style={{ marginTop: 16, padding: "16px 20px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
            <span style={{ color: C.success, fontSize: 14, fontWeight: 600 }}>Transfer Completed</span>
          </div>
          <div style={{ color: C.success, fontSize: 13, opacity: 0.9 }}>1,250.50 USDC sent to your organization wallet</div>
        </div>
      )}
    </div>
  );
}

// ─── Feature: Wallet Management panels ───
function WmListPanel({ onExecute, executed, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>List Customer Wallets</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Retrieve all registered deposit wallets for the customer. Each wallet has a blockchain address for a specific chain and token.</p>
      {!executed && <button onClick={onExecute} style={btnStyle}>List Wallets {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {WALLET_LIST_RESPONSE.wallets.map((w) => (
            <div key={w.id} style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: C.textBody, fontSize: 13, fontWeight: 600, fontFamily: T.fontMono }}>{w.id}</span>
                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: w.enabled ? C.successBg : C.bgDisabled, color: w.enabled ? C.success : C.textDisabled, border: `1px solid ${w.enabled ? C.successBorder : C.borderDisabled}`, fontFamily: T.fontMono }}>{w.enabled ? "ENABLED" : "DISABLED"}</span>
              </div>
              {[{ label: "Address", value: `${w.address.slice(0, 10)}...${w.address.slice(-6)}` }, { label: "Chain", value: w.chain }, { label: "Token", value: w.currency.toUpperCase() }].map((f) => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMuted, fontSize: 11, fontFamily: T.fontMono }}>{f.label}</span>
                  <span style={{ color: C.textBody, fontSize: 11, fontFamily: T.fontMono }}>{f.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "16px 20px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8 }}>
          <div style={{ color: C.warning, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{"\u26A0"} No Wallets Configured</div>
          <div style={{ color: C.warning, fontSize: 12 }}>This customer has no deposit wallets registered. Use POST /deposit/wallets to add one.</div>
        </div>
      )}
    </div>
  );
}

function WmGetPanel({ onExecute, executed, isError }) {
  const w = WALLET_SINGLE_RESPONSE;
  return (
    <div>
      <h2 style={headingStyle}>Get Wallet Detail</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Retrieve full detail for a specific wallet by its ID.</p>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <label style={labelStyle}>Wallet ID</label>
        <div style={{ color: C.accent, fontSize: 13, fontFamily: T.fontMono }}>wallet_abc123</div>
      </div>
      {!executed && <button onClick={onExecute} style={btnStyle}>Get Wallet {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          {[{ label: "ID", value: w.id }, { label: "Address", value: w.address }, { label: "Chain", value: w.chain }, { label: "Currency", value: w.currency.toUpperCase() }, { label: "Enabled", value: String(w.enabled) }, { label: "Created At", value: new Date(w.createdAt).toLocaleString() }].map((f) => (
            <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
              <span style={{ color: C.textBody, fontSize: 12, fontFamily: T.fontMono, maxWidth: 220, textAlign: "right", wordBreak: "break-all" }}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
          <div>
            <div style={{ color: C.error, fontSize: 13, fontWeight: 500 }}>404 Not Found</div>
            <div style={{ color: C.error, fontSize: 11, opacity: 0.8 }}>Wallet not found</div>
          </div>
        </div>
      )}
    </div>
  );
}

function WmUpdatePanel({ onExecute, executed, isError }) {
  const [newAddress, setNewAddress] = useState("0xNewAddr4B52e8400e29b41d4a716446655440099");
  return (
    <div>
      <h2 style={headingStyle}>Update Wallet Address</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Update the blockchain address on an existing wallet. The wallet ID remains the same.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Wallet ID</label>
          <input value="wallet_abc123" readOnly style={{ width: "100%", padding: "10px 14px", background: C.bgElevated, border: `1px solid ${C.borderLight}`, borderRadius: 8, color: C.textMuted, fontSize: 13, fontFamily: T.fontMono, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={labelStyle}>New Address</label>
          <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} disabled={executed} style={{ width: "100%", padding: "10px 14px", background: executed ? C.bgElevated : C.bgSurface, border: `1px solid ${C.borderLight}`, borderRadius: 8, color: C.textBody, fontSize: 13, fontFamily: T.fontMono, outline: "none", boxSizing: "border-box", opacity: executed ? 0.6 : 1 }} />
        </div>
      </div>
      {!executed && <button onClick={() => onExecute({ newAddress })} style={btnStyle}>Update Address {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
          <span style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>Wallet address updated successfully</span>
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
          <div>
            <div style={{ color: C.error, fontSize: 13, fontWeight: 500 }}>409 Conflict</div>
            <div style={{ color: C.error, fontSize: 11, opacity: 0.8 }}>Address already in use by another wallet</div>
          </div>
        </div>
      )}
    </div>
  );
}

function WmDeletePanel({ onExecute, executed, isError }) {
  return (
    <div>
      <h2 style={headingStyle}>Delete Wallet</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>Permanently remove a deposit wallet from the customer. This action cannot be undone.</p>
      <div style={{ padding: "10px 14px", background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ color: C.warning, fontSize: 12, lineHeight: 1.5 }}>{"\u26A0"} Deleting a wallet will prevent new deposits to this address. Ensure no pending deposits are in-flight.</div>
      </div>
      <div style={{ background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        {[{ label: "Wallet ID", value: "wallet_abc123" }, { label: "Chain", value: "base" }, { label: "Token", value: "USDC" }].map((f) => (
          <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.textMuted, fontSize: 12, fontFamily: T.fontMono }}>{f.label}</span>
            <span style={{ color: C.textBody, fontSize: 12, fontFamily: T.fontMono }}>{f.value}</span>
          </div>
        ))}
      </div>
      {!executed && <button onClick={onExecute} style={{ ...btnStyle, background: `linear-gradient(135deg, ${C.errorBorder}, ${C.errorBg})`, borderColor: C.errorBorder }}>Delete Wallet {"\u2192"}</button>}
      {executed && !isError && (
        <div style={{ padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.success, fontSize: 16 }}>{"\u2713"}</span>
          <span style={{ color: C.success, fontSize: 13, fontWeight: 500 }}>Wallet deleted successfully</span>
        </div>
      )}
      {executed && isError && (
        <div style={{ padding: "12px 16px", background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ color: C.error, fontSize: 16 }}>{"\u2717"}</span>
            <span style={{ color: C.error, fontSize: 13, fontWeight: 500 }}>403 Forbidden</span>
          </div>
          <div style={{ color: C.error, fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>Unlicensed organizations cannot delete customer wallets. A wallet is required for deposits to be processed.</div>
        </div>
      )}
    </div>
  );
}

// ─── Feature: Sequence Diagram ───
function SequenceDiagram({ steps, executedSteps, currentStep, flowErrors }) {
  const arrowColors = { request: C.accent, response: C.success, internal: C.textMuted, webhook: C.warning };
  const executedList = steps.filter((s) => executedSteps.has(s.id));
  if (executedList.length === 0) return null;
  const colWidth = 25; // percentage per column
  return (
    <div style={{ background: C.bgSurface, borderBottom: `1px solid ${C.border}`, maxHeight: 240, overflowY: "auto", padding: "12px 24px" }}>
      {/* Actor headers */}
      <div style={{ display: "flex", marginBottom: 8 }}>
        {ACTOR_LABELS.map((label, i) => (
          <div key={i} style={{ width: `${colWidth}%`, textAlign: "center", fontSize: 10, color: C.textMuted, fontFamily: T.fontMono, fontWeight: 600, textTransform: "uppercase" }}>
            {label}
          </div>
        ))}
      </div>
      {/* Step rows */}
      {executedList.map((step) => {
        const actors = STEP_ACTORS[step.id] || [];
        const isCurrent = steps[currentStep]?.id === step.id;
        const isError = flowErrors?.has(step.id);
        return (
          <div key={step.id} style={{ padding: "4px 0", background: isCurrent ? "rgba(88, 166, 255, 0.05)" : "transparent", borderRadius: 4, animation: isCurrent ? "pulse 2s ease-in-out infinite" : "none" }}>
            <div style={{ fontSize: 9, color: C.textDisabled, fontFamily: T.fontMono, marginBottom: 2, paddingLeft: 4 }}>{step.label}</div>
            {actors.map((arrow, ai) => {
              const fromPct = arrow.from * colWidth + colWidth / 2;
              const toPct = arrow.to * colWidth + colWidth / 2;
              const leftPct = Math.min(fromPct, toPct);
              const widthPct = Math.abs(toPct - fromPct);
              const goingRight = arrow.to > arrow.from;
              const color = isError ? C.error : arrowColors[arrow.type] || `${C.textMuted}`;
              return (
                <div key={ai} style={{ position: "relative", height: 20, marginBottom: 1 }}>
                  {/* Arrow line */}
                  <div style={{
                    position: "absolute", top: 9, left: `${leftPct}%`, width: `${widthPct}%`,
                    borderTop: `1.5px ${arrow.type === "internal" ? "dashed" : "solid"} ${color}`,
                  }} />
                  {/* Arrowhead */}
                  <div style={{
                    position: "absolute", top: 5, left: `${toPct}%`,
                    marginLeft: goingRight ? -6 : 0,
                    width: 0, height: 0,
                    borderTop: "4px solid transparent", borderBottom: "4px solid transparent",
                    ...(goingRight
                      ? { borderLeft: `6px solid ${color}` }
                      : { borderRight: `6px solid ${color}` }),
                  }} />
                  {/* Label */}
                  <div style={{
                    position: "absolute", top: -1, left: `${(fromPct + toPct) / 2}%`, transform: "translateX(-50%)",
                    fontSize: 8, color, fontFamily: T.fontMono, whiteSpace: "nowrap",
                    background: C.bgSurface, padding: "0 3px",
                  }}>
                    {arrow.label}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Feature: Keyboard Shortcuts Overlay ───
function KeyboardShortcutsOverlay({ onClose }) {
  const closeButtonRef = useRef(null);
  useEffect(() => { if (closeButtonRef.current) closeButtonRef.current.focus(); }, []);
  const shortcuts = [
    { key: "Space / Enter", desc: "Execute current step" },
    { key: "\u2192 / \u2193", desc: "Next step" },
    { key: "\u2190 / \u2191", desc: "Previous step" },
    { key: "1 \u2013 5", desc: "Switch flow tab" },
    { key: "R", desc: "Reset current flow" },
    { key: "P", desc: "Toggle autoplay" },
    { key: "E", desc: "Toggle error mode" },
    { key: "S", desc: "Toggle sequence diagram" },
    { key: "?", desc: "Show/hide this overlay" },
    { key: "Esc", desc: "Close overlay" },
  ];
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); closeButtonRef.current?.focus(); } }}
        style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, maxWidth: 420, width: "90%" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 id="shortcuts-title" style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0, fontFamily: T.fontSans }}>Keyboard Shortcuts</h3>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close keyboard shortcuts" style={{ background: "none", border: "none", color: C.textMuted, fontSize: 18, cursor: "pointer", padding: 0 }}>{"\u2715"}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {shortcuts.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <span style={{
                padding: "3px 8px", background: C.bgSurface, border: `1px solid ${C.borderLight}`, borderRadius: 4,
                color: C.textBody, fontSize: 11, fontFamily: T.fontMono, fontWeight: 600, whiteSpace: "nowrap",
              }}>{s.key}</span>
              <span style={{ color: C.textMuted, fontSize: 12 }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── API panel (right side) ───
function ApiPanel({ calls, webhooks, onClear }) {
  const [tab, setTab] = useState("api");
  const [expanded, setExpanded] = useState(new Set());
  const [lastSeenWebhookCount, setLastSeenWebhookCount] = useState(0);
  const [codeLanguage, setCodeLanguage] = useState("curl");
  const webhookRef = useRef(null);

  useEffect(() => {
    if (webhookRef.current) webhookRef.current.scrollTop = webhookRef.current.scrollHeight;
  }, [webhooks]);

  // Feature 4: Auto-expand latest call
  useEffect(() => {
    if (calls.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(calls.length - 1);
        return next;
      });
    }
  }, [calls.length]);

  // Feature 5: Update lastSeenWebhookCount when switching to webhooks tab
  useEffect(() => {
    if (tab === "webhooks") {
      setLastSeenWebhookCount(webhooks.length);
    }
  }, [tab, webhooks.length]);

  const unreadCount = tab !== "webhooks" ? webhooks.length - lastSeenWebhookCount : 0;

  const toggleExpand = (idx) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const hasClearable = calls.length > 0 || webhooks.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, gap: 0, alignItems: "center" }}>
        {[
          { id: "api", label: "API Calls", count: calls.length },
          { id: "webhooks", label: "Webhooks", count: webhooks.length },
          { id: "code", label: "Code", count: calls.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "12px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: tab === t.id ? C.textBody : C.textMuted,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: T.fontSans,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              position: "relative",
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span
                style={{
                  background: t.id === "webhooks" ? C.webhook : C.borderLight,
                  color: "#fff",
                  fontSize: 10,
                  padding: "1px 7px",
                  borderRadius: 100,
                  fontFamily: T.fontMono,
                }}
              >
                {t.count}
              </span>
            )}
            {/* Feature 5: Unread webhook badge */}
            {t.id === "webhooks" && unreadCount > 0 && (
              <span
                aria-live="polite"
                aria-atomic="true"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 12,
                  background: C.error,
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 100,
                  fontFamily: T.fontMono,
                  animation: "pulse 1.5s ease-in-out infinite",
                  minWidth: 14,
                  textAlign: "center",
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        ))}
        {/* Feature 1: Clear button */}
        {hasClearable && onClear && (
          <button
            onClick={onClear}
            style={{
              background: "none",
              border: `1px solid ${C.borderLight}`,
              borderRadius: 4,
              color: C.textMuted,
              fontSize: 11,
              cursor: "pointer",
              padding: "3px 8px",
              fontFamily: T.fontMono,
              marginRight: 8,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }} ref={tab === "webhooks" ? webhookRef : null}>
        {/* Feature 4: Collapsible API calls */}
        {tab === "api" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {calls.length === 0 && (
              <div style={{ color: C.textDisabled, fontSize: 13, textAlign: "center", padding: "40px 20px", fontStyle: "italic" }}>
                Execute a step to see API calls here
              </div>
            )}
            {calls.map((call, i) => {
              const isExpanded = expanded.has(i);
              const statusNum = parseInt(call.status);
              const isErrorStatus = statusNum >= 400;
              return (
                <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div
                    onClick={() => toggleExpand(i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 4px",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: C.textMuted,
                        transition: "transform 0.2s",
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        display: "inline-block",
                        width: 14,
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {"\u25B6"}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: T.fontMono,
                        background: call.method === "GET" ? C.successBg : call.method === "PATCH" ? C.warningBg : call.method === "DELETE" ? C.errorBg : C.accentBg,
                        color: call.method === "GET" ? C.success : call.method === "PATCH" ? C.warning : call.method === "DELETE" ? C.error : C.accent,
                        flexShrink: 0,
                      }}
                    >
                      {call.method}
                    </span>
                    <span style={{ color: C.textSecondary, fontSize: 12, fontFamily: T.fontMono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{call.path}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: T.fontMono,
                        padding: "2px 6px",
                        borderRadius: 4,
                        flexShrink: 0,
                        background: isErrorStatus ? C.errorBg : C.successBg,
                        color: isErrorStatus ? C.error : C.success,
                      }}
                    >
                      {call.status}
                    </span>
                  </div>
                  {isExpanded && (
                    <div style={{ paddingLeft: 22, paddingBottom: 12 }}>
                      {/* Feature 3: Copy JSON buttons */}
                      {call.body && (
                        <div style={{ position: "relative" }}>
                          <JsonBlock data={call.body} title="Request Body" />
                          <div style={{ position: "absolute", top: 4, right: 4 }}>
                            <CopyButton text={JSON.stringify(call.body, null, 2)} />
                          </div>
                        </div>
                      )}
                      <div style={{ position: "relative" }}>
                        <JsonBlock data={call.response} title="Response" />
                        <div style={{ position: "absolute", top: 4, right: 4 }}>
                          <CopyButton text={JSON.stringify(call.response, null, 2)} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {tab === "webhooks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {webhooks.length === 0 && (
              <div style={{ color: C.textDisabled, fontSize: 13, textAlign: "center", padding: "40px 20px", fontStyle: "italic" }}>
                Webhook events will appear here in real-time
              </div>
            )}
            {webhooks.map((wh, i) => (
              <div
                key={i}
                style={{
                  background: C.bgSurface,
                  border: `1px solid ${C.borderLight}`,
                  borderLeft: `3px solid ${C.webhook}`,
                  borderRadius: 8,
                  padding: "12px 14px",
                  animation: "fadeSlideIn 0.3s ease-out",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", background: "#2d1b4e", color: "#d2a8ff", borderRadius: 4, fontFamily: T.fontMono, fontWeight: 600 }}>WEBHOOK</span>
                  <span style={{ color: C.textSecondary, fontSize: 12, fontFamily: T.fontMono, fontWeight: 600 }}>{wh.event_type}</span>
                  <span style={{ color: C.textDisabled, fontSize: 10, marginLeft: "auto", fontFamily: T.fontMono }}>
                    {new Date(wh.created_at).toLocaleTimeString()}
                  </span>
                </div>
                {/* Feature 3: Copy JSON button on webhook */}
                <div style={{ position: "relative" }}>
                  <JsonBlock data={wh} />
                  <div style={{ position: "absolute", top: 4, right: 4 }}>
                    <CopyButton text={JSON.stringify(wh, null, 2)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Feature 6: Code Snippets Tab */}
        {tab === "code" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Language selector */}
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { id: "curl", label: "cURL" },
                { id: "node", label: "Node.js" },
                { id: "python", label: "Python" },
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setCodeLanguage(lang.id)}
                  style={{
                    padding: "4px 12px",
                    background: codeLanguage === lang.id ? C.accentBg : "none",
                    border: `1px solid ${codeLanguage === lang.id ? C.accentBorder : C.borderLight}`,
                    borderRadius: 4,
                    color: codeLanguage === lang.id ? C.accent : C.textMuted,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: T.fontMono,
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            {calls.length === 0 && (
              <div style={{ color: C.textDisabled, fontSize: 13, textAlign: "center", padding: "40px 20px", fontStyle: "italic" }}>
                Execute a step to see code snippets here
              </div>
            )}
            {calls.map((call, i) => {
              const snippet = generateCodeSnippet(call, codeLanguage);
              return (
                <div key={i} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: T.fontMono,
                        background: call.method === "GET" ? C.successBg : call.method === "PATCH" ? C.warningBg : call.method === "DELETE" ? C.errorBg : C.accentBg,
                        color: call.method === "GET" ? C.success : call.method === "PATCH" ? C.warning : call.method === "DELETE" ? C.error : C.accent,
                      }}
                    >
                      {call.method}
                    </span>
                    <span style={{ color: C.textSecondary, fontSize: 12, fontFamily: T.fontMono }}>{call.path}</span>
                  </div>
                  <div style={{ position: "relative" }}>
                    <pre
                      style={{
                        background: C.bgSurface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: "14px 16px",
                        fontSize: 11.5,
                        lineHeight: 1.55,
                        color: C.textBody,
                        overflow: "auto",
                        maxHeight: 320,
                        fontFamily: T.fontMono,
                        margin: 0,
                      }}
                    >
                      {snippet}
                    </pre>
                    <div style={{ position: "absolute", top: 4, right: 4 }}>
                      <CopyButton text={snippet} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Button style ───
const btnStyle = {
  marginTop: 20,
  padding: "12px 24px",
  background: C.ctaBg,
  border: `1px solid ${C.ctaBorder}`,
  borderRadius: T.radius.md,
  color: C.ctaText,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: T.fontSans,
  letterSpacing: "-0.01em",
  width: "100%",
  transition: T.transition,
};

// ─── Main App ───
export default function ComposeDemo() {
  const [activeFlow, setActiveFlow] = useState("onboarding");
  const [flowSteps, setFlowSteps] = useState({ onboarding: 0, "virtual-accounts": 0, withdrawals: 0, revenue: 0, wallets: 0 });
  const [flowExecuted, setFlowExecuted] = useState({ onboarding: new Set(), "virtual-accounts": new Set(), withdrawals: new Set(), revenue: new Set(), wallets: new Set() });
  const [flowPolling, setFlowPolling] = useState({ onboarding: false, "virtual-accounts": false, withdrawals: false, revenue: false, wallets: false });
  const [apiCalls, setApiCalls] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [withdrawalStatus, setWithdrawalStatus] = useState(null);
  const [claimStatus, setClaimStatus] = useState(null);

  // Feature 2: Reset flow epoch
  const epochRef = useRef(0);
  const formDataRef = useRef({});

  // Feature 7: Error simulation
  const [errorMode, setErrorMode] = useState(false);
  const [flowErrors, setFlowErrors] = useState({ onboarding: new Set(), "virtual-accounts": new Set(), withdrawals: new Set(), revenue: new Set(), wallets: new Set() });

  // Feature 8: Autoplay
  const [autoPlaying, setAutoPlaying] = useState(false);
  const autoPlayRef = useRef(false);

  // New features
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSequence, setShowSequence] = useState(false);

  const currentStep = flowSteps[activeFlow];
  const executedSteps = flowExecuted[activeFlow];
  const polling = flowPolling[activeFlow];
  const steps = FLOWS[activeFlow].steps;

  const setCurrentStep = (v) => setFlowSteps((p) => ({ ...p, [activeFlow]: v }));
  const markDone = useCallback(
    (stepId) => {
      setFlowExecuted((p) => ({ ...p, [activeFlow]: new Set([...p[activeFlow], stepId]) }));
    },
    [activeFlow]
  );
  const setPolling = (v) => setFlowPolling((p) => ({ ...p, [activeFlow]: v }));

  const markError = useCallback(
    (stepId) => {
      setFlowErrors((p) => ({ ...p, [activeFlow]: new Set([...p[activeFlow], stepId]) }));
    },
    [activeFlow]
  );

  const addApiCall = useCallback((call) => {
    setApiCalls((prev) => [...prev, call]);
  }, []);

  const addWebhook = useCallback((type, data) => {
    setWebhooks((prev) => [...prev, makeWebhook(type, data)]);
  }, []);

  // Feature 2: Reset flow
  const resetFlow = useCallback(() => {
    setFlowSteps((p) => ({ ...p, [activeFlow]: 0 }));
    setFlowExecuted((p) => ({ ...p, [activeFlow]: new Set() }));
    setFlowPolling((p) => ({ ...p, [activeFlow]: false }));
    setFlowErrors((p) => ({ ...p, [activeFlow]: new Set() }));
    if (activeFlow === "withdrawals") {
      setWithdrawalStatus(null);
    }
    if (activeFlow === "revenue") {
      setClaimStatus(null);
    }
    epochRef.current += 1;
    setApiCalls([]);
    setWebhooks([]);
    setAutoPlaying(false);
    autoPlayRef.current = false;
  }, [activeFlow]);

  const executeStep = useCallback(
    (stepId) => {
      const epoch = epochRef.current;
      switch (stepId) {
        case "list-customers":
          if (errorMode) {
            addApiCall({ method: "GET", path: "/api/v2/customers", status: "200 OK", response: CUSTOMERS_LIST_EMPTY });
            markError("list-customers");
            markDone("list-customers");
          } else {
            addApiCall({ method: "GET", path: "/api/v2/customers", status: "200 OK", response: CUSTOMERS_LIST });
            markDone("list-customers");
          }
          break;

        case "create":
          addApiCall({
            method: "POST",
            path: "/api/v2/customers",
            status: "201 Created",
            body: { name: (formDataRef.current.name || "Marco Rossi").toUpperCase(), accountType: "individual", email: formDataRef.current.email || "marco.rossi@example.com", expectedMonthlyVolume: parseInt(formDataRef.current.volume) || 25000 },
            response: DEMO_CUSTOMER,
          });
          setTimeout(() => {
            if (epochRef.current !== epoch) return;
            addWebhook("customer.created", { customer_id: DEMO_CUSTOMER.customerId });
          }, 600);
          markDone("create");
          break;

        case "kyc":
          addApiCall({
            method: "POST",
            path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/kyc`,
            status: "200 OK",
            response: KYC_RESPONSE,
          });
          markDone("kyc");
          break;

        case "verify":
          if (errorMode) {
            // Error path: KYC rejected
            setPolling(true);
            addApiCall({
              method: "GET",
              path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}`,
              status: "200 OK",
              response: CUSTOMER_DETAIL_PENDING,
            });
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              addApiCall({
                method: "GET",
                path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}`,
                status: "200 OK",
                response: KYC_REJECTED_RESPONSE,
              });
              addWebhook("customer.kyc.rejected", { customer_id: DEMO_CUSTOMER.customerId });
              setPolling(false);
              markError("verify");
              markDone("verify");
            }, 3000);
          } else {
            // Success path
            setPolling(true);
            addApiCall({
              method: "GET",
              path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}`,
              status: "200 OK",
              response: CUSTOMER_DETAIL_PENDING,
            });
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              addWebhook("customer.kyc.submitted", { customer_id: DEMO_CUSTOMER.customerId, attempt: 1 });
            }, 800);
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              addApiCall({
                method: "GET",
                path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}`,
                status: "200 OK",
                response: CUSTOMER_DETAIL_APPROVED,
              });
              addWebhook("customer.kyc.approved", { customer_id: DEMO_CUSTOMER.customerId });
              setPolling(false);
              markDone("verify");
            }, 3000);
            // After KYC approval, customer auto-upgrades to enhanced level
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              addWebhook("customer.kyc.level_changed", { customer_id: DEMO_CUSTOMER.customerId, previous_level: "customers-api-basic", new_level: "customers-api-enhanced" });
            }, 3800);
          }
          break;

        case "kyc-addr":
          if (errorMode) {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/kyc/address`, status: "403 Forbidden", response: KYC_ADDRESS_NOT_FOUND });
            markError("kyc-addr");
            markDone("kyc-addr");
          } else {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/kyc/address`, status: "200 OK", response: KYC_ADDRESS_RESPONSE });
            markDone("kyc-addr");
          }
          break;

        case "wallet":
          addApiCall({
            method: "POST",
            path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/deposit/wallets`,
            status: "201 Created",
            body: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68", currency: "usdc", chain: "base" },
            response: WALLET_RESPONSE,
          });
          markDone("wallet");
          break;

        case "fees":
          addApiCall({
            method: "PATCH",
            path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/developer-fees`,
            status: "200 OK",
            body: { developerSpreadFeeBps: parseInt(formDataRef.current.bps) || 100 },
            response: DEVELOPER_FEES_RESPONSE,
          });
          markDone("fees");
          break;

        case "get-fees":
          if (errorMode) {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/developer-fees`, status: "404 Not Found", response: GET_CUSTOMER_FEES_NOT_FOUND });
            markError("get-fees");
            markDone("get-fees");
          } else {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/developer-fees`, status: "200 OK", response: GET_CUSTOMER_FEES_RESPONSE });
            markDone("get-fees");
          }
          break;

        case "deposit":
          addApiCall({
            method: "GET",
            path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/deposit?currency=eur`,
            status: "200 OK",
            response: DEPOSIT_DETAILS,
          });
          markDone("deposit");
          break;

        case "transactions":
          addApiCall({
            method: "GET",
            path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/transactions`,
            status: "200 OK",
            response: TRANSACTIONS,
          });
          setTimeout(() => {
            if (epochRef.current !== epoch) return;
            addWebhook("deposit.created", { transaction_id: TRANSACTIONS[0].id, customer_id: DEMO_CUSTOMER.customerId, status: "PROCESSING" });
          }, 500);
          setTimeout(() => {
            if (epochRef.current !== epoch) return;
            addWebhook("deposit.status_changed", { transaction_id: TRANSACTIONS[0].id, customer_id: DEMO_CUSTOMER.customerId, status: "COMPLETED" });
          }, 1200);
          markDone("transactions");
          break;

        case "doc-upload": {
          if (errorMode) {
            addApiCall({ method: "POST", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/documents`, status: "409 Conflict", body: { file: "passport_scan.jpg", idDocType: "PASSPORT", idDocSubType: "FRONT_SIDE", country: "GBR" }, response: DOC_UPLOAD_CONFLICT });
            markError("doc-upload");
            markDone("doc-upload");
          } else {
            addApiCall({ method: "POST", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/documents`, status: "200 OK", body: { file: "passport_scan.jpg", idDocType: "PASSPORT", idDocSubType: "FRONT_SIDE", country: "GBR" }, response: DOC_UPLOAD_RESPONSE });
            markDone("doc-upload");
          }
          break;
        }

        case "kyc-submit": {
          if (errorMode) {
            addApiCall({ method: "POST", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/kyc/submit`, status: "409 Conflict", response: KYC_SUBMIT_CONFLICT });
            markError("kyc-submit");
            markDone("kyc-submit");
          } else {
            addApiCall({ method: "POST", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/kyc/submit`, status: "200 OK", response: KYC_SUBMIT_RESPONSE });
            markDone("kyc-submit");
          }
          break;
        }

        case "txn-detail": {
          if (errorMode) {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/transactions/${TRANSACTIONS[0].id}`, status: "404 Not Found", response: TXN_NOT_FOUND });
            markError("txn-detail");
            markDone("txn-detail");
          } else {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/transactions/${TRANSACTIONS[0].id}`, status: "200 OK", response: TXN_DETAIL_RESPONSE });
            markDone("txn-detail");
          }
          break;
        }

        case "va-create":
          addApiCall({
            method: "POST",
            path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/virtual-account`,
            status: "202 Accepted",
            body: { currency: "EUR" },
            response: VA_RESPONSE_PENDING,
          });
          setTimeout(() => {
            if (epochRef.current !== epoch) return;
            addWebhook("virtual_account.created", { correlation_id: VIRTUAL_ACCOUNT_ID, customer_id: DEMO_CUSTOMER.customerId, status: "PENDING" });
          }, 600);
          markDone("va-create");
          break;

        case "va-poll":
          if (errorMode) {
            // Error path: VA rejected
            setPolling(true);
            addApiCall({
              method: "GET",
              path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/virtual-account`,
              status: "200 OK",
              response: VA_RESPONSE_PENDING,
            });
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              addApiCall({
                method: "GET",
                path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/virtual-account`,
                status: "200 OK",
                response: VA_REJECTED_RESPONSE,
              });
              addWebhook("virtual_account.rejected", { correlation_id: VIRTUAL_ACCOUNT_ID, customer_id: DEMO_CUSTOMER.customerId, status: "REJECTED" });
              setPolling(false);
              markError("va-poll");
              markDone("va-poll");
            }, 2500);
          } else {
            // Success path
            setPolling(true);
            addApiCall({
              method: "GET",
              path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/virtual-account`,
              status: "200 OK",
              response: VA_RESPONSE_PENDING,
            });
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              addApiCall({
                method: "GET",
                path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/virtual-account`,
                status: "200 OK",
                response: VA_RESPONSE_APPROVED,
              });
              addWebhook("virtual_account.approved", { correlation_id: VIRTUAL_ACCOUNT_ID, customer_id: DEMO_CUSTOMER.customerId, status: "APPROVED" });
              setPolling(false);
              markDone("va-poll");
            }, 2500);
          }
          break;

        case "va-list":
          if (errorMode) {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/virtual-accounts`, status: "200 OK", response: VA_LIST_EMPTY });
            markError("va-list");
            markDone("va-list");
          } else {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/virtual-accounts`, status: "200 OK", response: VA_LIST_RESPONSE });
            markDone("va-list");
          }
          break;

        case "va-deposit":
          setTimeout(() => {
            if (epochRef.current !== epoch) return;
            addWebhook("deposit.created", { transaction_id: "txn_va_" + VIRTUAL_ACCOUNT_ID.slice(-6), customer_id: DEMO_CUSTOMER.customerId, status: "PROCESSING" });
          }, 500);
          setTimeout(() => {
            if (epochRef.current !== epoch) return;
            addWebhook("deposit.status_changed", { transaction_id: "txn_va_" + VIRTUAL_ACCOUNT_ID.slice(-6), customer_id: DEMO_CUSTOMER.customerId, status: "COMPLETED" });
            markDone("va-deposit");
          }, 1500);
          break;

        case "wd-bank": {
          const bankBody = { beneficiaryName: formDataRef.current.beneficiary || "MARCO ROSSI", iban: formDataRef.current.iban || "DE89370400440532013000", bic: formDataRef.current.bic || "COBADEFFXXX", addressLine1: formDataRef.current.address || "Friedrichstra\u00DFe 123", city: formDataRef.current.city || "Berlin", country: "DE", currency: "EUR", recipientType: "CUSTOMER" };
          if (errorMode) {
            // Error path: 400 Bad Request
            addApiCall({
              method: "POST",
              path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/withdrawal/banks`,
              status: "400 Bad Request",
              body: bankBody,
              response: WITHDRAWAL_BANK_ERROR,
            });
            // Fire withdrawal_bank.rejected webhook — in production this fires when a bank
            // created via 201 is later rejected during async review
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              addWebhook("withdrawal_bank.rejected", { customer_id: DEMO_CUSTOMER.customerId, withdrawal_bank_id: BANK_ID, status: "REJECTED", reason: "Beneficiary name does not match account holder" });
            }, 800);
            markError("wd-bank");
            markDone("wd-bank");
          } else {
            // Success path
            addApiCall({
              method: "POST",
              path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/withdrawal/banks`,
              status: "201 Created",
              body: bankBody,
              response: WITHDRAWAL_BANK_RESPONSE,
            });
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              addWebhook("withdrawal_bank.created", { customer_id: DEMO_CUSTOMER.customerId, withdrawal_bank_id: BANK_ID, status: "PENDING" });
            }, 300);
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              addWebhook("withdrawal_bank.approved", { customer_id: DEMO_CUSTOMER.customerId, withdrawal_bank_id: BANK_ID, status: "ACTIVE" });
              markDone("wd-bank");
            }, 500);
          }
          break;
        }

        case "wd-list-banks":
          if (errorMode) {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/withdrawal/banks`, status: "200 OK", response: WITHDRAWAL_BANKS_EMPTY });
            markError("wd-list-banks");
            markDone("wd-list-banks");
          } else {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/withdrawal/banks`, status: "200 OK", response: WITHDRAWAL_BANKS_LIST });
            markDone("wd-list-banks");
          }
          break;

        case "wd-allowance":
          addApiCall({
            method: "GET",
            path: "/api/v2/customers/withdrawal/allowance",
            status: "200 OK",
            response: ALLOWANCE_RESPONSE,
          });
          markDone("wd-allowance");
          break;

        case "wd-create":
          if (errorMode) {
            // Error path: 400 Bad Request
            addApiCall({
              method: "POST",
              path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/withdrawal`,
              status: "400 Bad Request",
              body: { sourceAmount: "1000", withdrawalBankId: BANK_ID, idempotencyKey: `wd_${Date.now()}` },
              response: INSUFFICIENT_BALANCE_ERROR,
            });
            markError("wd-create");
            markDone("wd-create");
          } else {
            // Success path
            addApiCall({
              method: "POST",
              path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/withdrawal`,
              status: "201 Created",
              body: { sourceAmount: "1000", withdrawalBankId: BANK_ID, idempotencyKey: `wd_${Date.now()}` },
              response: WITHDRAWAL_RESPONSE,
            });
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              addWebhook("withdrawal.created", { transaction_id: WITHDRAWAL_TXN_ID, customer_id: DEMO_CUSTOMER.customerId, status: "PROCESSING" });
            }, 600);
            markDone("wd-create");
          }
          break;

        case "wd-status":
          if (errorMode) {
            // Error path: stuck at PROPOSED
            setPolling(true);
            setWithdrawalStatus("PROCESSING");
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              setWithdrawalStatus("PROPOSED");
              addWebhook("withdrawal.status_changed", { transaction_id: WITHDRAWAL_TXN_ID, customer_id: DEMO_CUSTOMER.customerId, status: "PROPOSED" });
              // Stay stuck here — do not complete
              setPolling(false);
              markError("wd-status");
              markDone("wd-status");
            }, 1500);
          } else {
            // Success path
            setPolling(true);
            setWithdrawalStatus("PROCESSING");
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              setWithdrawalStatus("PROPOSED");
              addWebhook("withdrawal.status_changed", { transaction_id: WITHDRAWAL_TXN_ID, customer_id: DEMO_CUSTOMER.customerId, status: "PROPOSED" });
            }, 1500);
            setTimeout(() => {
              if (epochRef.current !== epoch) return;
              setWithdrawalStatus("COMPLETED");
              addWebhook("withdrawal.status_changed", { transaction_id: WITHDRAWAL_TXN_ID, customer_id: DEMO_CUSTOMER.customerId, status: "COMPLETED" });
              setPolling(false);
              markDone("wd-status");
            }, 3000);
          }
          break;

        // ─── Verify Address ───
        case "verify-addr":
          if (errorMode) {
            addApiCall({
              method: "POST",
              path: "/api/v2/verify-address",
              status: "200 OK",
              body: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68" },
              response: VERIFY_ADDRESS_ERROR_RESPONSE,
            });
            markError("verify-addr");
            markDone("verify-addr");
          } else {
            addApiCall({
              method: "POST",
              path: "/api/v2/verify-address",
              status: "200 OK",
              body: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68" },
              response: VERIFY_ADDRESS_RESPONSE,
            });
            markDone("verify-addr");
          }
          break;

        // ─── Revenue flow ───
        case "org-balances":
          if (errorMode) {
            addApiCall({ method: "GET", path: "/api/v2/balances", status: "200 OK", response: ORG_BALANCES_EMPTY });
            markError("org-balances");
            markDone("org-balances");
          } else {
            addApiCall({ method: "GET", path: "/api/v2/balances", status: "200 OK", response: ORG_BALANCES_RESPONSE });
            markDone("org-balances");
          }
          break;

        case "rev-balance":
          if (errorMode) {
            addApiCall({
              method: "GET",
              path: "/api/v2/developer-fees",
              status: "200 OK",
              response: DEV_FEE_NO_BALANCE,
            });
            markError("rev-balance");
            markDone("rev-balance");
          } else {
            addApiCall({
              method: "GET",
              path: "/api/v2/developer-fees",
              status: "200 OK",
              response: DEV_FEE_BALANCE,
            });
            markDone("rev-balance");
          }
          break;

        case "rev-claim":
          if (errorMode) {
            addApiCall({
              method: "POST",
              path: "/api/v2/developer-fees",
              status: "400 Bad Request",
              body: {},
              response: DEV_FEE_CLAIM_ERROR,
            });
            markError("rev-claim");
            markDone("rev-claim");
          } else {
            addApiCall({
              method: "POST",
              path: "/api/v2/developer-fees",
              status: "200 OK",
              body: {},
              response: DEV_FEE_CLAIM_RESPONSE,
            });
            markDone("rev-claim");
          }
          break;

        case "rev-confirm":
          setPolling(true);
          setClaimStatus("PROCESSING");
          setTimeout(() => {
            if (epochRef.current !== epoch) return;
            setClaimStatus("COMPLETED");
            addWebhook("developer_fees.claimed", { amount: "1250.50", currency: "USDC", transaction_id: "txn_abc123" });
            setPolling(false);
            markDone("rev-confirm");
          }, 2000);
          break;

        // ─── Wallet Management flow ───
        case "wm-list": {
          if (errorMode) {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/deposit/wallets`, status: "200 OK", response: WALLET_LIST_EMPTY });
            markError("wm-list");
            markDone("wm-list");
          } else {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/deposit/wallets`, status: "200 OK", response: WALLET_LIST_RESPONSE });
            markDone("wm-list");
          }
          break;
        }

        case "wm-get": {
          if (errorMode) {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/deposit/wallets/wallet_abc123`, status: "404 Not Found", response: WALLET_NOT_FOUND });
            markError("wm-get");
            markDone("wm-get");
          } else {
            addApiCall({ method: "GET", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/deposit/wallets/wallet_abc123`, status: "200 OK", response: WALLET_SINGLE_RESPONSE });
            markDone("wm-get");
          }
          break;
        }

        case "wm-update": {
          const walletAddr = formDataRef.current.newAddress || "0xNewAddr4B52e8400e29b41d4a716446655440099";
          if (errorMode) {
            addApiCall({ method: "PATCH", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/deposit/wallets/wallet_abc123`, status: "409 Conflict", body: { address: walletAddr }, response: WALLET_ADDR_CONFLICT });
            markError("wm-update");
            markDone("wm-update");
          } else {
            addApiCall({ method: "PATCH", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/deposit/wallets/wallet_abc123`, status: "200 OK", body: { address: walletAddr }, response: WALLET_UPDATED_RESPONSE });
            markDone("wm-update");
          }
          break;
        }

        case "wm-delete": {
          if (errorMode) {
            addApiCall({ method: "DELETE", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/deposit/wallets/wallet_abc123`, status: "403 Forbidden", response: WALLET_DELETE_FORBIDDEN });
            markError("wm-delete");
            markDone("wm-delete");
          } else {
            addApiCall({ method: "DELETE", path: `/api/v2/customers/${DEMO_CUSTOMER.customerId}/deposit/wallets/wallet_abc123`, status: "200 OK", response: WALLET_DELETE_RESPONSE });
            markDone("wm-delete");
          }
          break;
        }
      }
    },
    [addApiCall, addWebhook, markDone, markError, errorMode]
  );

  const handleExecute = useCallback((formData) => {
    formDataRef.current = formData || {};
    const step = steps[currentStep];
    executeStep(step.id);
  }, [currentStep, executeStep, steps]);

  const canAdvance = executedSteps.has(steps[currentStep]?.id);
  const canGoBack = currentStep > 0;

  // Feature 8: Autoplay effect
  useEffect(() => {
    if (!autoPlaying) return;
    const step = steps[currentStep];
    if (!step) {
      setAutoPlaying(false);
      autoPlayRef.current = false;
      return;
    }
    if (executedSteps.has(step.id)) {
      if (currentStep < steps.length - 1) {
        const t = setTimeout(() => {
          if (!autoPlayRef.current) return;
          setCurrentStep(currentStep + 1);
        }, 5000);
        return () => clearTimeout(t);
      } else {
        setAutoPlaying(false);
        autoPlayRef.current = false;
        return;
      }
    }
    if (!polling) {
      const t = setTimeout(() => {
        if (!autoPlayRef.current) return;
        executeStep(step.id);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [autoPlaying, currentStep, executedSteps, polling, steps, executeStep]);

  // Keyboard shortcuts
  useEffect(() => {
    const flowKeys = Object.keys(FLOWS);
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          if (!executedSteps.has(steps[currentStep]?.id) && !polling) handleExecute();
          break;
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          if (canAdvance && currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          if (canGoBack) setCurrentStep(currentStep - 1);
          break;
        case "1": case "2": case "3": case "4": case "5": {
          const idx = parseInt(e.key) - 1;
          if (idx < flowKeys.length) { setActiveFlow(flowKeys[idx]); setAutoPlaying(false); autoPlayRef.current = false; }
          break;
        }
        case "r": case "R":
          resetFlow();
          break;
        case "p": case "P":
          if (autoPlaying) { setAutoPlaying(false); autoPlayRef.current = false; }
          else { setAutoPlaying(true); autoPlayRef.current = true; }
          break;
        case "e": case "E":
          setErrorMode((prev) => !prev);
          break;
        case "s": case "S":
          setShowSequence((prev) => !prev);
          break;
        case "?":
          setShowShortcuts((prev) => !prev);
          break;
        case "Escape":
          setShowShortcuts(false);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentStep, executedSteps, polling, steps, canAdvance, canGoBack, handleExecute, autoPlaying, resetFlow, activeFlow]);

  const renderPanel = () => {
    const step = steps[currentStep];
    const executed = executedSteps.has(step.id);
    const isError = flowErrors[activeFlow].has(step.id);
    switch (step.id) {
      case "list-customers": return <ListCustomersPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "create": return <CreateCustomerPanel onExecute={handleExecute} executed={executed} />;
      case "kyc": return <KycPanel onExecute={handleExecute} executed={executed} />;
      case "verify": return <VerifyPanel onExecute={handleExecute} executed={executed} polling={polling} isError={isError} />;
      case "wallet": return <WalletPanel onExecute={handleExecute} executed={executed} />;
      case "fees": return <FeesPanel onExecute={handleExecute} executed={executed} />;
      case "get-fees": return <GetFeesPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "deposit": return <DepositPanel onExecute={handleExecute} executed={executed} />;
      case "transactions": return <TransactionsPanel onExecute={handleExecute} executed={executed} onSelectTxn={() => { const idx = steps.findIndex((s) => s.id === "txn-detail"); if (idx !== -1) setCurrentStep(idx); }} />;
      case "kyc-submit": return <KycSubmitPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "doc-upload": return <DocUploadPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "txn-detail": return <TxnDetailPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "va-create": return <VaCreatePanel onExecute={handleExecute} executed={executed} />;
      case "va-poll": return <VaPollPanel onExecute={handleExecute} executed={executed} polling={polling} isError={isError} />;
      case "va-list": return <VaListPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "va-deposit": return <VaDepositPanel onExecute={handleExecute} executed={executed} />;
      case "wd-list-banks": return <WdListBanksPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "wd-bank": return <WdBankPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "wd-allowance": return <WdAllowancePanel onExecute={handleExecute} executed={executed} />;
      case "wd-create": return <WdCreatePanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "wd-status": return <WdStatusPanel onExecute={handleExecute} executed={executed} polling={polling} withdrawalStatus={withdrawalStatus} isError={isError} />;
      case "verify-addr": return <VerifyAddressPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "kyc-addr": return <KycAddressPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "org-balances": return <OrgBalancesPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "rev-balance": return <RevBalancePanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "rev-claim": return <RevClaimPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "rev-confirm": return <RevConfirmPanel onExecute={handleExecute} executed={executed} polling={polling} claimStatus={claimStatus} />;
      case "wm-list": return <WmListPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "wm-get": return <WmGetPanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "wm-update": return <WmUpdatePanel onExecute={handleExecute} executed={executed} isError={isError} />;
      case "wm-delete": return <WmDeletePanel onExecute={handleExecute} executed={executed} isError={isError} />;
      default: return null;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bgApp,
        color: C.textBody,
        fontFamily: T.fontSans,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .spin { animation: spin 0.8s linear infinite; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333333; border-radius: 3px; }
        button:hover { filter: brightness(1.1); }
      `}</style>

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && <KeyboardShortcutsOverlay onClose={() => setShowShortcuts(false)} />}

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-white.png" alt="Compose Finance" style={{ height: 24, width: "auto" }} />
          <span style={{ fontSize: 11, color: C.textMuted, padding: "2px 8px", background: C.bgElevated, borderRadius: 4, border: `1px solid ${C.border}`, fontFamily: T.fontMono }}>
            API Demo
          </span>
        </div>

        {/* Feature 8: Autoplay button (center) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => {
              if (autoPlaying) {
                setAutoPlaying(false);
                autoPlayRef.current = false;
              } else {
                setAutoPlaying(true);
                autoPlayRef.current = true;
              }
            }}
            style={{
              padding: "6px 14px",
              background: autoPlaying ? C.errorBg : C.accentBg,
              border: `1px solid ${autoPlaying ? C.errorBorder : C.accentBorder}`,
              borderRadius: 6,
              color: autoPlaying ? C.error : C.accent,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: T.fontSans,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {autoPlaying ? "\u25A0 Stop" : "\u25B6 Autoplay"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Feature 7: Error Mode toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: errorMode ? C.error : C.textMuted, fontFamily: T.fontMono, fontWeight: 500 }}>Error Mode</span>
            <div
              role="switch"
              aria-checked={errorMode}
              aria-label="Error mode"
              tabIndex={0}
              onClick={() => setErrorMode(!errorMode)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setErrorMode(!errorMode); } }}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                background: errorMode ? C.errorBorder : C.borderLight,
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
                border: `1px solid ${errorMode ? C.error : C.textDisabled}`,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: errorMode ? C.error : C.textMuted,
                  position: "absolute",
                  top: 2,
                  left: errorMode ? 19 : 2,
                  transition: "left 0.2s, background 0.2s",
                }}
              />
            </div>
          </div>

          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            aria-label="Keyboard shortcuts"
            style={{ width: 24, height: 24, borderRadius: "50%", background: "none", border: `1px solid ${C.borderLight}`, color: C.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.fontMono, padding: 0 }}
          >?</button>
          <div style={{ fontSize: 12, color: C.textDisabled, fontFamily: T.fontMono }}>v2.0.0</div>
        </div>
      </div>

      {/* Feature 8: Shimmer bar */}
      {autoPlaying && (
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${C.accent}, ${C.webhook}, ${C.accent}, transparent)`,
            backgroundSize: "200% 100%",
            animation: "shimmer 2s linear infinite",
          }}
        />
      )}

      {/* Flow selector */}
      <div style={{ background: C.bgSurface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", gap: 0 }}>
        {Object.entries(FLOWS).map(([flowId, flow]) => {
          const isActive = flowId === activeFlow;
          return (
            <button
              key={flowId}
              onClick={() => {
                setActiveFlow(flowId);
                setAutoPlaying(false);
                autoPlayRef.current = false;
              }}
              style={{
                padding: "10px 20px",
                background: "none",
                border: "none",
                borderBottom: isActive ? `2px solid ${C.warning}` : "2px solid transparent",
                color: isActive ? C.text : C.textDisabled,
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                fontFamily: T.fontSans,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{flow.icon}</span>
              {flow.label}
            </button>
          );
        })}
      </div>

      {/* Step navigator */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", gap: 0, overflowX: "auto", alignItems: "center" }}>
        {steps.map((step, i) => {
          const done = executedSteps.has(step.id);
          const active = i === currentStep;
          const maxDoneIdx = Math.max(...[...executedSteps].map((s) => steps.findIndex((st) => st.id === s)), 0);
          const canClick = i <= maxDoneIdx + 1;
          return (
            <button
              key={step.id}
              onClick={() => canClick && setCurrentStep(i)}
              style={{
                padding: "12px 16px",
                background: "none",
                border: "none",
                borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
                color: active ? C.text : done ? C.success : C.textDisabled,
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: canClick ? "pointer" : "default",
                fontFamily: T.fontSans,
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: canClick ? 1 : 0.4,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  background: done ? C.successBg : active ? C.accentBg : C.bgDisabled,
                  color: done ? C.success : active ? C.accent : C.textDisabled,
                  border: `1px solid ${done ? C.successBorder : active ? C.accentBorder : C.borderDisabled}`,
                }}
              >
                {done ? "\u2713" : i + 1}
              </span>
              {step.label}
            </button>
          );
        })}
        {/* Controls: Sequence toggle + Reset */}
        {executedSteps.size > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setShowSequence(!showSequence)}
              style={{
                padding: "5px 12px",
                background: showSequence ? C.accentBg : "none",
                border: `1px solid ${showSequence ? C.accentBorder : C.borderLight}`,
                borderRadius: 6,
                color: showSequence ? C.accent : C.textMuted,
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: T.fontMono,
                whiteSpace: "nowrap",
              }}
            >
              {"\u{1F4CA}"} Sequence
            </button>
            <button
              onClick={resetFlow}
              style={{
                padding: "5px 12px",
                background: "none",
                border: `1px solid ${C.borderLight}`,
                borderRadius: 6,
                color: C.textMuted,
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: T.fontMono,
                whiteSpace: "nowrap",
              }}
            >
              Reset Flow
            </button>
          </div>
        )}
      </div>

      {/* Sequence diagram */}
      {showSequence && executedSteps.size > 0 && (
        <SequenceDiagram steps={steps} executedSteps={executedSteps} currentStep={currentStep} flowErrors={flowErrors[activeFlow]} />
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Left: Customer experience */}
        <div style={{ flex: 1, padding: 24, overflow: "auto", borderRight: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 10, color: C.accent, fontFamily: T.fontMono, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Step {currentStep + 1} of {steps.length} — {steps[currentStep].endpoint}
            </div>
            {renderPanel()}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => canGoBack && setCurrentStep(currentStep - 1)}
                disabled={!canGoBack}
                style={{ padding: "8px 16px", background: "none", border: `1px solid ${C.borderLight}`, borderRadius: 6, color: canGoBack ? C.textSecondary : C.borderLight, fontSize: 13, cursor: canGoBack ? "pointer" : "default", fontFamily: T.fontSans }}
              >
                {"\u2190"} Back
              </button>
              <button
                onClick={() => canAdvance && currentStep < steps.length - 1 && setCurrentStep(currentStep + 1)}
                disabled={!canAdvance || currentStep === steps.length - 1}
                style={{
                  padding: "8px 16px",
                  background: canAdvance && currentStep < steps.length - 1 ? C.ctaBg : "none",
                  border: `1px solid ${canAdvance && currentStep < steps.length - 1 ? C.ctaBorder : C.borderLight}`,
                  borderRadius: 6,
                  color: canAdvance && currentStep < steps.length - 1 ? C.ctaText : C.borderLight,
                  fontSize: 13,
                  cursor: canAdvance && currentStep < steps.length - 1 ? "pointer" : "default",
                  fontFamily: T.fontSans,
                  fontWeight: 600,
                }}
              >
                Next Step {"\u2192"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: API calls & webhooks */}
        <div style={{ width: 480, minWidth: 400, display: "flex", flexDirection: "column", background: C.bgSurface }}>
          <ApiPanel
            calls={apiCalls}
            webhooks={webhooks}
            onClear={() => {
              setApiCalls([]);
              setWebhooks([]);
            }}
          />
        </div>
      </div>
    </div>
  );
}
