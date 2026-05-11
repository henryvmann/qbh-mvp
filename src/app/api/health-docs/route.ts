export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionAppUserId } from "../../../lib/auth/get-session-app-user-id";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { storeHealthDocument } from "../../../lib/aws/s3";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Per-chunk text cap (approx tokens) when calling the summarizer model.
// For very long extracted documents we summarize each chunk and stitch
// the partial summaries into a final pass.
const CHUNK_CHAR_LIMIT = 24000;

function chunkText(text: string, limit = CHUNK_CHAR_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + limit, text.length);
    if (end < text.length) {
      const lastBreak = text.lastIndexOf("\n", end);
      if (lastBreak > i + limit * 0.5) end = lastBreak;
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}

function buildSummaryPrompt(providerName: string | null) {
  const providerContext = providerName ? `This document is from ${providerName}. ` : "";
  return `You are a medical document summarizer for Quarterback Health. ${providerContext}The user has uploaded a health document. Extract and organize the key information into a structured summary. Include:
- Conditions/diagnoses mentioned
- Medications listed
- Procedures or surgeries
- Lab results or test findings
- Provider names mentioned
- Dates of care
- Follow-up recommendations

Be factual and concise. Do NOT add medical advice. Just summarize what the document contains.

Return a clear, bullet-pointed summary that the user can review.`;
}

async function summarizeText(documentText: string, providerName: string | null): Promise<string> {
  const trimmed = documentText.trim();
  if (!trimmed) return "Could not extract any readable text from this document.";

  const system = buildSummaryPrompt(providerName);
  const chunks = chunkText(trimmed);

  if (chunks.length === 1) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 1000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Please summarize this health document:\n\n${chunks[0]}` },
      ],
    });
    return response.choices[0]?.message?.content?.trim() || "Could not summarize this document.";
  }

  // Multi-pass: summarize each chunk, then stitch.
  const partials = await Promise.all(
    chunks.map(async (chunk, idx) => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `This is part ${idx + 1} of ${chunks.length} of a longer health document. Summarize just this section:\n\n${chunk}`,
          },
        ],
      });
      return response.choices[0]?.message?.content?.trim() || "";
    })
  );

  const stitched = partials.filter(Boolean).join("\n\n");
  const finalResp = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    max_tokens: 1200,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Below are partial summaries of one health document, split into sections because it was long. Merge them into one clean, de-duplicated summary covering everything from all sections:\n\n${stitched}`,
      },
    ],
  });
  return finalResp.choices[0]?.message?.content?.trim() || stitched;
}

type PdfParseFn = (data: Buffer) => Promise<{ text: string }>;

