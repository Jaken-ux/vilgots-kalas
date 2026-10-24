// Bonus level: ett litet springspel i <canvas>. Inga bibliotek.
// Spelet räknar i "spelpixlar" (W×H). Canvasen får bredden W·k enhetspixlar
// (k = heltal) och ritar med ctx.scale(k), så varje spelpixel blir exakt k×k
// skärmpixlar – skarpt även för text, utan uppskalning av en liten bild.
// Reglerna (fart, hopp, hinder, krockar, utplacering) finns i engine.ts, och
// miljöerna (gräs, grotta, stad, rymd) i levels.ts. Här: ritning, tryck, loop.
import { PALETTE, SPRITES } from "./sprites";
import { ENVS, GROUND, type Palette } from "./levels";
import { createEngine, distAt, envAt, LEVEL_SECONDS, LIVES, RX, W, H, type Engine, type EngineEvent } from "./engine";

export type GameSound = "jump" | "double" | "ouch" | "gameover" | "coin" | "level";
type State = "idle" | "run" | "pause" | "over";

const BEST_KEY = "vilgots-kalas-best"; // per webbläsare, inte per gäst
const FADE = 1; // sekunder för övergången till nästa miljö

// Gubben (8×10): två springsteg och ett hopp. Samma tecken som i sprites.ts.
const HEAD = ["..DDDD..", ".DDDDDD.", ".ppppkp.", ".pppppp.", "..pppp..", ".gggggg.", "pggggggp", ".GGGGGG."];
const RUN_A = [...HEAD, ".BB..BB.", "kk....kk"];
const RUN_B = [...HEAD, "..BBBB..", "..kkkk.."];
const JUMP = [...HEAD, ".BBBBBB.", ".k....k."];
// Rymdskeppet som skjuter
const SHIP = ["....cccc....", "...cbbbbc...", ".kkkkkkkkkk.", "kSSySSySSySk", ".kkkkkkkkkk.", "...r....r..."];
// Dubbelhoppets puff: tre rutor under 0,4 s
const PUFF = [
  ["........", "...ww...", "..wccw..", "...ww..."],
  ["..w..w..", ".wc..cw.", "w......w", ".wc..cw."],
  [".c....c.", "c......c", "........", ".c....c."],
];

type Img = HTMLCanvasElement;
function sprite(rows: string[]): Img {
  const c = document.createElement("canvas");
  c.width = rows[0].length;
  c.height = rows.length;
  const x = c.getContext("2d")!;
  rows.forEach((row, j) =>
    row.split("").forEach((ch, i) => {
      if (ch === ".") return;
      x.fillStyle = PALETTE[ch];
      x.fillRect(i, j, 1, 1);
    })
  );
  return c;
}

// Färg mitt emellan två #rrggbb (f = 0..1), för övergången mellan miljöer
const mix = (a: string, b: string, f: number) =>
  "#" +
  [1, 3, 5]
    .map((i) => {
      const x = parseInt(a.slice(i, i + 2), 16);
      return Math.round(x + (parseInt(b.slice(i, i + 2), 16) - x) * f)
        .toString(16)
        .padStart(2, "0");
    })
    .join("");

// Bakgrundsdekor: fyra platser som rullar runt. En plats byter till den nya
// miljöns dekor först när den rullat ut till vänster.
interface Decor {
  x: number;
  env: number;
}
const DECOR_SPAN = 256;

