import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const out = path.resolve("apps/web/test-results");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await desktop.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000/onboarding/operator");
  await page.getByLabel("Organization name").fill("Austin Energy Operations");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  console.log(
    "topology buttons",
    await page.getByRole("button").allTextContents(),
  );
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: "Finish configuration" }).click();
  await page.getByRole("link", { name: "Open control center" }).click();
  await page
    .getByRole("heading", { name: "Austin grid", exact: true })
    .waitFor();
  await page.getByText("Synchronized", { exact: false }).first().waitFor();
  if (
    await page
      .getByRole("complementary", { name: "Simulation controls" })
      .count()
  )
    throw Error("Controls visible by default");
  if (/\bdemo\b/i.test(await page.locator("body").innerText()))
    throw Error("Public presentation wording remains");
  await page.screenshot({
    path: path.join(out, "run-desktop.png"),
    fullPage: true,
  });
  await page.keyboard.press("Control+Shift+S");
  await page
    .getByLabel("Presenter access code")
    .fill(readFileSync(".data/presenter-code", "utf8").trim());
  await page.getByRole("button", { name: "Unlock controls" }).click();
  await page
    .getByRole("button", { name: "Inject scenario", exact: true })
    .waitFor();
  await page.screenshot({
    path: path.join(out, "run-controls.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: await desktop.storageState(),
  });
  const phone = await mobile.newPage();
  await phone.goto("http://localhost:3000/dashboard");
  await phone
    .getByRole("heading", { name: "Austin grid", exact: true })
    .waitFor();
  await phone.screenshot({
    path: path.join(out, "run-mobile.png"),
    fullPage: true,
  });
  if (
    await phone.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw Error("Mobile overflow");
  if (process.env.CHECK_VOICE_TEXT === "1") {
    await page
      .getByLabel("Question for GridFlex")
      .fill("What is the current local demand in kilowatts? Use the tools.");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const response = page
      .locator("#grid-assistant li")
      .filter({ hasText: /GridFlex:.*\d[\d.,]*\s*(kW|kilowatt)/i })
      .last();
    await response.waitFor({ timeout: 60_000 });
    console.log("Assistant response:", await response.innerText());
    await page.getByRole("button", { name: "End conversation" }).click();
    console.log("ElevenLabs text conversation returned a grounded response.");
  }
  await page.reload();
  await page
    .getByRole("heading", { name: "Austin grid", exact: true })
    .waitFor();
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Desktop/mobile render, hidden controls, presenter unlock, reconnect, and wording checks passed.",
  );
} finally {
  await browser.close();
}
