import { test, expect, devices } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QA_DIR = path.resolve(__dirname);
const widths = [320, 375, 390, 430] as const;
type Page = import("@playwright/test").Page;

// Inga riktiga anrop till Formspree från tester – allt mot formspree.io
// fångas på context-nivå och besvaras med ett fejkat 200 {"ok":true}.
let formspreeCalls = 0;
test.beforeEach(async ({ context }) => {
  formspreeCalls = 0;
  await context.route(/formspree\.io/, (route) => {
    formspreeCalls++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
});

const trackErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
};

test.describe("Definition of Done", () => {
  test("no horizontal overflow at mobile widths", async ({ page }) => {
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 812 });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(scrollWidth, `Horizontal overflow at ${w}px`).toBeLessThanOrEqual(innerWidth);
    }
  });

  test("no console errors during full scroll at 390px", async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const step = window.innerHeight / 2;
      const maxScroll = document.documentElement.scrollHeight;
      for (let pos = 0; pos < maxScroll; pos += step) {
        window.scrollTo(0, pos);
        await delay(100);
      }
      window.scrollTo(0, maxScroll);
      await delay(200);
    });
    expect(errors, `Console errors: ${errors.join("; ")}`).toHaveLength(0);
  });

  test("all sections visible after scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    for (const sel of ["#act-when", "#act-where", "#act-program", "#act-rsvp", "#act-outro"]) {
      await page.locator(sel).scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
    }
    const checks = [
      ".title", ".hud", ".press-start", "#when-box", "#countdown", "#where-scene",
      "#beat-gaming", "#beat-snacks", "#beat-bring", "#rsvp-form", ".hiscore", ".outro-controls",
    ];
    for (const sel of checks) {
      const opacity = await page.locator(sel).evaluate((el) => parseFloat(getComputedStyle(el).opacity));
      expect(opacity, `${sel} opacity`).toBeGreaterThanOrEqual(0.95);
    }
  });

  test("coin counter countdown shows correct days", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const partyDate = new Date("2026-11-20T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((partyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const countdown = page.locator("#countdown");
    if (diff > 0) {
      await expect(countdown).toContainText(`${diff} dagar kvar`);
      // Siffrorna rullar fram till rätt tal när räkneverket kommer i bild
      await countdown.scrollIntoViewIfNeeded();
      await expect
        .poll(() => page.$$eval(".cd-digit", (d) => d.map((x) => x.textContent).join("")))
        .toBe(String(diff));
    } else if (diff === 0) {
      await expect(countdown).toContainText("idag");
    } else {
      await expect(countdown).toContainText("har varit");
    }
  });

  test("signpost unfolds the map with address and map links", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator("#act-where").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    const card = page.locator("#address-card");
    await expect(card).not.toHaveClass(/open/);
    await page.locator("#signpost").click();
    await expect(card).toHaveClass(/open/);
    await expect(page.locator("#signpost")).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => card.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    const q = encodeURIComponent("Kardemummagränd 20, 135 36 Tyresö");
    expect(await page.locator("#btn-google-maps").getAttribute("href")).toContain(q);
    expect(await page.locator("#btn-apple-maps").getAttribute("href")).toContain(q);
    // Andra trycket viker ihop
    await page.locator("#signpost").click();
    await expect(card).not.toHaveClass(/open/);
    await expect(page.locator("#signpost")).toHaveAttribute("aria-expanded", "false");
  });

  test("bring item is shown in Vad händer", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#beat-bring .bring-label")).toHaveText("Ta med");
    await expect(page.locator("#bring-text")).toHaveText("Egen padda eller mobil med Roblox/Minecraft installerat");
  });

  test("?g=Emma: 'Emma är bjuden på' and name prefilled in OSA", async ({ page }) => {
    await page.goto("/?g=Emma");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".subtitle")).toContainText("och Emma är bjuden på");
    await expect(page.locator("#field-name")).toHaveValue("Emma");
    await page.locator("#field-name").fill("Emma S");
    await expect(page.locator("#field-name")).toHaveValue("Emma S");
  });

  test("without ?g: 'du är bjuden på gamingkalas' and empty name field", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".subtitle")).toContainText("och du är bjuden på gamingkalas");
    await expect(page.locator("#field-name")).toHaveValue("");
  });

  test("greeting with ?g=<script> renders as text", async ({ page }) => {
    await page.goto("/?g=<script>alert(1)</script>");
    await page.waitForLoadState("networkidle");
    const html = await page.locator("#invitee").innerHTML();
    expect(html).not.toContain("<");
    expect(await page.locator("#field-name").inputValue()).not.toContain("<");
  });

  test("form validation: empty name shows error, no POST", async ({ page }) => {
    await page.goto("/");
    await page.locator("#act-rsvp").scrollIntoViewIfNeeded();
    await page.locator("#btn-submit").click();
    await expect(page.locator("#error-name")).not.toBeEmpty();
    await expect(page.locator("#rsvp-form")).toBeVisible();
    expect(formspreeCalls).toBe(0);
  });

  test("Formspree submission (mocked): LEVEL UP and pixel confetti", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator("#act-rsvp").scrollIntoViewIfNeeded();
    await page.locator("#field-name").fill("TEST – ignorera");
    await page.locator("#btn-yes").click();
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("formspree.io") && r.request().method() === "POST"
    );
    await page.locator("#btn-submit").click();
    const response = await responsePromise;
    const status = response.status();
    fs.writeFileSync(
      path.join(QA_DIR, "formspree-response.json"),
      JSON.stringify({ status, body: await response.text().catch(() => "") }, null, 2)
    );
    expect(status).toBe(200);
    expect(formspreeCalls, "POST ska ha fångats av mocken").toBe(1);
    expect(response.request().postData()).toContain("Vilgots kalas – OSA");
    await expect(page.locator("#form-status")).toContainText("Hurra! Vi ses den 20:e!");
    await expect(page.locator(".levelup")).toHaveText("LEVEL UP!");
    await expect(page.locator("canvas")).toHaveCount(1); // canvas-confetti
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(QA_DIR, "screenshot-levelup.png") });
    await expect(page.locator(".levelup")).toHaveCount(0, { timeout: 4000 });
  });

  test("localStorage persistence after submission", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      localStorage.setItem(
        "vilgots-kalas-rsvp:default",
        JSON.stringify({ name: "TestBarn", attending: "ja", diet: "Nötallergi", phone: "", message: "" })
      );
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.locator("#act-rsvp").scrollIntoViewIfNeeded();
    await expect(page.locator("#rsvp-summary")).toBeVisible();
    await expect(page.locator("#summary-text")).toContainText("TestBarn");
    await page.locator("#btn-change").click();
    await expect(page.locator("#rsvp-form")).toBeVisible();
    await expect(page.locator("#field-name")).toHaveValue("TestBarn");
  });

  test("mute toggle: one visible icon, label toggles, persists", async ({ page }) => {
    // Faktiskt synliga ikoner (computed display), inte .hidden-egenskapen –
    // SVG följer inte webbläsarens [hidden]-regel.
    const shown = () =>
      page.$$eval("#btn-mute svg", (s) => s.filter((x) => getComputedStyle(x).display !== "none").map((x) => x.id));
    const btn = page.locator("#btn-mute");

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator("#act-outro").scrollIntoViewIfNeeded();
    expect(await shown()).toEqual(["icon-sound-on"]);
    await expect(btn).toHaveAttribute("aria-label", "Stäng av ljud");

    await btn.click();
    expect(await shown()).toEqual(["icon-sound-off"]);
    await expect(btn).toHaveAttribute("aria-label", "Sätt på ljud");
    expect(await page.evaluate(() => localStorage.getItem("vilgots-kalas-mute"))).toBe("true");

    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(await shown()).toEqual(["icon-sound-off"]);

    await page.locator("#act-outro").scrollIntoViewIfNeeded();
    await btn.click();
    expect(await shown()).toEqual(["icon-sound-on"]);
    await expect(btn).toHaveAttribute("aria-label", "Stäng av ljud");
  });

  test("audio: no AudioContext at load, running after first tap, resumed after suspend", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.route(/formspree\.io/, (r) => r.fulfill({ status: 200, body: '{"ok":true}' }));
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const Orig = window.AudioContext;
      (window as any).__ctxs = [];
      window.AudioContext = class extends Orig {
        constructor(...a: any[]) {
          super(...a);
          (window as any).__ctxs.push(this);
        }
      } as typeof AudioContext;
    });
    const states = () => page.evaluate(() => (window as any).__ctxs.map((c: AudioContext) => c.state));

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    expect(await states()).toEqual([]); // inte vid sidladdning

    await page.locator("#btn-hero").tap();
    await expect.poll(states).toEqual(["running"]);

    // iOS pausar kontexten vid appbyte – nästa tryck ska väcka den
    await page.evaluate(() => (window as any).__ctxs[0].suspend());
    await expect.poll(states).toEqual(["suspended"]);
    await page.locator("#btn-hero").tap();
    await expect.poll(states).toEqual(["running"]);
    await ctx.close();
  });

  test("prefers-reduced-motion: page readable", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    for (const sel of ["#intro", "#act-when", "#act-where", "#act-program", "#act-rsvp", "#act-outro"]) {
      await page.locator(sel).scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    for (const sel of [".title", "#when-box", "#beat-bring", ".hiscore"]) {
      await expect
        .poll(() => page.locator(sel).evaluate((el) => parseFloat(getComputedStyle(el).opacity)))
        .toBeGreaterThanOrEqual(0.95);
    }
    await context.close();
  });

  test("noindex meta present", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  });

  test("screenshots at all widths", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(QA_DIR, "screenshot-intro.png") });

    for (const s of [
      { sel: "#act-when", name: "when" },
      { sel: "#act-where", name: "where" },
      { sel: "#act-program", name: "program" },
      { sel: "#beat-bring", name: "bring" },
      { sel: "#act-rsvp", name: "rsvp" },
      { sel: "#act-outro", name: "outro" },
    ]) {
      await page.locator(s.sel).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1600);
      await page.screenshot({ path: path.join(QA_DIR, `screenshot-${s.name}.png`) });
    }

    await page.locator("#act-where").scrollIntoViewIfNeeded();
    await page.locator("#signpost").click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(QA_DIR, "screenshot-where-open.png") });

    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      await page.evaluate(async () => {
        const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const step = window.innerHeight / 2;
        const max = document.documentElement.scrollHeight;
        for (let y = 0; y < max; y += step) {
          window.scrollTo(0, y);
          await delay(150);
        }
        await delay(1500);
        window.scrollTo(0, 0);
        await delay(300);
      });
      await page.screenshot({ path: path.join(QA_DIR, `screenshot-${w}px.png`), fullPage: true });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem(
        "vilgots-kalas-rsvp:default",
        JSON.stringify({ name: "TestBarn", attending: "ja", diet: "", phone: "", message: "" })
      )
    );
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.locator("#act-rsvp").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(QA_DIR, "screenshot-rsvp-success.png") });
  });
});