export function bestScore(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

// Krokar mot resten av sidan: onStart vid varje spelstart, onOver vid game over
// (poäng, och om det är nytt rekord i den här webbläsaren)
export interface GameHooks {
  onStart(): void;
  onOver(score: number, best: boolean): void;
}
// Rader under poängen på game over-skärmen: [text, färg]
export type InfoLine = [string, string];

export function initGame(el: HTMLElement, play: (s: GameSound) => void, hooks: GameHooks) {
  const canvas = el.querySelector("canvas")!;
  const status = document.getElementById("game-status");
  const ctx = canvas.getContext("2d")!;
  const img = {
    runA: sprite(RUN_A), runB: sprite(RUN_B), jump: sprite(JUMP), ship: sprite(SHIP),
    heart: sprite(SPRITES.heart), empty: sprite(SPRITES["heart-empty"]),
  };
  const puffs = PUFF.map(sprite);
  const look = new Map(ENVS.flatMap((e) => Object.values(e.kinds)).map((k) => [k, k.f.map(sprite)]));
  const fallImg = new Map(ENVS.flatMap((e) => Object.values(e.kinds)).filter((k) => k.fall).map((k) => [k, sprite(k.fall!)]));
  const decorImg = ENVS.map((e) => sprite(e.decor.f));

  // Dolt ?level=N (även decimaler, t.ex. 1.9): börja på level N med rätt fart.
  // Övningsläge: varken rekord eller topplista påverkas.
  const startLevel = Math.max(1, Number(new URLSearchParams(location.search).get("level")) || 1);
  const practice = startLevel !== 1;
  const startClock = (startLevel - 1) * LEVEL_SECONDS;

  let state: State = "idle";
  let k = 1;
  let eng: Engine = createEngine({ start: startClock });
  let env = envAt(startClock); // nuvarande miljö
  let fromPal: Palette = env.pal; // palett vid senaste miljöbytet
  let switchAt = -FADE; // när miljöbytet började
  let levelUpAt = -9; // när "LEVEL UP!" ska blinka
  let decor: Decor[] = [0, 1, 2, 3].map((i) => ({ x: i * 64, env: ENVS.indexOf(env) }));
  let raf = 0;
  let last = 0;
  let lock = 0; // ingen omstart direkt efter game over (ett hopptryck ska inte starta om)
  let down: { x: number; y: number; t: number } | null = null;
  let info: InfoLine[] = []; // topplistan på game over-skärmen
  let held = false; // en fråga visas ovanpå spelet: ingen omstart

  const score = () => Math.floor(eng.dist / 10);

  // Läge och siffror som data-attribut: för CSS (touch-action) och testerna
  const sync = () => {
    el.dataset.state = state;
    el.dataset.lives = String(eng.lives);
    el.dataset.score = String(score());
    el.dataset.jumps = String(eng.jumps);
    el.dataset.doubles = String(eng.doubles);
    el.dataset.level = String(eng.level);
    el.dataset.env = env.name;
    el.classList.toggle("playing", state === "run");
  };
  const say = (t: string) => status && (status.textContent = t);

  // Heltalsskala i enhetspixlar som ryms i föräldern
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    // Sektionens innerbredd – inte närmaste förälder, som (.game-wrap) är lika bred som spelet
    const room = ((el.closest(".act-inner") ?? el.parentElement)?.clientWidth || W) - 8; // minus pixelramen
    k = Math.max(1, Math.floor((room * dpr) / W));
    canvas.width = W * k;
    canvas.height = H * k;
    canvas.style.width = `${(W * k) / dpr}px`; // höjden följer (height: auto)
    draw();
  };

  const text = (t: string, x: number, ty: number, color: string, align: CanvasTextAlign = "center") => {
    ctx.textAlign = align;
    ctx.fillStyle = PALETTE.k;
    ctx.fillText(t, x + 1, ty + 1);
    ctx.fillStyle = color;
    ctx.fillText(t, x, ty);
  };
  const box = (c: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = PALETTE[c] ?? c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };

  // Paletten just nu: tonar från förra miljön till den nya under FADE sekunder
  const palette = (): Palette => {
    const f = Math.min(1, Math.max(0, (eng.clock - switchAt) / FADE));
    const p = {} as Palette;
    for (const key of Object.keys(env.pal) as (keyof Palette)[]) p[key] = mix(fromPal[key], env.pal[key], f);
    return p;
  };

  function draw() {
    const pal = palette();
    const t = eng.clock;
    const dist = eng.dist;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textBaseline = "top";
    ctx.fillStyle = pal.sky;
    ctx.fillRect(0, 0, W, H);

    // Dekor (moln, droppstenar, hus, stjärnor) – varje plats i sin egen miljö
    decor.forEach((d, i) => ctx.drawImage(decorImg[d.env], Math.round(d.x), ENVS[d.env].decor.y[i]));

    // Trafikljuset vid korsningen längre fram: grönt, sedan rött ~1 s före bilraden
    for (const l of eng.lights) {
      if (t < l.on) continue;
      const red = t >= l.red;
      box("S", W - 11, 30, 1, GROUND - 30);
      box("k", W - 13, 16, 5, 14);
      box(red ? "r" : "Q", W - 12, 17, 3, 3);
      box("Q", W - 12, 21, 3, 3);
      box(red ? "Q" : "l", W - 12, 25, 3, 3);
    }

    ctx.fillStyle = pal.fill;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = pal.top;
    ctx.fillRect(0, GROUND, W, 3);
    ctx.fillStyle = pal.edge;
    ctx.fillRect(0, GROUND + 3, W, 1);
    ctx.fillStyle = pal.dot;
    const [dw, dh] = env.dot;
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(Math.round((((i * 23 - dist) % W) + W) % W), GROUND + 6 + ((i * 5) % 8), dw, dh);
    }

    for (const o of eng.obs) {
      const x = Math.round(o.x);
      if (x > W + 40) continue;
      const kd = o.k;
      if (kd.shot) {
        // Skeppet flyger in, siktar (blinkar) och skjuter; skottet är hindret
        const u = t - o.seen;
        if (u >= 0 && t < o.on + 0.5) {
          const sx = W - 22 * Math.min(1, u / 0.22);
          const sy = kd.y - 2 - Math.max(0, t - o.on) * 120;
          ctx.drawImage(img.ship, Math.round(sx), Math.round(sy));
          if (t < o.on && Math.floor(u * 12) % 2) box("y", sx - 2, kd.y + 1, 2, 1);
        }
        if (t < o.on) continue;
      }
      if (kd.drop && t < o.on) {
        const f = fallImg.get(kd)!;
        const u = o.on - t;
        if (kd.drop === "roof") {
          // Stalaktiten hänger i taket och droppar ~1 s, lossnar och faller 0,3 s
          const p = Math.max(0, 1 - u / 0.3);
          ctx.drawImage(f, x, Math.round((GROUND - f.height) * p * p));
          if (!p && u < 1.3) for (let i = 0; i < 3; i++) box("b", x + 3, 17 + ((t * 80 + i * 21) % (GROUND - 17)), 2, 2);
        } else if (u < 1) {
          // Meteoriten: skugga som växer ~1 s före nedslaget, stenen brant uppifrån
          const w = Math.round(2 + (kd.w - 2) * (1 - u));
          box("S", x + (kd.w - w) / 2, GROUND, w, 2);
          if (u < 0.6) ctx.drawImage(f, Math.round(x + 40 * u), Math.round((GROUND - 6) * (1 - u / 0.6)));
        }
        continue;
      }
      ctx.drawImage(look.get(kd)![o.k.f.length > 1 && Math.floor(dist / (kd.dive === undefined ? 12 : 5)) % 2 ? 1 : 0], x, Math.round(o.y));
      // Nedslaget: dammpuff
      if (kd.drop && t - o.on < 0.3) ctx.drawImage(puffs[Math.floor((t - o.on) * 10)], x, GROUND - 4);
      // Bilen som bromsar: bromsljus och rökpuff bakom
      if (o.braked !== undefined && t - o.braked < 0.6) {
        box("r", x + kd.w - 1, o.y + 4, 2, 2);
        if (Math.floor((t - o.braked) * 10) % 2) box("c", x + kd.w + 1, GROUND - 3, 3, 2);
      }
    }

    // Gubben blinkar under skyddstiden; springstegen följer sträckan (fortare i hög fart)
    if (!(eng.inv > 0 && Math.floor(eng.inv * 10) % 2)) {
      const g = eng.y > 0 ? img.jump : state === "run" && Math.floor(dist / 6) % 2 ? img.runA : img.runB;
      ctx.drawImage(g, RX, Math.round(GROUND - 10 - eng.y));
    }
    // Dubbelhoppets puff stannar där den blev till (rullar med marken)
    for (const p of eng.puffs) {
      const x = p.x - (distAt(t) - distAt(p.t));
      ctx.drawImage(puffs[Math.min(2, Math.floor(((t - p.t) / 0.4) * 3))], Math.round(x), Math.round(p.y));
    }

    for (let i = 0; i < LIVES; i++) ctx.drawImage(i < eng.lives ? img.heart : img.empty, 4 + i * 11, 4);
    text(String(score()).padStart(5, "0"), W - 4, 5, PALETTE.y, "right");
    if (state !== "idle") text(`LEVEL ${eng.level}`, W / 2, 5, PALETTE.c);
    // "LEVEL UP!" blinkar i 1,5 s vid byte
    if (state === "run" && t - levelUpAt < 1.5 && Math.floor((t - levelUpAt) * 6) % 2 === 0) {
      text("LEVEL UP!", W / 2, 30, PALETTE.y);
    }

    if (state === "idle") {
      text("Tryck för att spela", W / 2, 42, PALETTE.w);
    } else if (state === "pause") {
      text("Paus", W / 2, 34, PALETTE.b);
      text("Tryck = fortsätt", W / 2, 50, PALETTE.w);
    } else if (state === "over" && info.length) {
      // Med topplista: tätare rader, max 5 under poängen
      text("GAME OVER", W / 2, 14, PALETTE.r);
      text(`Poäng: ${score()}`, W / 2, 24, PALETTE.y);
      info.slice(0, 5).forEach(([s, c], i) => text(s, W / 2, 35 + i * 9, c));
      text("Tryck = spela igen", W / 2, 84, PALETTE.w);
    } else if (state === "over") {
      text("GAME OVER", W / 2, 22, PALETTE.r);
      text(`Poäng: ${score()}`, W / 2, 36, PALETTE.y);
      text("Tryck för att", W / 2, 52, PALETTE.w);
      text("spela igen", W / 2, 62, PALETTE.w);
    }
  }

  // Byt till levelns miljö: tona från paletten som syns just nu
  const setEnv = (fade: boolean) => {
    const next = envAt(eng.clock);
    if (next !== env) {
      fromPal = fade ? palette() : next.pal;
      switchAt = fade ? eng.clock : eng.clock - FADE;
      env = next;
    }
  };

  // Motorns händelser: ljud, levelbyte och game over
  const onEvent = (ev: EngineEvent) => {
    if (ev === "over") return gameOver();
    if (ev === "level") {
      setEnv(true);
      levelUpAt = eng.clock;
    }
    play(ev);
  };

  // Tidssteg från requestAnimationFrame, 0–50 ms: max så att en paus inte blir ett
  // hopp framåt, min 0 eftersom första bildrutans tidsstämpel kan ligga före
  // starten (då gick speltiden baklänges över en levelgräns). Uppdelat i delsteg
  // på högst 4 px: i hög fart skulle hindren annars hinna passera gubben mellan
  // två bildrutor utan att krocken märks.
  function loop(now: number) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    const n = Math.max(1, Math.ceil((eng.speed * dt) / 4));
    for (let i = 0; i < n && state === "run"; i++) eng.step(dt / n);
    for (const d of decor) {
      d.x -= eng.speed * dt * ENVS[d.env].decor.par;
      if (d.x < -32) {
        d.x += DECOR_SPAN;
        d.env = ENVS.indexOf(env);
      }
    }
    last = now;
    draw();
    sync();
    raf = state === "run" ? requestAnimationFrame(loop) : 0;
  }

  const run = () => {
    state = "run";
    last = performance.now();
    sync();
    draw();
    if (!raf) raf = requestAnimationFrame(loop);
  };

  const start = () => {
    eng = createEngine({ start: startClock, emit: (ev) => onEvent(ev) });
    levelUpAt = -9;
    setEnv(false);
    decor = decor.map((d) => ({ ...d, env: ENVS.indexOf(env) }));
    info = [];
    hooks.onStart();
    say("Tryck för att hoppa – tryck igen i luften för dubbelhopp.");
    run();
  };

  const pause = () => {
    if (state !== "run") return;
    state = "pause";
    cancelAnimationFrame(raf);
    raf = 0;
    sync();
    draw();
    say("Paus. Tryck för att fortsätta.");
  };

  function gameOver() {
    state = "over";
    lock = performance.now() + 700;
    const s = score();
    // Övningsläget (?level) påverkar varken rekord eller topplista
    const best = !practice && s > bestScore();
    if (best) {
      try {
        localStorage.setItem(BEST_KEY, String(s));
      } catch {
        // Privat läge m.m. – rekordet sparas inte
      }
    }
    if (!practice) hooks.onOver(s, best);
    play("gameover");
    say(`Game over. Poäng ${s}. Level ${eng.level}. Tryck för att spela igen.`);
  }

  // Hopp från marken, dubbelhopp i luften (motorn bestämmer vilket)
  const jump = () => {
    if (eng.press()) sync();
  };

  // Ett tryck utanför spelet (start, fortsätt, spela igen)
  const press = () => {
    if (held) return;
    if (state === "idle" || (state === "over" && performance.now() > lock)) start();
    else if (state === "pause") run();
  };

  // Under spel: hopp direkt vid nedtryck, och touch äts (touch-action: none via
  // .playing + preventDefault). Annars: bara ett riktigt tryck (inte en
  // scrollgest – den ger pointercancel) startar spelet.
  el.addEventListener("pointerdown", (e) => {
    if (state === "run") {
      e.preventDefault();
      jump();
    } else down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  el.addEventListener("pointerup", (e) => {
    const d = down;
    down = null;
    if (!d || state === "run") return;
    if (Math.abs(e.clientX - d.x) < 10 && Math.abs(e.clientY - d.y) < 10 && performance.now() - d.t < 600) press();
  });
  el.addEventListener("pointercancel", () => (down = null));
  el.addEventListener("touchstart", (e) => state === "run" && e.preventDefault(), { passive: false });
  el.addEventListener("keydown", (e) => {
    if (![" ", "Enter", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    if (state === "run") jump();
    else press();
  });

  // Pausa när spelet inte syns eller fliken döljs; fortsätter bara på tryck
  new IntersectionObserver(([en]) => en.isIntersecting || pause(), { threshold: 0.3 }).observe(el);
  document.addEventListener("visibilitychange", () => document.hidden && pause());

  // Testkrok: finns window.__gameHook (sätts bara av testsviten) får den läsa
  // motorn för pågående spel (höjd, hinder, fart, tid). Hopp görs ändå via
  // riktiga tryck.
  (window as unknown as { __gameHook?: (api: object) => void }).__gameHook?.({
    engine: () => eng,
    y: () => eng.y,
    obs: () => eng.obs,
    v: () => eng.speed,
    t: () => eng.clock,
  });

  window.addEventListener("resize", resize);
  // Pixelfonten laddas asynkront (se <head>): rita om när den kommit, annars står
  // texten i reservfonten tills nästa omritning. fonts.ready räcker inte – den kan
  // bli klar innan stilmallen ens har registrerat fonten.
  document.fonts?.addEventListener("loadingdone", () => state !== "run" && draw());
  resize();
  sync();
  return {
    info(lines: InfoLine[]) {
      info = lines;
      if (state === "over") draw();
    },
    hold(on: boolean) {
      held = on;
    },
  };
}
