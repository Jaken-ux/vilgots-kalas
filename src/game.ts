// Bonus level: ett litet springspel i <canvas>. Inga bibliotek.
// Spelet räknar i "spelpixlar" (W×H). Canvasen får bredden W·k enhetspixlar
// (k = heltal) och ritar med ctx.scale(k), så varje spelpixel blir exakt k×k
// skärmpixlar – skarpt även för text, utan uppskalning av en liten bild.
import { PALETTE, SPRITES } from "./sprites";

export type GameSound = "jump" | "ouch" | "gameover" | "coin";
type State = "idle" | "run" | "pause" | "over";

const W = 192;
const H = 96;
const GROUND = 80; // markens överkant
const RX = 24; // gubbens x
const LIVES = 3;
const BEST_KEY = "vilgots-kalas-best"; // per webbläsare, inte per gäst

// Gubben (8×10): två springsteg och ett hopp. Samma tecken som i sprites.ts.
const HEAD = ["..DDDD..", ".DDDDDD.", ".ppppkp.", ".pppppp.", "..pppp..", ".gggggg.", "pggggggp", ".GGGGGG."];
const RUN_A = [...HEAD, ".BB..BB.", "kk....kk"];
const RUN_B = [...HEAD, "..BBBB..", "..kkkk.."];
const JUMP = [...HEAD, ".BBBBBB.", ".k....k."];
const BUSH = ["...GGG....", ".GGgggGG..", "GgglggggG.", "GgggggglgG", "GggggggggG", "GGGGGGGGGG"];
const BLOCK = ["kkkkkkkk", "kwssssSk", "kssssssk", "kssSsssk", "ksssssSk", "kSssssSk", "kSSSSSSk", "kkkkkkkk"];
const BIRD_A = ["bb....bb", ".bbkbbb.", "..bbbbyy", "........"];
const BIRD_B = ["........", "..bkbbb.", ".bbbbbyy", "bb....bb"];

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

interface Obstacle {
  x: number;
  y: number;
  a: Img;
  b?: Img; // andra animationsrutan (fågeln)
}