test.describe("Tap interactions", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  const vis = (page: Page, sel: string) =>
    page.$eval(sel, (e) => {
      const c = getComputedStyle(e);
      return c.visibility === "visible" && c.opacity === "1";
    });

  test("hero: shades → crown → nothing", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const btn = page.locator("#btn-hero");
    await expect(btn).toHaveAttribute("aria-label", "Tryck på Vilgot");
    expect(await vis(page, "#shades")).toBe(false);
    expect(await vis(page, "#crown")).toBe(false);

    await btn.tap();
    await expect(btn).toHaveAttribute("data-state", "1");
    await expect.poll(() => vis(page, "#shades")).toBe(true);
    await page.waitForTimeout(800);
    await btn.screenshot({ path: path.join(QA_DIR, "screenshot-hero-shades.png") });

    await btn.tap();
    await expect(btn).toHaveAttribute("data-state", "2");
    await expect.poll(() => vis(page, "#crown")).toBe(true);
    await expect.poll(() => vis(page, "#shades")).toBe(false);
    await page.waitForTimeout(800);
    await btn.screenshot({ path: path.join(QA_DIR, "screenshot-hero-crown.png") });

    await btn.tap();
    await expect(btn).toHaveAttribute("data-state", "0");
    await expect.poll(() => vis(page, "#crown")).toBe(false);
    expect(await vis(page, "#shades")).toBe(false);

    await btn.tap(); // börjar om
    await expect(btn).toHaveAttribute("data-state", "1");
    expect(errors).toEqual([]);
  });

  test("dig: cracks, block breaks with shards, coin counted, respawn after 3 s", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const btn = page.locator("#btn-dig");
    const spot = page.locator(".dig-spot");
    await expect(page.locator("#coin-count")).toHaveText("00");

    // Spricka 2 syns bara ~0,1 s innan blocket går sönder – registrera att den
    // visades i stället för att försöka hinna se den med poll
    await page.evaluate(() => {
      const el = document.querySelector("#btn-dig .crack-2")!;
      new MutationObserver(() => {
        if (getComputedStyle(el).visibility === "visible") (window as any).__crack2 = true;
      }).observe(el, { attributes: true, attributeFilter: ["style"] });
    });
    await btn.tap();
    await expect(spot).toHaveAttribute("data-state", "dug");
    await expect.poll(() => page.evaluate(() => (window as any).__crack2 === true)).toBe(true);
    await expect(page.locator(".fx.shard")).not.toHaveCount(0);
    await expect(page.locator("#coin-count")).toHaveText("01");
    await expect.poll(() => vis(page, "#btn-dig .dig-block")).toBe(false);
    await page.screenshot({ path: path.join(QA_DIR, "screenshot-tap-dig.png") });

    // Tryck medan blocket är borta räknas inte
    await btn.tap({ force: true });
    await expect(page.locator("#coin-count")).toHaveText("01");

    // Respawn efter 3 s (marginal för animationen)
    await expect.poll(() => vis(page, "#btn-dig .dig-block"), { timeout: 4500 }).toBe(true);
    await expect(spot).not.toHaveAttribute("data-state", "dug");
    expect(await vis(page, "#btn-dig .crack-1")).toBe(false);
    await expect(page.locator(".fx-layer")).toHaveCount(0);

    await btn.tap();
    await expect(page.locator("#coin-count")).toHaveText("02");
    expect(errors).toEqual([]);
  });

  test("chest: opens with a coin burst, one burst at a time, closes", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator("#act-where").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const btn = page.locator("#btn-chest");

    await btn.tap();
    await expect(btn).toHaveAttribute("data-open", "true");
    await expect(btn).toHaveAttribute("aria-label", "Stäng skattkistan");
    expect(await vis(page, "#btn-chest .chest-open")).toBe(true);
    expect(await vis(page, "#btn-chest .chest-closed")).toBe(false);
    await expect(page.locator(".fx.coin")).toHaveCount(16);
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(QA_DIR, "screenshot-tap-chest.png") });

    await btn.tap(); // stänger, inget nytt regn
    await expect(btn).toHaveAttribute("data-open", "false");
    await btn.tap(); // öppnar igen medan första regnet pågår
    await expect(page.locator(".fx-layer")).toHaveCount(1);
    await expect(page.locator(".fx-layer")).toHaveCount(0, { timeout: 3000 });
    expect(errors).toEqual([]);
  });

  test("hearts: three ouches, GAME OVER?, then EXTRA LIFE!", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const btn = page.locator("#btn-hearts");
    const msg = page.locator("#hearts-msg");
    const lost = () => page.locator("#btn-hearts .heart.lost").count();

    await btn.tap();
    await expect(btn).toHaveAttribute("data-lives", "2");
    await expect(msg).toHaveText("OUCH!");
    expect(await lost()).toBe(1);
    await expect(msg).toHaveText("", { timeout: 2000 }); // försvinner av sig själv

    await btn.tap();
    await btn.tap();
    await expect(btn).toHaveAttribute("data-lives", "0");
    await expect(msg).toHaveText("GAME OVER?");
    expect(await lost()).toBe(3);
    await expect(btn).toHaveAttribute("aria-label", /extra liv/);
    await page.waitForTimeout(1500);
    await expect(msg).toHaveText("GAME OVER?"); // står kvar
    await page.screenshot({ path: path.join(QA_DIR, "screenshot-tap-gameover.png"), clip: { x: 0, y: 0, width: 390, height: 120 } });

    await btn.tap();
    await expect(btn).toHaveAttribute("data-lives", "3");
    await expect(msg).toHaveText("EXTRA LIFE!");
    expect(await lost()).toBe(0);
    expect(errors).toEqual([]);
  });

  test("reduced motion: end states only, effects still cleaned up", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = trackErrors(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Solglasögonen står på plats direkt (ingen y-förskjutning)
    await page.locator("#btn-hero").tap();
    expect(await page.$eval("#shades", (e) => new DOMMatrix(getComputedStyle(e).transform).f)).toBe(0);
    await expect.poll(() => vis(page, "#shades")).toBe(true);

    // Blocket försvinner direkt, utan splitter, och myntet räknas
    await page.locator("#btn-dig").tap();
    await expect(page.locator(".fx.shard")).toHaveCount(0);
    await expect(page.locator("#coin-count")).toHaveText("01");

    await page.locator("#act-where").scrollIntoViewIfNeeded();
    await page.locator("#btn-chest").tap();
    await expect(page.locator(".fx.coin")).toHaveCount(16);
    await expect(page.locator(".fx-layer")).toHaveCount(0, { timeout: 3000 });
    expect(errors).toEqual([]);
  });
});

