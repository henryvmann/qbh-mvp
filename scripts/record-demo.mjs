// Playwright demo recorder. Walks through the new lightweight
// onboarding (intro -> quick-doctor -> account-create) and lands on
// the dashboard, recording the whole thing as a .webm file.
//
// Usage:
//   1. Start the dev server in another terminal:  npm run dev
//   2. From repo root:                            node scripts/record-demo.mjs
//
// Output: demo-recordings/demo-<timestamp>.webm
//
// Notes:
// - Recording uses Playwright's built-in video capture, no extra deps.
// - Creates a unique demo account each run (demo+<timestamp>@example.com).
//   Sweep those later with a script if you don't want them piling up.
// - To skip account creation (no DB writes), set STOP_AT_FORM=1.

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.QBH_DEMO_URL || "http://localhost:3000";
const STOP_AT_FORM = process.env.STOP_AT_FORM === "1";
const VIDEO_DIR = join(process.cwd(), "demo-recordings");
mkdirSync(VIDEO_DIR, { recursive: true });

// Realistic-feeling pace. Increase for more relaxed feel; decrease for snappier.
const TYPE_DELAY = 70; // ms per keystroke
const PAUSE_SHORT = 700;
const PAUSE_MED = 1500;
const PAUSE_LONG = 2500;

const stamp = Date.now();
const email = `demo+${stamp}@example.com`;
const password = "Demo!Pass123";
const firstName = "Demo";
const lastName = "User";
const dob = "1988-05-20"; // 18+, plausible
const zip = "06880";
const doctorQuery = "Eric Echelman";

console.log(`\n[demo] recording to ${VIDEO_DIR}`);
console.log(`[demo] email: ${email}\n`);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1280, height: 820 },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 820 } },
  deviceScaleFactor: 2, // crisp text on retina
});
const page = await context.newPage();

async function pause(ms) { await page.waitForTimeout(ms); }

try {
  // ---- 1. Land on onboarding ----
  await page.goto(`${BASE_URL}/onboarding`, { waitUntil: "domcontentloaded" });
  await pause(PAUSE_MED);

  // Kate's intro streams over ~5 seconds. Wait for the "Get started" button.
  await page.getByRole("button", { name: /Get started/i }).waitFor({ timeout: 15000 });
  await pause(PAUSE_SHORT);
  await page.getByRole("button", { name: /Get started/i }).click();

  // ---- 2. Quick-doctor ----
  const searchInput = page.getByPlaceholder(/Dr\. Smith, dentist/i);
  await searchInput.waitFor({ timeout: 10000 });
  await pause(PAUSE_MED);
  await searchInput.click();
  await searchInput.type(doctorQuery, { delay: TYPE_DELAY });

  // Wait for results to populate, then click the first Add button.
  await page.getByRole("button", { name: /^Add$/ }).first().waitFor({ timeout: 15000 });
  await pause(PAUSE_SHORT);
  await page.getByRole("button", { name: /^Add$/ }).first().click();
  await pause(PAUSE_SHORT);

  // Continue / Skip — should now read "Continue" since one provider was added.
  await page.getByRole("button", { name: /Continue|Skip/i }).click();
  await pause(PAUSE_MED);

  // ---- 3. Account create ----
  await page.locator("input").first().waitFor({ timeout: 10000 });
  // First name (first input), Last (second), Email (3rd), etc.
  // Use accessible names where Playwright can find them.
  await page.getByRole("textbox").nth(0).type(firstName, { delay: TYPE_DELAY });
  await page.getByRole("textbox").nth(1).type(lastName, { delay: TYPE_DELAY });
  await page.locator('input[type="email"]').type(email, { delay: TYPE_DELAY });
  await page.locator('input[type="password"]').type(password, { delay: TYPE_DELAY });
  await page.locator('input[type="date"]').fill(dob);
  // Zip is the last text input on the form.
  const zipInputs = page.locator('input[type="text"]');
  await zipInputs.last().fill(zip);
  await pause(PAUSE_SHORT);
  // ToS checkbox.
  await page.locator('input[type="checkbox"]').check();
  await pause(PAUSE_SHORT);

  if (STOP_AT_FORM) {
    console.log("[demo] STOP_AT_FORM=1 — stopping before submit. No account created.");
    await pause(PAUSE_LONG);
  } else {
    await page.getByRole("button", { name: /Create my account/i }).click();
    // Wait for the dashboard. router.push happens ~900ms after signup.
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await pause(PAUSE_LONG);
    // Scroll the page so the "Let me find the rest" tile catches the eye.
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: "smooth" }));
    await pause(PAUSE_LONG);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(PAUSE_MED);
  }
} catch (err) {
  console.error("[demo] script failed:", err.message);
} finally {
  // Closing the context flushes the video to disk.
  await context.close();
  await browser.close();
  console.log(`\n[demo] done. Video saved in ${VIDEO_DIR}`);
  console.log(`[demo] open with: open ${VIDEO_DIR}`);
}