export function bestScore(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function initGame(el: HTMLElement, play: (s: GameSound) => void, onBest: (n: number) => void) {
  const canvas = el.querySelector("canvas")!;
  const status = document.getElementById("game-status");
  const ctx = canvas.getContext("2d")!;
  const img = {
    runA: sprite(RUN_A), runB: sprite(RUN_B), jump: sprite(JUMP), bush: sprite(BUSH), block: sprite(BLOCK),
    birdA: sprite(BIRD_A), birdB: sprite(BIRD_B), cloud: sprite(SPRITES.cloud),
    heart: sprite(SPRITES.heart), empty: sprite(SPRITES["heart-empty"]),
  };

  let state: State = "idle";
  let k = 1;
  let y = 0; // höjd över marken
  let vy = 0;
  let speed = 0;
  let dist = 0;
  let gap = 0; // sträcka kvar till nästa hinder
  let lives = LIVES;
  let inv = 0; // skyddstid efter en krock
  let obs: Obstacle[] = [];
  let raf = 0;
  let last = 0;
  let lock = 0; // ingen omstart direkt efter game over (ett hopptryck ska inte starta om)
  let jumps = 0;
  let down: { x: number; y: number; t: number } | null = null;

  const score = () => Math.floor(dist / 10);

  // Läge och siffror som data-attribut: för CSS (touch-action) och testerna
  const sync = () => {
    el.dataset.state = state;
    el.dataset.lives = String(lives);
    el.dataset.score = String(score());
    el.dataset.jumps = String(jumps);
    el.classList.toggle("playing", state === "run");
  };
  const say = (t: string) => status && (status.textContent = t);

  // Heltalsskala i enhetspixlar som ryms i föräldern
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const room = (el.parentElement?.clientWidth || W) - 8; // minus pixelramen
    k = Math.max(1, Math.floor((room * dpr) / W));
    canvas.width = W * k;
    canvas.height = H * k;
    canvas.style.width = `${(W * k) / dpr}px`;
    canvas.style.height = `${(H * k) / dpr}px`;
    draw();
  };

  const text = (t: string, x: number, ty: number, color: string, align: CanvasTextAlign = "center") => {
    ctx.textAlign = align;
    ctx.fillStyle = PALETTE.k;
    ctx.fillText(t, x + 1, ty + 1);
    ctx.fillStyle = color;
    ctx.fillText(t, x, ty);
  };

  function draw() {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#10162C";
    ctx.fillRect(0, 0, W, H);

    // Moln och mark rullar med olika fart (parallax)
    for (let i = 0; i < 3; i++) {
      const cx = ((((i * 80 - dist * 0.3) % (W + 32)) + W + 32) % (W + 32)) - 16;
      ctx.drawImage(img.cloud, Math.round(cx), 14 + i * 9);
    }
    ctx.fillStyle = PALETTE.d;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = PALETTE.g;
    ctx.fillRect(0, GROUND, W, 3);
    ctx.fillStyle = PALETTE.G;
    ctx.fillRect(0, GROUND + 3, W, 1);
    ctx.fillStyle = PALETTE.D;
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(Math.round((((i * 23 - dist) % W) + W) % W), GROUND + 6 + ((i * 5) % 8), 2, 2);
    }

    const flap = Math.floor(dist / 12) % 2 === 0;
    for (const o of obs) ctx.drawImage(o.b && flap ? o.b : o.a, Math.round(o.x), o.y);

    // Gubben blinkar under skyddstiden
    if (!(inv > 0 && Math.floor(inv * 10) % 2)) {
      const g = y > 0 ? img.jump : state === "run" && Math.floor(dist / 6) % 2 ? img.runA : img.runB;
      ctx.drawImage(g, RX, Math.round(GROUND - 10 - y));
    }

    for (let i = 0; i < LIVES; i++) ctx.drawImage(i < lives ? img.heart : img.empty, 4 + i * 11, 4);
    text(String(score()).padStart(5, "0"), W - 4, 5, PALETTE.y, "right");

    if (state === "idle") {
      text("Bonus level", W / 2, 34, PALETTE.n);
      text("Tryck för att spela", W / 2, 50, "#FFFFFF");
    } else if (state === "pause") {
      text("Paus", W / 2, 34, PALETTE.b);
      text("Tryck = fortsätt", W / 2, 50, "#FFFFFF");
    } else if (state === "over") {
      text("GAME OVER", W / 2, 22, PALETTE.r);
      text(`Poäng: ${score()}`, W / 2, 36, PALETTE.y);
      text("Tryck för att", W / 2, 52, "#FFFFFF");
      text("spela igen", W / 2, 62, "#FFFFFF");
    }
  }

  const spawn = () => {
    const r = Math.random();
    if (dist > 1500 && r < 0.25) {
      // Fågel: låg (måste hoppas över) eller hög (träffar mitt i ett hopp)
      obs.push({ x: W, y: Math.random() < 0.5 ? GROUND - 13 : GROUND - 30, a: img.birdA, b: img.birdB });
    } else {
      const a = r < 0.6 ? img.bush : img.block;
      obs.push({ x: W, y: GROUND - a.height, a });
    }
  };

  const hit = (o: Obstacle) => {
    const top = GROUND - 10 - y;
    return RX + 7 > o.x + 1 && RX + 1 < o.x + o.a.width - 1 && top + 10 > o.y + 1 && top + 1 < o.y + o.a.height - 1;
  };

  function step(dt: number) {
    const before = score();
    speed = Math.min(170, speed + 2 * dt); // farten ökar sakta
    dist += speed * dt;
    if (y > 0 || vy > 0) {
      vy -= 900 * dt;
      y = Math.max(0, y + vy * dt);
      if (y === 0) vy = 0;
    }
    for (const o of obs) o.x -= speed * dt;
    obs = obs.filter((o) => o.x > -16);
    gap -= speed * dt;
    if (gap <= 0) {
      spawn();
      gap = speed * (0.9 + Math.random() * 0.9) + 30;
    }
    if (inv > 0) inv -= dt;
    else if (obs.some(hit)) {
      lives--;
      if (!lives) return gameOver();
      inv = 1.2;
      play("ouch");
    }
    if (Math.floor(score() / 100) > Math.floor(before / 100)) play("coin");
  }

  // Fast tidssteg från requestAnimationFrame (max 50 ms, så att en paus inte blir ett hopp framåt)
  function loop(now: number) {
    step(Math.min(0.05, (now - last) / 1000));
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
    speed = 70;
    gap = 60;
    lives = LIVES;
    inv = 0;
    obs = [];
    say("Spelet har startat. Tryck för att hoppa.");
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
    if (s > bestScore()) {
      try {
        localStorage.setItem(BEST_KEY, String(s));
      } catch {
        // Privat läge m.m. – rekordet sparas inte
      }
      onBest(s);
    }
    play("gameover");
    say(`Game over. Poäng ${s}. Tryck för att spela igen.`);
  }

  const jump = () => {
    if (y > 0) return;
    vy = 260;
    y = 0.01;
    jumps++;
    sync();
    play("jump");
  };

  // Ett tryck utanför spelet (start, fortsätt, spela igen)
  const press = () => {
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

  window.addEventListener("resize", resize);
  // Pixelfonten laddas asynkront (se <head>): rita om när den kommit, annars står
  // texten i reservfonten tills nästa omritning. fonts.ready räcker inte – den kan
  // bli klar innan stilmallen ens har registrerat fonten.
  document.fonts?.addEventListener("loadingdone", () => state !== "run" && draw());
  resize();
  sync();
}