test.describe("Synthesized 8-bit sounds", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("right sound per interaction, no files, real oscillators, silent when muted", async ({ page }) => {
    // window.__sfx = testkroken i playSound(); __osc räknar faktiskt startade oscillatorer
    await page.addInitScript(() => {
      const w = window as any;
      w.__sfx = [];
      w.__osc = 0;
      const orig = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...a: any[]) {
        w.__osc++;
        return orig.apply(this, a as any);
      };
    });
    const audioRequests: string[] = [];
    page.on("request", (r) => {
      if (/\.(mp3|wav|ogg|m4a)(\?|$)/.test(r.url())) audioRequests.push(r.url());
    });
    const sfx = () => page.evaluate(() => (window as any).__sfx as string[]);
    const osc = () => page.evaluate(() => (window as any).__osc as number);
    const since = async (n: number) => (await sfx()).slice(n);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    expect(await sfx()).toEqual([]);

    await page.locator("#btn-hero").tap();
    await expect.poll(sfx).toEqual(["equip"]);
    await expect.poll(osc).toBeGreaterThan(0);

    let n = (await sfx()).length;
    await page.locator("#btn-dig").tap();
    await expect.poll(() => since(n)).toEqual(["dig", "coin"]);

    n = (await sfx()).length;
    for (let i = 0; i < 4; i++) await page.locator("#btn-hearts").tap();
    await expect.poll(() => since(n)).toEqual(["ouch", "ouch", "gameover", "levelup"]);

    await page.locator("#act-where").scrollIntoViewIfNeeded();
    n = (await sfx()).length;
    await page.locator("#signpost").tap();
    await page.locator("#btn-chest").tap();
    await expect.poll(() => since(n)).toEqual(["blip", "chest"]);

    // OSA ja = level up (Formspree mockas i beforeEach)
    await page.locator("#field-name").fill("Testbarn");
    await page.locator("#btn-yes").click();
    n = (await sfx()).length;
    await page.locator("#btn-submit").click();
    await expect.poll(() => since(n)).toEqual(["levelup"]);

    // Ljud av: inga ljud och inga nya oscillatorer
    await page.locator("#btn-mute").scrollIntoViewIfNeeded();
    await page.locator("#btn-mute").click();
    await page.waitForTimeout(1500); // låt pågående toner starta klart
    n = (await sfx()).length;
    const o = await osc();
    await page.locator("#btn-chest").tap();
    await page.locator("#btn-chest").tap();
    await page.waitForTimeout(500);
    expect(await since(n)).toEqual([]);
    expect(await osc()).toBe(o);
    expect(audioRequests).toEqual([]);
  });
});

