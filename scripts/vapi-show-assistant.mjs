// Pull the current VAPI assistant config and surface the bits that
// matter for how human Kate sounds (voice provider, voice ID, model,
// transcriber, response delays). Read-only.
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

const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});

if (!res.ok) {
  console.error("VAPI fetch failed:", res.status, await res.text());
  process.exit(1);
}

const data = await res.json();

console.log(`assistant: ${data.id}`);
console.log(`name: ${data.name}`);
console.log(`updated: ${data.updatedAt}`);
console.log("");
console.log("VOICE:", JSON.stringify(data.voice, null, 2));
console.log("");
console.log("MODEL:", JSON.stringify({ ...data.model, messages: undefined, tools: undefined }, null, 2));
console.log("  messages: <omitted — long>");
console.log(`  tools: ${(data.model?.tools || []).length} configured`);
console.log("");
console.log("TRANSCRIBER:", JSON.stringify(data.transcriber, null, 2));
console.log("");
console.log("BACKGROUND SOUND:", data.backgroundSound || "(none)");
console.log("BACKGROUND DENOISING:", data.backgroundDenoisingEnabled);
console.log("RESPONSE DELAY (sec):", data.responseDelaySeconds);
console.log("LLM REQUEST DELAY (sec):", data.llmRequestDelaySeconds);
console.log("NUM WORDS TO INTERRUPT:", data.numWordsToInterruptAssistant);
console.log("MAX DURATION (sec):", data.maxDurationSeconds);
console.log("END CALL FUNCTION ENABLED:", data.endCallFunctionEnabled);
console.log("FILLER INJECTION ENABLED:", data.fillerInjectionEnabled);
