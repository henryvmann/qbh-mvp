// Adds VAPI's built-in DTMF tool to the QBH assistant so Kate can
// press digits during phone-tree IVRs. Without this, she can only
// say "pressing 2" verbally — which the IVR can't hear, so it just
// loops the menu until call timeout.
//
// VAPI's predefined "dtmf" tool plays the requested digits in-call
// as real DTMF tones. The LLM calls it like any function:
//   dtmf({ digits: "2" })

import { config } from "dotenv";
config({ path: "/Users/jennifermann/qbh-mvp/.env.local" });

const apiKey = process.env.VAPI_API_KEY;
const assistantId =
  process.env.USE_TEST_ASSISTANT === "true"
    ? process.env.VAPI_ASSISTANT_ID_TEST
    : process.env.VAPI_ASSISTANT_ID;

if (!apiKey || !assistantId) {
  console.error("Missing VAPI_API_KEY or VAPI_ASSISTANT_ID");
  process.exit(1);
}

const getRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});
if (!getRes.ok) {
  console.error("fetch failed:", getRes.status, await getRes.text());
  process.exit(1);
}
const assistant = await getRes.json();
const currentTools = assistant.model?.tools || [];
const hasDtmf = currentTools.some((t) => t?.type === "dtmf");

console.log(`assistant: ${assistant.name}`);
console.log(`current tools: ${currentTools.length} (DTMF present: ${hasDtmf})`);

if (hasDtmf) {
  console.log("DTMF already configured — nothing to do");
  process.exit(0);
}

const newTools = [...currentTools, { type: "dtmf" }];
const patchBody = {
  model: {
    ...(assistant.model || {}),
    tools: newTools,
  },
};

const patchRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(patchBody),
});

if (!patchRes.ok) {
  console.error("PATCH failed:", patchRes.status, await patchRes.text());
  console.error("");
  console.error("Fallback: enable DTMF manually in the VAPI dashboard:");
  console.error("  Assistant → Tools/Functions → enable 'DTMF' / 'Send DTMF'");
  process.exit(1);
}

const updated = await patchRes.json();
const tools = updated.model?.tools || [];
console.log(`✓ DTMF added. Tools now: ${tools.length}`);
console.log(tools.map((t) => `  - ${t.type || "(?)"}${t.function?.name ? `: ${t.function.name}` : ""}`).join("\n"));