// Pixel 7 utan defaultBrowserType (får inte sättas i en describe)
const { defaultBrowserType: _pixelBrowser, ...pixel7 } = devices["Pixel 7"];

test.describe("Android hero (Pixel 7)", () => {
  test.use(pixel7);

  const heroState = (page: Page) =>
    page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>("#hero-frame img")!;
      return {
        naturalWidth: img.naturalWidth,
        opacity: getComputedStyle(document.querySelector("#hero-frame")!).opacity,
      };
    });

  test("hero image loads and is fully visible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect.poll(() => heroState(page)).toEqual({ naturalWidth: 600, opacity: "1" });
  });

  test("hero frame reserves its size before the image loads", async ({ page }) => {
    await page.route(/vilgot-hero\.(webp|jpg)$/, () => {}); // bilden laddas aldrig
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Layoutstorlek (offset*), inte boundingBox – intro-animationen skalar ramen
    const size = await page.$eval("#hero-frame", (e) => [(e as HTMLElement).offsetWidth, (e as HTMLElement).offsetHeight]);
    expect(size).toEqual([192, 256]);
  });
});

test.describe("RSVP persistence", () => {
  test("answer is stored per guest (?g) in localStorage only", async ({ page, browser }) => {
    await page.goto("/?g=Emma");
    await page.waitForLoadState("networkidle");
    await page.locator("#act-rsvp").scrollIntoViewIfNeeded();
    await page.locator("#btn-yes").click();
    await page.locator("#btn-submit").click(); // Formspree mockas i beforeEach
    await expect(page.locator("#rsvp-summary")).toBeVisible({ timeout: 5000 });

    expect(page.url()).toMatch(/\/\?g=Emma$/);
    expect(await page.context().cookies()).toEqual([]);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
    expect(
      await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("vilgots-kalas-rsvp")))
    ).toEqual(["vilgots-kalas-rsvp:emma"]);

    await page.goto("/?g=Olle");
    await expect(page.locator("#rsvp-summary")).toBeHidden();
    await expect(page.locator("#rsvp-form")).toBeVisible();
    await expect(page.locator("#field-name")).toHaveValue("Olle");

    await page.goto("/");
    await expect(page.locator("#rsvp-summary")).toBeHidden();

    await page.goto("/?g=emma");
    await expect(page.locator("#rsvp-summary")).toBeVisible();
    await expect(page.locator("#summary-text")).toContainText("Emma");

    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto("/?g=Emma");
    await expect(p2.locator("#rsvp-form")).toBeVisible();
    await expect(p2.locator("#rsvp-summary")).toBeHidden();
    await other.close();
  });

  test("an unscoped key is not read", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem(
        "vilgots-kalas-rsvp",
        JSON.stringify({ name: "Vilgot", attending: "ja", diet: "", phone: "", message: "" })
      )
    );
    for (const url of ["/", "/?g=Vilgot", "/?g=Emma"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("#rsvp-summary"), url).toBeHidden();
    }
  });

  test("?reset=1 clears all saved answers and reloads without the parameter", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const a = JSON.stringify({ name: "Emma", attending: "ja", diet: "", phone: "", message: "" });
      localStorage.setItem("vilgots-kalas-rsvp", a);
      localStorage.setItem("vilgots-kalas-rsvp:emma", a);
      localStorage.setItem("vilgots-kalas-rsvp:default", a);
      localStorage.setItem("vilgots-kalas-mute", "true");
    });
    await page.goto("/?g=Emma&reset=1");
    await page.waitForURL(/\/\?g=Emma$/);
    await page.waitForLoadState("networkidle");
    expect(
      await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("vilgots-kalas-rsvp")))
    ).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem("vilgots-kalas-mute"))).toBe("true");
    await expect(page.locator("#rsvp-form")).toBeVisible();
    await expect(page.locator("#rsvp-summary")).toBeHidden();
  });

  test("?debug=1 shows which key was read", async ({ page }) => {
    await page.goto("/?g=Vilgot&debug=1");
    await expect(page.locator("#debug")).toContainText("OSA-nyckel som lästes: vilgots-kalas-rsvp:vilgot", {
      timeout: 6000,
    });
  });
});

