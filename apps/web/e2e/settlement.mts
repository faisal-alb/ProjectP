// End-to-end: fund, verify and settle a request from the Grid operator view,
// then see the payout on the Household view. Needs the validator, the API
// and the web app running (see docs/05_SOLANA_PROGRAM.md).
//
// A real wallet can't be driven headlessly, so this registers a Wallet
// Standard wallet in the page. Signing happens in Node with a fresh key; the
// dashboard goes through exactly the same discovery → connect → sign path it
// uses with Phantom or Solflare.
//
//   npm run e2e -w web
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getAddressDecoder } from "@solana/kit";
import { chromium, type Page } from "playwright";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const OUT = path.resolve(import.meta.dirname, "../test-results");
mkdirSync(OUT, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyBytes = new Uint8Array(publicKey.export({ format: "der", type: "spki" }).subarray(-32));
const walletAddress = getAddressDecoder().decode(publicKeyBytes);

function installTestWallet({ address, publicKey }: { address: string; publicKey: number[] }) {
  const chains = ["solana:localnet", "solana:devnet"] as const;
  const account = {
    address,
    publicKey: new Uint8Array(publicKey),
    chains,
    features: ["solana:signTransaction"],
    label: "Test operator",
  };
  const listeners = new Set<(props: unknown) => void>();
  const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
  const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const wallet = {
    version: "1.0.0",
    name: "Test Wallet",
    icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAxIDEnLz4=",
    chains,
    accounts: [] as (typeof account)[],
    features: {
      "standard:connect": {
        version: "1.0.0",
        connect: async () => {
          wallet.accounts = [account];
          listeners.forEach((l) => l({ accounts: wallet.accounts }));
          return { accounts: wallet.accounts };
        },
      },
      "standard:disconnect": {
        version: "1.0.0",
        disconnect: async () => {
          wallet.accounts = [];
          listeners.forEach((l) => l({ accounts: [] }));
        },
      },
      "standard:events": {
        version: "1.0.0",
        on: (_event: string, listener: (props: unknown) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      "solana:signTransaction": {
        version: "1.0.0",
        supportedTransactionVersions: ["legacy", 0],
        signTransaction: async (...inputs: { transaction: Uint8Array }[]) =>
          Promise.all(
            inputs.map(async ({ transaction }) => {
              // Wire format: [sig count][64-byte sigs][message]. We are the
              // fee payer, so ours is signature slot 0.
              const count = transaction[0];
              const message = transaction.subarray(1 + 64 * count);
              const signature = fromB64(
                await (window as unknown as { __testWalletSign: (m: string) => Promise<string> }).__testWalletSign(
                  toB64(message),
                ),
              );
              const signed = new Uint8Array(transaction);
              signed.set(signature, 1);
              return { signedTransaction: signed };
            }),
          ),
      },
    },
  };
  const register = ({ register }: { register: (w: unknown) => void }) => register(wallet);
  window.addEventListener("wallet-standard:app-ready", (e) => register((e as CustomEvent).detail));
  window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
}

async function expectText(page: Page, text: string | RegExp, timeout = 60_000) {
  await page.getByText(text).first().waitFor({ timeout });
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.exposeFunction("__testWalletSign", (messageB64: string) =>
    sign(null, Buffer.from(messageB64, "base64"), privateKey).toString("base64"),
  );
  // tsx (esbuild) wraps named functions in a `__name` helper that doesn't
  // exist in the page when Playwright serializes the init script.
  await context.addInitScript({ content: "globalThis.__name = (fn) => fn;" });
  await context.addInitScript(installTestWallet, { address: walletAddress, publicKey: [...publicKeyBytes] });
  const errors: string[] = [];

  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));

  // Signed out, the dashboard sends you to choose how you'll use GridFlex.
  await page.goto(`${WEB}/dashboard`);
  await page.waitForURL(/\/onboarding$/);
  await page.getByRole("link", { name: /Manage a grid/ }).click();
  await page.waitForURL(/\/onboarding\/operator$/);

  // Operator onboarding: organization, network, rules.
  await expectText(page, "Tell us about your energy network");
  await page.getByLabel("Organization name").fill("Acme Power");
  await page.getByRole("button", { name: "Continue" }).click();
  await expectText(page, "Set up your grid topology");
  await expectText(page, "Downtown");
  await page.getByRole("button", { name: "Continue with demo data" }).click();
  await expectText(page, "How should GridFlex procure flexibility?");
  await page.getByRole("button", { name: "Finish configuration" }).click();
  await expectText(page, "Acme Power’s network is ready");
  await page.getByRole("link", { name: "Open control center" }).click();
  await page.waitForURL(/\/dashboard$/);
  await expectText(page, "Miami grid");
  await page.getByText("Acme Power").first().waitFor();
  if ((await page.getByRole("navigation", { name: "Dashboard view" }).count()) > 0) {
    throw new Error("the participant/operator switch should not be in the header");
  }
  console.log("operator onboarded: organization name reaches the header");

  // Wait for the live state to load. A previous run may have left a request
  // part-way through: finish it, then start a fresh one.
  const reset = page.getByRole("button", { name: "Start a new request" });
  const connect = page.getByRole("button", { name: /Test Wallet/ });
  const record = page.getByRole("button", { name: "Record meter readings" });
  const pay = page.getByRole("button", { name: "Pay participants" });
  for (let i = 0; i < 4; i++) {
    await reset.or(connect).or(record).or(pay).first().waitFor({ timeout: 90_000 });
    if (await connect.isVisible()) break;
    if (await reset.isVisible()) await reset.click();
    else if (await record.isVisible()) await record.click();
    else if (await pay.isVisible()) await pay.click();
    await page.waitForTimeout(500);
  }

  // Funding lives in the escrow card at the top of the Downtown panel.
  await connect.click();
  // Balances come from the chain; public devnet can be slow under rate limits.
  await page.getByRole("button", { name: "Get test USDC" }).click({ timeout: 90_000 });
  const fund = page.getByRole("button", { name: /Fund request · \$160\.00/ });
  await fund.waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: "Wallet" }).getByText("$500.00").waitFor({ timeout: 90_000 });
  console.log(`wallet ${walletAddress} connected; header shows $500.00 test USDC`);

  await fund.click();
  await page.getByRole("button", { name: "Record meter readings" }).waitFor({ timeout: 90_000 });
  await expectText(page, "locked");
  console.log("request funded: $160.00 locked, 24 commitments recorded");
  await page.screenshot({ path: `${OUT}/operator-committed.png` });

  await page.getByRole("button", { name: "Record meter readings" }).click();
  await page.getByRole("button", { name: "Pay participants" }).click({ timeout: 90_000 });
  await expectText(page, "$66.40 refunded to you", 90_000);
  await expectText(page, "$93.60");
  const txLinks = await page.getByRole("link", { name: "View transaction" }).count();
  if (txLinks !== 4) throw new Error(`expected 4 step transaction links, found ${txLinks}`);
  // $500 − $160 escrow + $66.40 refund, updated live in the header.
  await page.getByRole("button", { name: "Wallet" }).getByText("$406.40").waitFor({ timeout: 90_000 });
  console.log("settled: $93.60 paid, $66.40 refunded, 4 step links");
  await page.screenshot({ path: `${OUT}/operator-settled.png` });

  // Changing role means switching accounts, then onboarding as a participant.
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Switch account" }).click();
  await page.waitForURL(/\/onboarding$/);
  await page.getByRole("link", { name: /Provide flexibility/ }).click();
  await page.waitForURL(/\/onboarding\/participant$/);

  await expectText(page, "What energy resources do you have?");
  // An unsupported ZIP blocks the step; the demo ZIP resolves the grid zone.
  await page.getByLabel("ZIP code").fill("10001");
  await expectText(page, "GridFlex isn't available at this ZIP yet");
  if (await page.getByRole("button", { name: "Continue" }).isEnabled()) {
    throw new Error("Continue should be disabled for an unsupported ZIP");
  }
  await page.getByLabel("ZIP code").fill("33132");
  await expectText(page, "Eligible for local GridFlex events");
  await page.getByRole("button", { name: "EV / EV charger" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expectText(page, "When can GridFlex use your flexibility?");
  await page.getByLabel("Always keep at least").first().evaluate((el: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, "50");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expectText(page, "Vehicle ready by");
  await page.getByRole("button", { name: "Continue" }).click();

  await expectText(page, "How do you want to get paid?");
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expectText(page, "You’re ready");
  await expectText(page, "EV charging");
  await page.getByRole("link", { name: "Go to My Energy" }).click();
  await page.waitForURL(/\/dashboard$/);
  // The limit set in onboarding is what the dashboard starts from.
  await expectText(page, "Always keep at least");
  await page.getByText("50%").first().waitFor();
  await expectText(page, "You earned $0.70 tonight");
  await page.getByRole("link", { name: "View payment" }).waitFor();
  await page.getByRole("button", { name: "Your wallet" }).click();
  await expectText(page, "Your GridFlex wallet");
  console.log("participant onboarded: 50% reserve carried over, $0.70 payout, header wallet open");
  await page.screenshot({ path: `${OUT}/household-paid.png` });

  if (errors.length) throw new Error(`page errors:\n${errors.join("\n")}`);
  console.log(`✔ e2e settlement OK (screenshots in ${path.relative(process.cwd(), OUT)})`);
} finally {
  await browser.close();
}
