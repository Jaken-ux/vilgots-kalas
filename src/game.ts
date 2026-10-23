// Bonus level: ett litet springspel i <canvas>. Inga bibliotek.
// Spelet räknar i "spelpixlar" (W×H). Canvasen får bredden W·k enhetspixlar
// (k = heltal) och ritar med ctx.scale(k), så varje spelpixel blir exakt k×k
// skärmpixlar – skarpt även för text, utan uppskalning av en liten bild.
// Miljöerna (gräs, grotta, stad, rymd) och deras hinder finns i levels.ts.
import { PALETTE, SPRITES } from "./sprites";
import { ENVS, GROUND, DIVE_TOP, DIVE_LOW, type Kind, type Palette } from "./levels";

export type { Kind } from "./levels";
export type GameSound = "jump" | "ouch" | "gameover" | "coin" | "level";
type State = "idle" | "run" | "pause" | "over";

const W = 192;
const H = 96;
const RX = 24; // gubbens x
const LIVES = 3;
const BEST_KEY = "vilgots-kalas-best"; // per webbläsare, inte per gäst
const LEVEL_SECONDS = 30; // ny level var 30:e sekund
const FADE = 1; // sekunder för övergången till nästa miljö

// Fart i spelpixlar/s efter t sekunders spel, utan tak. Över ~1 193 px/s syns de
// höga hindren för sent för att hinna hoppa (se jumpWindow och SIGHT); för en
// spelare med 60 bildrutor/s redan vid ~1 060 px/s, eftersom hindret hinner flytta
// sig en bildruta innan det syns. Det nås efter ~177 s, så spelet tar alltid slut,
// även för en perfekt spelare, efter 3–4 minuter. 30 s: 150, 60 s: 270, 90 s: 430.
export const vAt = (t: number) => 70 + 2 * t + 0.022 * t * t;
// Hinder kommer in i högerkanten: så långt bort (d) syns de först
export const SIGHT = W - RX - 6;

// Hopp: utgångsfart och gravitation ger 0,58 s i luften och 37 px topphöjd
const V0 = 260;
const GRAV = 900;
const AIR = (2 * V0) / GRAV;

// Grästypen, för testsviten (alla miljöer har samma höjdklasser)
export const KINDS = ENVS[0].kinds;
type Name = keyof typeof KINDS;
// Blandningen efter uppvärmningen: [typ, kumulativ sannolikhet]
const MIX = "bush block big pillar bird dive swoop".split(" ") as Name[];
const ODDS = [0.2, 0.35, 0.55, 0.7, 0.8, 0.9, 1];

// Gubben (8×10): två springsteg och ett hopp. Samma tecken som i sprites.ts.
const HEAD = ["..DDDD..", ".DDDDDD.", ".ppppkp.", ".pppppp.", "..pppp..", ".gggggg.", "pggggggp", ".GGGGGG."];
const RUN_A = [...HEAD, ".BB..BB.", "kk....kk"];
const RUN_B = [...HEAD, "..BBBB..", "..kkkk.."];
const JUMP = [...HEAD, ".BBBBBB.", ".k....k."];

// Avstånd d = hindrets x - (RX + 6): vid d < 0 överlappar hindret gubben i sidled,
// under w + 4 px. Krocken undviks om gubben då är minst c px upp.
const clearance = (k: Kind) => GROUND - k.y - 1;

// Hoppfönster [tidigast, senast] uttryckt som d vid avstampet, vid fart v.
// För "stand"-hinder: gubben ska stå på marken när d = 0 och kan hoppa igen
// först när d = -(w + 4).
export function jumpWindow(k: Kind, v: number): [number, number] {
  if (k.stand) return [0, -(k.w + 4)];
  const s = Math.sqrt(V0 * V0 - 2 * GRAV * clearance(k));
  return [(v * (V0 - s)) / GRAV, (v * (V0 + s)) / GRAV - (k.w + 4)];
}