async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse ships a debug harness at the top of its index that runs
  // when NODE_ENV is "test" and bombs in serverless. Importing the
  // implementation file directly skips that harness.
  const mod = (await import("pdf-parse/lib/pdf-parse.js" as string)) as unknown as { default?: PdfParseFn } & PdfParseFn;
  const pdfParse: PdfParseFn = mod.default ?? (mod as unknown as PdfParseFn);
  const result = await pdfParse(buffer);
  return result.text || "";
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function summarizeImage(buffer: Buffer, fileName: string, providerName: string | null): Promise<string> {
  const base64 = buffer.toString("base64");
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mimeType =
    ext === "png" ? "image/png" :
    ext === "gif" ? "image/gif" :
    ext === "webp" ? "image/webp" :
    "image/jpeg";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This is a health document${providerName ? ` from ${providerName}` : ""}. Extract and summarize all medical information: conditions, medications, procedures, lab results, dates, and follow-up recommendations. Be factual and concise. Do NOT add medical advice.`,
          },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
  });
  return response.choices[0]?.message?.content?.trim() || "Could not read this image.";
}

async function appendToHistory(appUserId: string, summary: string, providerName: string | null) {
  const { data: userData } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  const profile = (userData?.patient_profile || {}) as Record<string, unknown>;
  const existingHistory = (profile.health_history as string) || "";
  const providerTag = providerName ? ` — ${providerName}` : "";
  const header = `--- Document Summary (${new Date().toLocaleDateString()}${providerTag}) ---`;
  const updatedHistory = existingHistory
    ? `${existingHistory}\n\n${header}\n${summary}`
    : `${header}\n${summary}`;

  await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: { ...profile, health_history: updatedHistory } })
    .eq("id", appUserId);
}

/** Upload a health document (text or file), summarize with AI, persist to profile */
export async function POST(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const textContent = formData.get("text") as string | null;
    const providerName = formData.get("provider_name") as string | null;

    let documentText = textContent || "";
    let s3Key: string | undefined;
    let summaryOverride: string | null = null;

    if (file) {
      const buffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(buffer);
      const fileName = file.name.toLowerCase();

      try {
        s3Key = await storeHealthDocument(appUserId, fileBuffer, file.name, file.type || "application/octet-stream");
      } catch (s3Err) {
        console.error("[health-docs] S3 upload failed (continuing with summarization):", s3Err);
      }

      if (fileName.endsWith(".pdf")) {
        try {
          documentText = await extractPdfText(fileBuffer);
        } catch (e) {
          console.error("[health-docs] PDF extraction failed:", e);
          return NextResponse.json({
            ok: false,
            error: "Could not read this PDF. If it's a scanned document, try uploading a photo of each page instead.",
          }, { status: 422 });
        }
        if (!documentText.trim()) {
          return NextResponse.json({
            ok: false,
            error: "This PDF doesn't seem to contain readable text — it may be a scan. Upload a photo of each page (.png/.jpg) and Kate can read those.",
          }, { status: 422 });
        }
      } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
        try {
          documentText = await extractDocxText(fileBuffer);
        } catch (e) {
          console.error("[health-docs] DOCX extraction failed:", e);
          return NextResponse.json({
            ok: false,
            error: "Could not read this Word document. Try saving it as a PDF and uploading that.",
          }, { status: 422 });
        }
      } else if (fileName.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
        summaryOverride = await summarizeImage(fileBuffer, fileName, providerName);
      } else {
        documentText = new TextDecoder().decode(buffer);
      }
    }

    const summary = summaryOverride ?? (await summarizeText(documentText, providerName));
    if (!summary || !summary.trim()) {
      return NextResponse.json({ ok: false, error: "No content provided" }, { status: 400 });
    }
    await appendToHistory(appUserId, summary, providerName);
    return NextResponse.json({ ok: true, summary, s3Key });
  } catch (err) {
    console.error("[health-docs] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to process document" }, { status: 500 });
  }
}

/**
 * Remove a previously-summarized document from the user's health_history.
 * Body: { index: number } — 0-based index into the rendered "Documents on
 * file" list (same order they appear after parsing). Lets users clean up
 * stale or busted entries (e.g., PDFs summarized before the new ingest
 * pipeline landed).
 */
export async function DELETE(req: NextRequest) {
  const appUserId = await getSessionAppUserId(req);
  if (!appUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let body: { index?: number } = {};
  try { body = await req.json(); } catch {}
  const idx = typeof body.index === "number" ? body.index : -1;
  if (idx < 0) {
    return NextResponse.json({ ok: false, error: "Invalid index" }, { status: 400 });
  }

  const { data: userData } = await supabaseAdmin
    .from("app_users")
    .select("patient_profile")
    .eq("id", appUserId)
    .single();

  const profile = (userData?.patient_profile || {}) as Record<string, unknown>;
  const existing = (profile.health_history as string) || "";
  if (!existing) {
    return NextResponse.json({ ok: true });
  }

  // Split on the document-summary header, preserving any free-text prefix
  // as parts[0]. Each subsequent element is one summary block.
  const HEADER = /---\s*Document Summary[^\n]*\n?/g;
  const headers = existing.match(HEADER) || [];
  const segments = existing.split(HEADER);
  if (idx >= headers.length) {
    return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  }
  headers.splice(idx, 1);
  segments.splice(idx + 1, 1);
  let rebuilt = segments[0] || "";
  for (let i = 0; i < headers.length; i++) {
    if (rebuilt && !rebuilt.endsWith("\n")) rebuilt += "\n";
    rebuilt += headers[i];
    rebuilt += segments[i + 1] || "";
  }
  rebuilt = rebuilt.replace(/\n{3,}/g, "\n\n").trim();

  await supabaseAdmin
    .from("app_users")
    .update({ patient_profile: { ...profile, health_history: rebuilt } })
    .eq("id", appUserId);

  return NextResponse.json({ ok: true });
}
