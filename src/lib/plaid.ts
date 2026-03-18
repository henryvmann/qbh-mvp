// src/lib/plaid.ts

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// --- ENV VALIDATION (fail fast) ---
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || "sandbox";

if (!PLAID_CLIENT_ID) {
  throw new Error("Missing PLAID_CLIENT_ID");
}

if (!PLAID_SECRET) {
  throw new Error("Missing PLAID_SECRET");
}

// --- ENV MAPPING ---
const environment =
  PLAID_ENV === "production"
    ? PlaidEnvironments.production
    : PLAID_ENV === "development"
    ? PlaidEnvironments.development
    : PlaidEnvironments.sandbox;

// --- PLAID CLIENT ---
const config = new Configuration({
  basePath: environment,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
      "PLAID-SECRET": PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(config);