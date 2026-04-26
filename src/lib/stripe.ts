import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export const PRICES = {
  solo: process.env.STRIPE_PRICE_SOLO!,
  family: process.env.STRIPE_PRICE_FAMILY!,
} as const;

export type PlanType = keyof typeof PRICES;
