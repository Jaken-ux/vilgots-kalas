// Boten i webbläsaren. Testsviten paketerar filen med esbuild och lägger den
// som init-skript på sidan. Den spelar mot spelets motor via window.__gameHook
// och trycker med riktiga pointerdown på spelytan. Läget sätts före sidladdning:
// window.__botKind = "perfect" (standard), "human" eller "passive". Boten går
// på hjärtan.
//
// Frysning för skärmdumpar: window.__freeze = true stoppar alla nya
// requestAnimationFrame, så att canvasen står kvar på senast ritade bildruta.
import { makeBot } from "./bots";
import type { Engine } from "../src/engine";

const w = window as unknown as Record<string, any>;
w.__crash = [];
w.__maxLevel = 0;
w.__kinds = {};
w.__freeze = false;
const raf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (cb) => (w.__freeze ? 0 : raf(cb));

w.__gameHook = (api: { engine(): Engine }) => {
  w.__api = api;
  let eng: Engine | null = null;
  let bot: (() => void) | null = null;
  let lives = 3;
  const seen = new WeakSet();
  const tick = () => {
    const el = document.getElementById("game")!;
    const e = api.engine();
    if (e !== eng) {
      eng = e;
      lives = e.lives;
      const tap = () => void el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
      bot = makeBot(e, w.__botKind ?? "perfect", { hunt: true, press: tap });
    }
    if (w.__freeze) return void raf(tick);
    if (el.dataset.state === "run") bot!();
    if (e.lives < lives) w.__crash.push(e.clock);
    lives = e.lives;
    w.__maxLevel = Math.max(w.__maxLevel, e.level);
    for (const o of e.obs) {
      if (o.x < 192 && !seen.has(o)) {
        seen.add(o);
        const n = o.twin ? "twin" : o.b < Infinity ? `${o.n}+broms` : o.n;
        w.__kinds[n] = (w.__kinds[n] ?? 0) + 1;
      }
    }
    w.__check?.(e);
    raf(tick);
  };
  raf(tick);
};