test.describe("Resilience (no JS, init crash, blocked script)", () => {
  test.use(pixel7);

  // Synligt = opacity 1 i hela kedjan upp till body och inte display:none
  const visible = (page: Page, sel: string) =>
    page.$eval(sel, (el) => {
      if (el.getClientRects().length === 0) return false;
      for (let n: Element | null = el; n; n = n.parentElement) {
        if (getComputedStyle(n).opacity !== "1") return false;
      }
      return true;
    });

  const CONTENT = [
    ["#main-title", "Vilgot fyller 10!"],
    ["#party-kind", "gamingkalas"],
    ["#when-date", "Fredag 20 november"],
    ["#when-time", "Kl 18:00 – 20:30"],
    ["#address-street", "Kardemummagränd 20"],
    ["#beat-gaming-text", "Gaming tillsammans"],
    ["#beat-snacks-text", "Snacks och tilltugg"],
    ["#beat-tempo-text", "Högt tempo, låg ljudnivå – kanske"],
    ["#bring-text", "Egen padda eller mobil"],
    ["#rsvp-deadline", "Svara senast tisdag 17 november"],
    ["#hs-name", "Vilgot"],
    ["#hs-score", "10 år"],
    ["#outro-see-you", "Vi ses den 20:e!"],
  ] as const;

  const expectAllContentVisible = async (page: Page) => {
    expect(await visible(page, "#hero-frame")).toBe(true);
    expect(await page.$eval("#hero-frame img", (i) => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    for (const [sel, text] of CONTENT) {
      await expect(page.locator(sel)).toContainText(text);
      // Poll: utan .js vecklas t.ex. adresskortet ut med en kort övergång
      await expect.poll(() => visible(page, sel), { message: sel }).toBe(true);
    }
    // Pixelgrafiken finns i HTML:en från bygget
    expect(await page.locator("svg[data-sprite] path").count()).toBeGreaterThan(50);
    await expect(page.locator("#rsvp-summary")).toBeHidden();
  };

  test("without JS: hero, all text, sprites and the address are visible, no summary", async ({ browser }) => {
    const ctx = await browser.newContext({ ...pixel7, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expectAllContentVisible(page);
    await expect(page.locator("#rsvp-form")).toBeVisible();
    await expect(page.locator("#debug")).toBeHidden();
    // PRESS START är en vanlig länk till första nivån
    await expect(page.locator("#press-start")).toHaveAttribute("href", "#act-when");
    await ctx.close();
  });

  test("a crashing init step does not stop the rest; ?debug=1 shows the error", async ({ page }) => {
    await page.addInitScript(() => {
      const orig = Document.prototype.getElementById;
      Document.prototype.getElementById = function (id: string) {
        if (id === "shades") throw new Error("test-krasch");
        return orig.call(this, id);
      };
    });
    await page.goto("/?debug=1");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveClass(/js-ready/);
    await expect(page.locator("html")).not.toHaveClass(/(^|\s)js(\s|$)/);
    // Steg efter det trasiga körde ändå: grävblocket och ljudknappen fungerar
    await page.locator("#btn-dig").tap();
    await expect(page.locator("#coin-count")).toHaveText("01");
    expect(
      await page.$$eval("#btn-mute svg", (s) => s.filter((x) => getComputedStyle(x).display !== "none").length)
    ).toBe(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectAllContentVisible(page);
    await expect(page.locator("#debug")).toBeVisible({ timeout: 6000 });
    await expect(page.locator("#debug")).toContainText("init:hero: test-krasch");
  });

  test("main script blocked: failsafe reveals everything within 4 s, debug explains", async ({ page }) => {
    await page.route(/\/assets\/index-.*\.js$/, (r) => r.abort());
    await page.goto("/?debug=1");
    await expect(page.locator("html")).not.toHaveClass(/(^|\s)js(\s|$)/, { timeout: 5000 });
    await expectAllContentVisible(page);
    await expect(page.locator("#debug")).toContainText("Nödspärr", { timeout: 6000 });
  });

  test("debug panel stays hidden without ?debug=1", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(5000);
    await expect(page.locator("#debug")).toBeHidden();
  });
});

test.describe("RSVP guest field", () => {
  // Skicka formuläret och returnera fälten som POST:ades (mot mocken i beforeEach)
  const submit = async (page: Page, url: string, name?: string) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.locator("#act-rsvp").scrollIntoViewIfNeeded();
    if (name !== undefined) await page.locator("#field-name").fill(name);
    await page.locator("#btn-yes").click();
    const req = page.waitForRequest((r) => r.url().includes("formspree.io") && r.method() === "POST");
    await page.locator("#btn-submit").click();
    const body = (await req).postData() ?? "";
    const fields: Record<string, string> = {};
    for (const m of body.matchAll(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g)) fields[m[1]] = m[2];
    return fields;
  };

  test("label says the name the invitation is for", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('label[for="field-name"]')).toHaveText("Barnets namn (som inbjudan gäller)");
  });

  test("guest = ?g name even when the name field is changed", async ({ page }) => {
    const f = await submit(page, "/?g=Emma", "Olle");
    expect(f.name).toBe("Olle");
    expect(f.guest).toBe("Emma");
    expect(f._subject).toBe("Vilgots kalas – OSA");
  });

  test('guest = "okänd" without ?g', async ({ page }) => {
    const f = await submit(page, "/", "Kim");
    expect(f.name).toBe("Kim");
    expect(f.guest).toBe("okänd");
  });
});