// Minsta avstånd mellan två hinders vänsterkanter så att b alltid går att klara
// efter a: a hoppas så tidigt som möjligt, och vid landningen får b inte ha
// passerat sitt senaste avstamp.
export function minGap(a: Kind, b: Kind, v: number): number {
  return (a.stand ? 0 : v * AIR) - jumpWindow(a, v)[1] + jumpWindow(b, v)[0];
}

// Slumpat avstånd (r = 0..1) – aldrig under minGap plus marginal för reaktion.
// dens (0..1] gör hindren tätare: krymper den slumpade delen, aldrig minimumet.
// Par: två låga hinder där andra hoppet görs direkt vid landning.
export function nextGap(a: Kind, b: Kind, v: number, r: number, pair: boolean, dens = 1): number {
  const min = minGap(a, b, v);
  if (pair) return Math.max(min + 4, v * AIR + 4);
  return Math.max(min + v * 0.3 * dens + 6, v * (AIR + (0.15 + 0.85 * r) * dens));
}

// Täthet efter speltid: tätare med tiden, och 25 % tätare per varv genom miljöerna
export const density = (t: number) =>
  Math.max(0.35, 1 - t / 240) * 0.75 ** Math.floor(t / (LEVEL_SECONDS * ENVS.length));

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

interface Obstacle {
  x: number;
  y: number;
  k: Kind;
  a: Img;
  b?: Img; // andra animationsrutan (flygarna)
}

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
    runA: sprite(RUN_A), runB: sprite(RUN_B), jump: sprite(JUMP),
    heart: sprite(SPRITES.heart), empty: sprite(SPRITES["heart-empty"]),
  };
  const look = new Map(ENVS.flatMap((e) => Object.values(e.kinds)).map((k) => [k, k.f.map(sprite)]));
  const decorImg = ENVS.map((e) => sprite(e.decor.f));

  // Dolt ?level=N (även decimaler, t.ex. 1.9): börja på level N med rätt fart.
  // Övningsläge: varken rekord eller topplista påverkas.
  const startLevel = Math.max(1, Number(new URLSearchParams(location.search).get("level")) || 1);
  const practice = startLevel !== 1;

  let state: State = "idle";
  let k = 1;
  let y = 0; // höjd över marken
  let vy = 0;
  let speed = vAt(0);
  let dist = 0;
  let clock = 0; // speltid i sekunder (står still i paus)
  let level = 1;
  let env = 0; // nuvarande miljö (index i ENVS)
  let fromPal: Palette = ENVS[0].pal; // palett vid senaste miljöbytet
  let switchAt = -FADE; // när miljöbytet började
  let levelUpAt = -9; // när "LEVEL UP!" ska blinka
  let gap = 0; // sträcka kvar till nästa hinder
  let next: Name = "bush"; // nästa hinder som ska komma in
  let lives = LIVES;
  let inv = 0; // skyddstid efter en krock
  let obs: Obstacle[] = [];
  let decor: Decor[] = [0, 1, 2, 3].map((i) => ({ x: i * 64, env: 0 }));
  let raf = 0;
  let last = 0;
  let lock = 0; // ingen omstart direkt efter game over (ett hopptryck ska inte starta om)
  let jumps = 0;
  let down: { x: number; y: number; t: number } | null = null;
  let info: InfoLine[] = []; // topplistan på game over-skärmen
  let held = false; // en fråga visas ovanpå spelet: ingen omstart

  const score = () => Math.floor(dist / 10);
  const levelAt = (t: number) => Math.floor(t / LEVEL_SECONDS) + 1;
  const envOf = (lvl: number) => (lvl - 1) % ENVS.length;

  // Läge och siffror som data-attribut: för CSS (touch-action) och testerna
  const sync = () => {
    el.dataset.state = state;
    el.dataset.lives = String(lives);
    el.dataset.score = String(score());
    el.dataset.jumps = String(jumps);
    el.dataset.level = String(level);
    el.dataset.env = ENVS[env].name;
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

  // Paletten just nu: tonar från förra miljön till den nya under FADE sekunder
  const palette = (): Palette => {
    const f = Math.min(1, Math.max(0, (clock - switchAt) / FADE));
    const to = ENVS[env].pal;
    const p = {} as Palette;
    for (const key of Object.keys(to) as (keyof Palette)[]) p[key] = mix(fromPal[key], to[key], f);
    return p;
  };

  function draw() {
    const pal = palette();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textBaseline = "top";
    ctx.fillStyle = pal.sky;
    ctx.fillRect(0, 0, W, H);

    // Dekor (moln, droppstenar, hus, stjärnor) – varje plats i sin egen miljö
    decor.forEach((d, i) => ctx.drawImage(decorImg[d.env], Math.round(d.x), ENVS[d.env].decor.y[i]));

    ctx.fillStyle = pal.fill;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = pal.top;
    ctx.fillRect(0, GROUND, W, 3);
    ctx.fillStyle = pal.edge;
    ctx.fillRect(0, GROUND + 3, W, 1);
    ctx.fillStyle = pal.dot;
    const [dw, dh] = ENVS[env].dot;
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(Math.round((((i * 23 - dist) % W) + W) % W), GROUND + 6 + ((i * 5) % 8), dw, dh);
    }

    for (const o of obs) {
      // Dykaren slår med vingarna 2,4 gånger så tätt som den raka flygaren
      const flap = Math.floor(dist / (o.k.dive === undefined ? 12 : 5)) % 2;
      ctx.drawImage(o.b && flap ? o.b : o.a, Math.round(o.x), Math.round(o.y));
    }

    // Gubben blinkar under skyddstiden; springstegen följer sträckan (fortare i hög fart)
    if (!(inv > 0 && Math.floor(inv * 10) % 2)) {
      const g = y > 0 ? img.jump : state === "run" && Math.floor(dist / 6) % 2 ? img.runA : img.runB;
      ctx.drawImage(g, RX, Math.round(GROUND - 10 - y));
    }

    for (let i = 0; i < LIVES; i++) ctx.drawImage(i < lives ? img.heart : img.empty, 4 + i * 11, 4);
    text(String(score()).padStart(5, "0"), W - 4, 5, PALETTE.y, "right");
    if (state !== "idle") text(`LEVEL ${level}`, W / 2, 5, PALETTE.c);
    // "LEVEL UP!" blinkar i 1,5 s vid byte
    if (state === "run" && clock - levelUpAt < 1.5 && Math.floor((clock - levelUpAt) * 6) % 2 === 0) {
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
      info.slice(0, 5).forEach(([t, c], i) => text(t, W / 2, 35 + i * 9, c));
      text("Tryck = spela igen", W / 2, 84, PALETTE.w);
    } else if (state === "over") {
      text("GAME OVER", W / 2, 22, PALETTE.r);
      text(`Poäng: ${score()}`, W / 2, 36, PALETTE.y);
      text("Tryck för att", W / 2, 52, PALETTE.w);
      text("spela igen", W / 2, 62, PALETTE.w);
    }
  }

  // Vilket hinder som helst får komma – avståndet till nästa räknas alltid ut så
  // att det går att klara (nextGap). Fåglar och de svåra hindren kommer efter en stund.
  const pick = (): Name => {
    const r = Math.random();
    if (dist < 800) return r < 0.4 ? "bush" : r < 0.7 ? "block" : "big";
    return MIX[ODDS.findIndex((p) => r < p)];
  };

  const spawn = () => {
    const kinds = ENVS[env].kinds;
    const k = kinds[next];
    const [a, b] = look.get(k)!;
    obs.push({ x: W, y: k.y, k, a, b });
    // Fart när nästa hinder når gubben (om 3 s, högre än nu) – ger aldrig för kort avstånd
    const v = vAt(clock + 3);
    const pair = !!k.pair && Math.random() < 0.2 && !obs[obs.length - 2]?.k.pair;
    next = pair ? (Math.random() < 0.5 ? "bush" : "block") : pick();
    gap = nextGap(k, kinds[next], v, Math.random(), pair, density(clock));
  };

  const hit = (o: Obstacle) => {
    const top = GROUND - 10 - y;
    return RX + 7 > o.x + 1 && RX + 1 < o.x + o.k.w - 1 && top + 10 > o.y + 1 && top + 1 < o.y + o.k.h - 1;
  };

  // Byt till levelns miljö: tona från paletten som syns just nu
  const setLevel = (lvl: number, fade: boolean) => {
    const e = envOf(lvl);
    if (e !== env) {
      fromPal = fade ? palette() : ENVS[e].pal;
      switchAt = fade ? clock : clock - FADE;
      env = e;
    }
    level = lvl;
  };

  function step(dt: number) {
    const before = score();
    clock += dt;
    speed = vAt(clock);
    dist += speed * dt;
    if (levelAt(clock) !== level) {
      setLevel(levelAt(clock), true);
      levelUpAt = clock;
      play("level");
    }
    if (y > 0 || vy > 0) {
      vy -= GRAV * dt;
      y = Math.max(0, y + vy * dt);
      if (y === 0) vy = 0;
    }
    for (const o of obs) {
      o.x -= speed * dt;
      // Dykaren: från DIVE_TOP ner till huvudhöjd, klar vid d = dive
      if (o.k.dive !== undefined) {
        const f = Math.min(1, Math.max(0, (o.x - RX - 6 - o.k.dive) / 60));
        o.y = DIVE_LOW - (DIVE_LOW - DIVE_TOP) * f;
      }
    }
    obs = obs.filter((o) => o.x > -o.k.w);
    for (const d of decor) {
      d.x -= speed * dt * ENVS[d.env].decor.par;
      if (d.x < -32) {
        d.x += DECOR_SPAN;
        d.env = env;
      }
    }
    gap -= speed * dt;
    if (gap <= 0) spawn();
    if (inv > 0) inv -= dt;
    else if (obs.some(hit)) {
      lives--;
      if (!lives) return gameOver();
      inv = 1.2;
      play("ouch");
    }
    if (Math.floor(score() / 100) > Math.floor(before / 100)) play("coin");
  }

  // Tidssteg från requestAnimationFrame, 0–50 ms: max så att en paus inte blir ett
  // hopp framåt, min 0 eftersom första bildrutans tidsstämpel kan ligga före
  // starten (då gick speltiden baklänges över en levelgräns). Uppdelat i delsteg
  // på högst 4 px: i hög fart skulle hindren annars hinna passera gubben mellan
  // två bildrutor utan att krocken märks.
  function loop(now: number) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    const n = Math.max(1, Math.ceil((speed * dt) / 4));
    for (let i = 0; i < n && state === "run"; i++) step(dt / n);
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
    y = vy = dist = 0;
    clock = (startLevel - 1) * LEVEL_SECONDS;
    speed = vAt(clock);
    levelUpAt = -9;
    setLevel(levelAt(clock), false);
    decor = decor.map((d) => ({ ...d, env }));
    gap = 60;
    next = "bush";
    lives = LIVES;
    inv = 0;
    obs = [];
    info = [];
    hooks.onStart();
    say("Tryck för att hoppa.");
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
    say(`Game over. Poäng ${s}. Level ${level}. Tryck för att spela igen.`);
  }

  const jump = () => {
    if (y > 0) return;
    vy = V0;
    y = 0.01;
    jumps++;
    sync();
    play("jump");
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
  // gubbens höjd, hindren och farten. Hopp görs ändå via riktiga tryck.
  (window as unknown as { __gameHook?: (api: object) => void }).__gameHook?.({
    y: () => y,
    obs: () => obs,
    v: () => speed,
    t: () => clock,
    win: jumpWindow,
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
