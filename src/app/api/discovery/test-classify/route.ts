export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-server";
import { classifyTransactionsWithAI } from "../../../../lib/openai/classify-transactions";

/**
 * Test endpoint: re-runs AI classification on ALL existing plaid_transactions
 * and returns a full report. No data is modified — read-only.
 *
 * GET /api/discovery/test-classify
 */
export async function GET() {
  try {
    // Fetch all stored transactions
    const { data: transactions, error } = await supabaseAdmin
      .from("plaid_transactions")
      .select("transaction_id, name, merchant_name, amount, date, category, app_user_id")
      .order("date", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ ok: true, message: "No transactions found", report: [] });
    }

    // Group by merchant (same logic as buildProviderRegistry)
    const grouped = new Map<string, {
      name: string;
      normalized_name: string;
      plaid_categories: string[];
      visit_count: number;
      amounts: number[];
      sample_tx_names: string[];
      app_user_ids: Set<string>;
    }>();

    for (const tx of transactions) {
      const raw = (tx.merchant_name || tx.name || "").trim();
      if (!raw) continue;

      const normalized = raw
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, " ")
        .replace(/\b(ACH|POS|PURCHASE|DEBIT|CHECKCARD|CHECK CARD|CARD|ONLINE|PMT|PAYMENT)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!normalized) continue;

      const cats = Array.isArray(tx.category) ? tx.category : [];
      const existing = grouped.get(normalized);

      if (existing) {
        existing.visit_count++;
        existing.amounts.push(Math.abs(Number(tx.amount || 0)));
        existing.plaid_categories.push(...cats);
        if (existing.sample_tx_names.length < 3) existing.sample_tx_names.push(tx.name || "");
        existing.app_user_ids.add(tx.app_user_id);
      } else {
        grouped.set(normalized, {
          name: raw,
          normalized_name: normalized,
          plaid_categories: [...cats],
          visit_count: 1,
          amounts: [Math.abs(Number(tx.amount || 0))],
          sample_tx_names: [tx.name || ""],
          app_user_ids: new Set([tx.app_user_id]),
        });
      }
    }

    // Prepare for AI
    const merchantInputs = Array.from(grouped.values()).map((entry) => ({
      name: entry.name,
      normalized_name: entry.normalized_name,
      plaid_categories: [...new Set(entry.plaid_categories)],
      visit_count: entry.visit_count,
      avg_amount: entry.amounts.reduce((s, v) => s + v, 0) / entry.amounts.length,
    }));

    // Classify (may need batching if > 100 merchants)
    const BATCH_SIZE = 80;
    const allClassifications = new Map<string, any>();

    for (let i = 0; i < merchantInputs.length; i += BATCH_SIZE) {
      const batch = merchantInputs.slice(i, i + BATCH_SIZE);
      const results = await classifyTransactionsWithAI(batch);
      for (const [key, value] of results) {
        allClassifications.set(key, value);
      }
    }

    // Build report
    const report = merchantInputs.map((m) => {
      const classification = allClassifications.get(m.normalized_name);
      const entry = grouped.get(m.normalized_name)!;
      return {
        merchant_name: m.name,
        normalized_name: m.normalized_name,
        plaid_categories: [...new Set(entry.plaid_categories)].slice(0, 5),
        visit_count: m.visit_count,
        avg_amount: Math.round(m.avg_amount * 100) / 100,
        user_count: entry.app_user_ids.size,
        sample_tx_names: entry.sample_tx_names,
        ai_is_healthcare: classification?.is_healthcare ?? null,
        ai_confidence: classification?.confidence ?? null,
        ai_provider_type: classification?.provider_type ?? null,
        ai_reasoning: classification?.reasoning ?? null,
      };
    });

    // Sort: healthcare first, then by confidence
    report.sort((a, b) => {
      if (a.ai_is_healthcare !== b.ai_is_healthcare) return a.ai_is_healthcare ? -1 : 1;
      return (b.visit_count || 0) - (a.visit_count || 0);
    });

    const summary = {
      total_transactions: transactions.length,
      unique_merchants: merchantInputs.length,
      classified_healthcare: report.filter((r) => r.ai_is_healthcare === true).length,
      classified_not_healthcare: report.filter((r) => r.ai_is_healthcare === false).length,
      unclassified: report.filter((r) => r.ai_is_healthcare === null).length,
      high_confidence_healthcare: report.filter((r) => r.ai_is_healthcare && r.ai_confidence === "high").length,
      review_needed: report.filter((r) => r.ai_is_healthcare && r.ai_confidence !== "high").length,
    };

    return NextResponse.json({ ok: true, summary, report });
  } catch (err: any) {
    console.error("[test-classify] error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Classification failed" },
      { status: 500 }
    );
  }
}
