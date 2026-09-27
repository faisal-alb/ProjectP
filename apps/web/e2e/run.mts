import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const out = path.resolve("apps/web/test-results");
mkdirSync(out, { recursive: true });
const base = process.env.WEB_E2E_URL ?? "http://localhost:3000";
const mockedVoice = process.env.MOCK_VOICE === "1";
const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
    // The API allows the primary local origin; an isolated build uses another port.
    ...(process.env.WEB_E2E_URL ? ["--disable-web-security"] : []),
  ],
});
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    permissions: ["microphone"],
  });
  await desktop.addInitScript(() => {
    const state = window as typeof window & { voiceTracks: MediaStreamTrack[] };
    state.voiceTracks = [];
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      state.voiceTracks.push(...stream.getTracks());
      return stream;
    };
  });
  const page = await desktop.newPage();
  if (mockedVoice) {
    await page.routeWebSocket(/gridflex\.test/, (socket) => {
      const send = (event: unknown) => socket.send(JSON.stringify(event));
      socket.onMessage((raw) => {
        const message = JSON.parse(String(raw));
        if (message.type === "conversation_initiation_client_data") {
          send({
            type: "conversation_initiation_metadata",
            conversation_initiation_metadata_event: {
              conversation_id: "browser-regression",
              agent_output_audio_format: "pcm_16000",
              user_input_audio_format: "pcm_16000",
            },
          });
          if (!message.conversation_config_override?.conversation?.text_only)
            setTimeout(() => {
              const audio = Buffer.alloc(64000);
              for (let i = 0; i < 32000; i++)
                audio.writeInt16LE(
                  Math.round(Math.sin((i * Math.PI * 440) / 16000) * 4096),
                  i * 2,
                );
              send({
                type: "agent_response",
                agent_response_event: {
                  agent_response: "Voice connection ready.",
                  event_id: 1,
                },
              });
              send({
                type: "audio",
                audio_event: {
                  audio_base_64: audio.toString("base64"),
                  event_id: 1,
                },
              });
            }, 500);
        }
        if (message.type === "user_message")
          send({
            type: "client_tool_call",
            client_tool_call: {
              tool_name: "get_grid_status",
              tool_call_id: "current-run",
              parameters: {},
            },
          });
        if (message.type === "client_tool_result") {
          if (message.is_error) throw Error(message.result);
          const snapshot = JSON.parse(message.result);
          if (!snapshot.runId || snapshot.conditions?.loadKw === undefined)
            throw Error("Tool returned no authoritative run snapshot");
          send({
            type: "agent_response",
            agent_response_event: {
              agent_response: `Current modeled demand is ${snapshot.conditions.loadKw} kW.`,
              event_id: 2,
            },
          });
        }
      });
    });
  }
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/onboarding/operator`);
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
  await page
    .getByRole("button", { name: "Ask GridFlex with your voice", exact: true })
    .waitFor();
  if (
    await page.getByRole("button", { name: "Use voice", exact: true }).count()
  )
    throw Error("Inline voice replacement remains");
  await page.screenshot({
    animations: "disabled",
    path: path.join(out, "run-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Type a question" }).click();
  await page.screenshot({
    animations: "disabled",
    path: path.join(out, "run-chat-desktop.png"),
  });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Shift+S");
  await page
    .getByLabel("Presenter access code")
    .fill(readFileSync(".data/presenter-code", "utf8").trim());
  await page.getByRole("button", { name: "Unlock controls" }).click();
  await page
    .getByRole("button", { name: "Inject scenario", exact: true })
    .waitFor();
  await page.screenshot({
    animations: "disabled",
    path: path.join(out, "run-controls.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  if (process.env.CHECK_MANUAL_PLAYBACK === "1") {
    // UI coverage uses controlled snapshots; engine tests exercise actual advancement.
    const response = await page.request.get("http://localhost:8787/runs/current");
    const { run } = await response.json();
    run.version += 1_000_000;
    let failNext = false;
    let advances = 0;
    await page.route("**/runs/current", (route) => route.fulfill({ json: { run } }));
    await page.route("**/runs/control", async (route) => {
      const { action, value } = route.request().postDataJSON();
      if (action === "speed") {
        run.speed = value;
        run.status = "paused";
      } else if (action === "next-event") {
        advances++;
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (failNext) {
          await route.fulfill({ status: 409, json: { error: "RPC unavailable. Try again shortly." } });
          return;
        }
        run.minute += 15;
      } else throw Error(`Unexpected control action: ${action}`);
      run.version++;
      await route.fulfill({ json: { run } });
    });
    await page.keyboard.press("Control+Shift+S");
    if (await page.getByLabel("Playback speed").locator("option").count() !== 4)
      throw Error("Expected four playback options");
    await page.getByLabel("Playback speed").selectOption("0");
    await page.getByText("Automatic playback is paused.", { exact: false }).waitFor();
    await page.keyboard.press("Escape");
    const guide = page.getByRole("region", { name: "Demo guide" });
    const next = guide.getByRole("button", { name: /^Next: / });
    await guide.getByRole("heading", { name: "Fast-forward to the next grid stress" }).waitFor();
    await next.click();
    await guide.getByRole("button", { name: "Fast-forwarding the day…" }).waitFor();
    await next.waitFor();
    if (advances !== 1) throw Error("Next event was not requested exactly once");
    await page.screenshot({ path: path.join(out, "run-manual-desktop.png"), animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    const a = await guide.boundingBox();
    const b = await page.getByRole("button", { name: "Ask GridFlex with your voice" }).boundingBox();
    if (!a || !b || !(a.y + a.height <= b.y || a.x + a.width <= b.x))
      throw Error("Manual control overlaps the voice button");
    await page.screenshot({ path: path.join(out, "run-manual-mobile.png"), animations: "disabled" });
    failNext = true;
    await next.click();
    await page.getByRole("alert").filter({ hasText: "RPC unavailable" }).waitFor();
    await page.keyboard.press("Control+Shift+S");
    await page.getByLabel("Playback speed").selectOption("96");
    await page.getByText("Automatic playback is paused.", { exact: false }).waitFor({ state: "hidden" });
    await page.keyboard.press("Escape");
    if (await next.count()) throw Error("Manual control remained visible in timed playback");
    await page.unroute("**/runs/control");
    await page.unroute("**/runs/current");
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.reload();
    await page.getByRole("heading", { name: "Austin grid", exact: true }).waitFor();
  }
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: await desktop.storageState(),
  });
  const phone = await mobile.newPage();
  await phone.goto(`${base}/dashboard`);
  await phone
    .getByRole("heading", { name: "Austin grid", exact: true })
    .waitFor();
  await phone.screenshot({
    animations: "disabled",
    path: path.join(out, "run-mobile.png"),
    fullPage: true,
  });
  if (
    await phone.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw Error("Mobile overflow");
  await phone
    .getByRole("button", { name: "Ask GridFlex with your voice", exact: true })
    .waitFor();
  await phone.getByRole("button", { name: "Type a question" }).click();
  await phone.screenshot({
    animations: "disabled",
    path: path.join(out, "run-chat-mobile.png"),
  });
  await phone.getByRole("button", { name: "Close conversation panel" }).click();
  await page.route("**/api/voice/session", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Assistant temporarily unavailable. Try again.",
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Ask GridFlex with your voice", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Assistant temporarily unavailable" })
    .waitFor();
  await page.unroute("**/api/voice/session");
  if (mockedVoice) {
    // Exercise the real SDK and client tools without spending provider credits.
    await page.route("**/api/voice/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: "wss://gridflex.test/conversation" }),
      }),
    );
  }
  if (process.env.CHECK_VOICE_TEXT === "1") {
    await page.getByRole("button", { name: "Type a question" }).click();
    await page
      .getByLabel("Question for GridFlex")
      .fill("What is the current local demand in kilowatts? Use the tools.");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const response = page
      .locator("#grid-assistant li")
      .filter({ hasText: /GridFlex:.*\d[\d.,]*\s*(kW|kilowatt)/i })
      .last();
    await response
      .waitFor({ timeout: mockedVoice ? 10_000 : 60_000 })
      .catch(async (error) => {
        console.log(
          "Assistant diagnostic:",
          await page.locator("#grid-assistant").innerText(),
        );
        console.log("Page errors:", errors);
        throw error;
      });
    console.log("Assistant response:", await response.innerText());
    await page.getByRole("button", { name: "End conversation" }).click();
    if (
      await page.evaluate(
        () =>
          (window as typeof window & { voiceTracks: MediaStreamTrack[] })
            .voiceTracks.length,
      )
    )
      throw Error("Text chat requested microphone access");
    await page
      .getByRole("button", { name: "Close conversation panel" })
      .click();
    console.log(
      `${mockedVoice ? "Mocked transport" : "Live ElevenLabs"}: text tools returned current data without opening the microphone.`,
    );
  }
  if (process.env.CHECK_VOICE_AUDIO === "1") {
    let sessions = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/voice/session")) sessions++;
    });
    await page
      .getByRole("button", {
        name: "Ask GridFlex with your voice",
        exact: true,
      })
      .click();
    await page
      .locator('.voice-fab[data-state="speaking"]')
      .waitFor({ timeout: 60_000 });
    await page.getByRole("link", { name: "Zones", exact: true }).click();
    await page.waitForURL("**/dashboard/zones");
    await page
      .getByRole("button", { name: "End voice assistant", exact: true })
      .waitFor();
    if (sessions !== 1) throw Error("Navigation restarted the voice session");
    await page
      .getByRole("button", { name: "End voice assistant", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Ask GridFlex with your voice",
        exact: true,
      })
      .waitFor();
    await page.waitForFunction(() => {
      const tracks = (
        window as typeof window & { voiceTracks: MediaStreamTrack[] }
      ).voiceTracks;
      return (
        tracks.length > 0 &&
        tracks.every((track) => track.readyState === "ended")
      );
    });
    console.log(
      `${mockedVoice ? "Mocked transport" : "Live ElevenLabs"}: voice produced speaking state, survived navigation and released microphone tracks.`,
    );
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
