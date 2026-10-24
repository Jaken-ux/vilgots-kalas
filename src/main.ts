import { content, staticText, staticHref, seeYouText } from "./content";
import { spriteSvg } from "./sprites";
import { initGame, bestScore } from "./game";
import { initLeaderboard } from "./leaderboard";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import confetti from "canvas-confetti";

gsap.registerPlugin(ScrollTrigger);

const $ = <T extends HTMLElement>(sel: string) =>
  document.querySelector<T>(sel)!;
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
// Pixelkänsla: rörelser hackar fram i steg i stället för att glida
const PX = "steps(5)";

// ===== STORAGE KEYS =====
const STORAGE_PREFIX = "vilgots-kalas-rsvp";

// Gästens namn från ?g, rensat (samma regler för hälsning, förifyllning och nyckel)
function guestName(): string {
  const g = new URLSearchParams(window.location.search).get("g") ?? "";
  return g.slice(0, 30).replace(/[<>&"'/]/g, "").trim();
}

// OSA-svaret sparas per gäst i denna webbläsare: vilgots-kalas-rsvp:<namn i
// gemener>, eller :default utan ?g. Annars visas t.ex. ett svar gjort via
// ?g=Vilgot som "Ni har svarat" för alla andra ?g på samma telefon.
function rsvpKey(): string {
  return `${STORAGE_PREFIX}:${guestName().toLowerCase() || "default"}`;
}
const MUTE_KEY = "vilgots-kalas-mute";

// ===== GREETING =====
function initGreeting() {
  const safe = guestName();
  if (safe) {
    // "...och Emma är bjuden på" – och barnets namn förifylls i OSA
    const el = $("#invitee");
    if (el) el.textContent = safe;
    const nameField = $<HTMLInputElement>("#field-name");
    if (nameField) nameField.value = safe;
  }
}

// ===== STARS =====
function createStars() {
  const container = $("#stars");
  if (!container) return;
  const count = 40;
  const tweens: gsap.core.Tween[] = [];
  for (let i = 0; i < count; i++) {
    const star = document.createElement("div");
    star.className = "star";
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    const size = Math.random() < 0.25 ? 4 : 2;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    container.appendChild(star);

    if (!reducedMotion) {
      tweens.push(
        gsap.to(star, {
          opacity: 0.4 + Math.random() * 0.6,
          duration: 1 + Math.random() * 2,
          delay: Math.random() * 3,
          repeat: -1,
          yoyo: true,
          ease: "steps(2)",
        })
      );
    } else {
      star.style.opacity = `${0.3 + Math.random() * 0.5}`;
    }
  }

  // Pausa blinkandet när titelskärmen är utom synhåll – sparar CPU under scroll
  if (tweens.length) {
    ScrollTrigger.create({
      trigger: "#intro",
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) =>
        tweens.forEach((t) => (self.isActive ? t.resume() : t.pause())),
    });
  }
}

// ===== POPULATE CONTENT =====
function daysLeft(): number {
  const partyDate = new Date(content.party.dateISO + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((partyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function populateContent() {
  // Fasta texter och länkar finns redan i HTML:en (ifyllda vid bygget, se
  // vite.config.ts). Sätts igen här så att dev och bygge alltid stämmer.
  for (const [id, text] of Object.entries(staticText())) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  for (const [id, href] of Object.entries(staticHref())) {
    const el = document.getElementById(id) as HTMLAnchorElement | null;
    if (el) el.href = href;
  }
  const formSubject = $<HTMLInputElement>("#form-subject");
  if (formSubject) formSubject.value = content.rsvp.subject;

  // Nedräkningen beror på dagens datum och kräver JS. Siffrorna rullas fram
  // av initAnimations(); skärmläsare får hela texten direkt.
  const countdownEl = $("#countdown");
  if (countdownEl) {
    const diff = daysLeft();
    if (diff > 0) {
      const digits = String(diff)
        .split("")
        .map(() => '<span class="cd-digit">0</span>')
        .join("");
      countdownEl.innerHTML =
        `<span class="sr-only">${diff} dagar kvar!</span>` +
        `<span class="cd-row" aria-hidden="true"><span class="cd-coin">${spriteSvg("coin", 4)}</span>` +
        `<span class="cd-x">×</span><span class="cd-digits" data-target="${diff}">${digits}</span></span>` +
        `<span class="cd-label" aria-hidden="true">${diff === 1 ? "dag" : "dagar"} kvar</span>`;
    } else {
      countdownEl.classList.add("countdown-text");
      countdownEl.textContent =
        diff === 0 ? "Kalaset är idag!" : "Kalaset har varit – tack för att ni kom!";
    }
  }
}

// Myntverket: räknar upp från 0 till antal dagar kvar
function rollCountdown() {
  const box = document.querySelector<HTMLElement>(".cd-digits");
  if (!box) return;
  const target = Number(box.dataset.target);
  const cells = Array.from(box.children) as HTMLElement[];
  const show = (v: number) => {
    const s = String(Math.round(v)).padStart(cells.length, "0");
    cells.forEach((c, i) => (c.textContent = s[i]));
  };
  if (reducedMotion) return show(target);
  const n = { v: 0 };
  gsap.to(n, {
    v: target,
    duration: 1.2,
    ease: `steps(${Math.min(target, 14)})`,
    onUpdate: () => show(n.v),
    onComplete: () => show(target),
  });
}

// ===== ANIMATIONS =====
function initAnimations() {
  // Titelskärmen: ramen poppar fram i pixelsteg, sedan text och HUD
  if (reducedMotion) {
    gsap.set([".hero-frame", ".title", ".subtitle", ".press-start", ".hud"], { opacity: 1 });
  } else {
    gsap.fromTo(".hero-frame", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.2, ease: "steps(4)" });
    gsap.fromTo(".title", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.6, ease: PX });
    gsap.to(".subtitle", { opacity: 1, duration: 0.4, delay: 0.9, ease: "steps(3)" });
    gsap.to(".hud", { opacity: 1, duration: 0.3, delay: 1.1, ease: "steps(2)" });
    gsap.to(".press-start", { opacity: 1, duration: 0.2, delay: 1.3, ease: "steps(1)" });
  }

  // Allt med klassen .reveal hoppar upp i steg när det kommer in i bild
  gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => {
        if (reducedMotion) gsap.set(el, { opacity: 1 });
        else gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, ease: PX });
      },
    });
  });

  ScrollTrigger.create({
    trigger: "#countdown",
    start: "top 90%",
    once: true,
    onEnter: () => {
      gsap.to("#countdown", { opacity: 1, duration: reducedMotion ? 0.01 : 0.3, ease: "steps(2)" });
      rollCountdown();
    },
  });

  // Outro
  const creditsLines = document.querySelectorAll(".credits-line");
  creditsLines.forEach((line, i) => {
    ScrollTrigger.create({
      trigger: line,
      start: "top 92%",
      once: true,
      onEnter: () => {
        gsap.to(line, {
          opacity: 1,
          duration: reducedMotion ? 0.2 : 0.4,
          delay: reducedMotion ? 0 : i * 0.25,
          ease: "steps(3)",
        });
      },
    });
  });

  ScrollTrigger.create({
    trigger: ".outro-controls",
    start: "top 95%",
    once: true,
    onEnter: () => {
      gsap.to(".outro-controls", { opacity: 1, duration: reducedMotion ? 0.2 : 0.4, ease: "steps(2)" });
    },
  });
}

// PRESS START är en vanlig länk till #act-when (fungerar utan JS) – här bara ljud
function initPressStart() {
  $("#press-start").addEventListener("click", () => playSound("blip"));
}

// ===== SKYLTEN OCH KARTAN =====
function initSignpost() {
  const btn = $("#signpost");
  const board = $("#sign-board");
  const card = $("#address-card");
  const hint = $("#tap-hint");
  let isOpen = false;
  btn.setAttribute("aria-expanded", "false");

  // Liten vagga på skylten var 4:e sekund tills den trycks första gången.
  // Körs bara när sektionen syns.
  let wobble: gsap.core.Timeline | null = null;
  if (!reducedMotion) {
    wobble = gsap
      .timeline({ paused: true, repeat: -1, repeatDelay: 3.4, delay: 1 })
      .to(board, { rotation: 4, duration: 0.15, ease: "steps(1)" })
      .to(board, { rotation: -4, duration: 0.15, ease: "steps(1)" })
      .to(board, { rotation: 0, duration: 0.15, ease: "steps(1)" });
    ScrollTrigger.create({
      trigger: "#act-where",
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => {
        if (!wobble) return;
        if (self.isActive) wobble.resume();
        else wobble.pause();
      },
    });
  }

  btn.addEventListener("click", () => {
    if (wobble) {
      wobble.kill();
      wobble = null;
      gsap.set(board, { rotation: 0 });
    }
    isOpen = !isOpen;
    card.classList.toggle("open", isOpen);
    btn.setAttribute("aria-expanded", String(isOpen));
    hint.textContent = isOpen ? "Följ kartan till X!" : "Tryck på skylten för kartan";
    if (!reducedMotion) {
      gsap.fromTo(board, { y: 0 }, { keyframes: { y: [-6, 0] }, duration: 0.2, ease: "steps(2)" });
    }
    playSound("blip", { rate: isOpen ? 1 : 0.75 });
  });
}

// ===== SOUND =====
let audioCtx: AudioContext | null = null;
let isMuted = localStorage.getItem(MUTE_KEY) === "true";

// Visas med ?debug=1: har första upplåsningen (tyst buffer i ett tryck) gett
// en kontext som kör?
let unlockState = "inget tryck än";

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // iOS pausar kontexten (t.ex. efter appbyte) – väck den igen
  if (audioCtx.state !== "running") audioCtx.resume().catch(() => {});
  return audioCtx;
}

(window as unknown as { __audio?: () => string }).__audio = () =>
  `AudioContext.state=${audioCtx?.state ?? "(ej skapad)"} · mute=${isMuted} (sparat: ${localStorage.getItem(MUTE_KEY)}) · upplåsning: ${unlockState}`;

// iOS Safari: AudioContext måste skapas/resume():as inom en user gesture,
// annars förblir den suspended. Lås upp på varje tryck (billigt när den redan
// kör) så att även ljud som spelas senare – t.ex. level up efter OSA-svaret,
// som kommer efter ett nätverksanrop – fungerar. Skapas aldrig vid sidladdning.
function initAudioUnlock() {
  const unlock = () => {
    if (audioCtx?.state === "running") return;
    try {
      const ctx = getAudioCtx();
      // Tyst buffer: äldre iOS låser upp ljudet först när något faktiskt spelas
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
      if (unlockState !== "ja") {
        const t = performance.now();
        unlockState = "väntar på running";
        ctx.resume().then(
          () => (unlockState = ctx.state === "running" ? `ja (${Math.round(performance.now() - t)} ms)` : `nej (state=${ctx.state})`),
          (e) => (unlockState = `nej (${e})`)
        );
      }
    } catch (e) {
      unlockState = `nej (${e})`;
    }
  };
  for (const type of ["touchend", "pointerup", "click", "keydown"]) {
    document.addEventListener(type, unlock, { capture: true, passive: true });
  }
}

// 8-bitarsljud syntetiseras direkt med Web Audio (fyrkant- och triangelvågor
// med korta envelopes) – inga ljudfiler att ladda.
type SoundName = "blip" | "coin" | "dig" | "chest" | "ouch" | "gameover" | "levelup" | "equip" | "jump" | "double" | "level" | "crunch" | "life";
const MASTER_VOLUME = 0.22;

interface Note {
  f: number; // Hz
  to?: number; // glid till Hz
  at: number; // start, s efter ljudets början
  dur: number;
  type?: OscillatorType;
  vol?: number;
}

function note(ctx: AudioContext, out: AudioNode, t0: number, r: number, n: Note) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const s = t0 + n.at;
  const vol = n.vol ?? 0.5;
  osc.type = n.type ?? "square";
  osc.frequency.setValueAtTime(n.f * r, s);
  if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to * r, s + n.dur);
  g.gain.setValueAtTime(0.0001, s);
  g.gain.linearRampToValueAtTime(vol, s + 0.005);
  g.gain.setValueAtTime(vol, s + n.dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, s + n.dur);
  osc.connect(g);
  g.connect(out);
  osc.start(s);
  osc.stop(s + n.dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
// Kort brusknaster genom ett bandpassfilter (grävljudet)
function crackle(ctx: AudioContext, out: AudioNode, t0: number, at: number, dur: number, freq: number) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  const s = t0 + at;
  g.gain.setValueAtTime(0.9, s);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start(s);
  src.stop(s + dur + 0.02);
}

const arp = (fs: number[], step: number, dur: number, vol: number, at = 0): Note[] =>
  fs.map((f, i) => ({ f, at: at + i * step, dur, vol }));

const SYNTHS: Record<SoundName, (ctx: AudioContext, out: AudioNode, t0: number, r: number) => void> = {
  // Kort knapptryck
  blip: (c, o, t, r) => note(c, o, t, r, { f: 660, to: 880, at: 0, dur: 0.06, vol: 0.35 }),
  // Mynt-pling: två toner uppåt
  coin: (c, o, t, r) => {
    note(c, o, t, r, { f: 988, at: 0, dur: 0.07 });
    note(c, o, t, r, { f: 1319, at: 0.07, dur: 0.3 });
  },
  // Gräv-knaster: tre brusknaster och en dov duns
  dig: (c, o, t, r) => {
    crackle(c, o, t, 0, 0.05, 1800 * r);
    crackle(c, o, t, 0.07, 0.05, 1200 * r);
    crackle(c, o, t, 0.14, 0.09, 800 * r);
    note(c, o, t, r, { f: 140, to: 60, at: 0, dur: 0.14, type: "triangle", vol: 0.8 });
  },
  // Kist-fanfar: arpeggio upp och en hållen ton med bas, sedan glitter
  chest: (c, o, t, r) => {
    arp([523, 659, 784], 0.08, 0.09, 0.4).forEach((n) => note(c, o, t, r, n));
    note(c, o, t, r, { f: 1047, at: 0.24, dur: 0.4, vol: 0.4 });
    note(c, o, t, r, { f: 262, at: 0.24, dur: 0.4, type: "triangle", vol: 0.7 });
    note(c, o, t, r, { f: 2093, at: 0.42, dur: 0.05, vol: 0.15 });
    note(c, o, t, r, { f: 2637, at: 0.5, dur: 0.05, vol: 0.15 });
  },
  // Ouch: snabbt fall nedåt
  ouch: (c, o, t, r) => {
    note(c, o, t, r, { f: 700, to: 180, at: 0, dur: 0.18, vol: 0.45 });
    note(c, o, t, r, { f: 220, to: 90, at: 0, dur: 0.2, type: "triangle", vol: 0.6 });
  },
  // Game over: tre fallande toner och ett långt glid ner
  gameover: (c, o, t, r) => {
    arp([392, 330, 262], 0.18, 0.16, 0.4).forEach((n) => note(c, o, t, r, n));
    note(c, o, t, r, { f: 196, to: 82, at: 0.56, dur: 0.6, type: "triangle", vol: 0.7 });
    note(c, o, t, r, { f: 196, to: 98, at: 0.56, dur: 0.5, vol: 0.2 });
  },
  // Level up: snabb arpeggio upp över två oktaver och en hållen topp
  levelup: (c, o, t, r) => {
    arp([523, 659, 784, 1047, 1319, 1568], 0.06, 0.07, 0.35).forEach((n) => note(c, o, t, r, n));
    note(c, o, t, r, { f: 2093, at: 0.38, dur: 0.35, vol: 0.3 });
    note(c, o, t, r, { f: 523, at: 0.38, dur: 0.35, type: "triangle", vol: 0.7 });
  },
  // Tar på sig något (solglasögon, krona): glid uppåt och en klick
  equip: (c, o, t, r) => {
    note(c, o, t, r, { f: 330, to: 990, at: 0, dur: 0.14, vol: 0.35 });
    note(c, o, t, r, { f: 1319, at: 0.15, dur: 0.08, vol: 0.3 });
  },
  // Hopp i minispelet: kort glid uppåt
  jump: (c, o, t, r) => note(c, o, t, r, { f: 300, to: 700, at: 0, dur: 0.12, vol: 0.3 }),
  // Dubbelhopp: samma glid, en oktav högre och kortare
  double: (c, o, t, r) => note(c, o, t, r, { f: 600, to: 1400, at: 0, dur: 0.09, vol: 0.25 }),
  // Extraliv i minispelet: snabbt pling uppåt
  life: (c, o, t, r) => arp([1047, 1319, 1568, 2093], 0.05, 0.07, 0.3).forEach((n) => note(c, o, t, r, n)),
  // Tugga på pizzan: två krispiga brusknaster och en kort, dov tugga
  crunch: (c, o, t, r) => {
    crackle(c, o, t, 0, 0.04, 2600 * r);
    crackle(c, o, t, 0.05, 0.06, 1600 * r);
    note(c, o, t, r, { f: 180, to: 90, at: 0, dur: 0.08, type: "triangle", vol: 0.6 });
  },
  // Ny level i minispelet: kort pling, tre toner uppåt
  level: (c, o, t, r) => arp([784, 1047, 1568], 0.06, 0.08, 0.3).forEach((n) => note(c, o, t, r, n)),
};

function playSound(name: SoundName, { rate = 1, volume = 1 } = {}) {
  if (isMuted) return;
  // Testkrok: finns window.__sfx (sätts bara av testsviten) loggas varje ljud
  (window as unknown as { __sfx?: string[] }).__sfx?.push(name);
  try {
    const ctx = getAudioCtx();
    const synth = () => {
      const out = ctx.createGain();
      out.gain.value = volume * MASTER_VOLUME;
      out.connect(ctx.destination);
      SYNTHS[name](ctx, out, ctx.currentTime + 0.01, rate);
    };
    if (ctx.state === "running") return synth();
    // Första trycket: resume() är asynkron och currentTime står still tills
    // kontexten kör. Skapa inga oscillatorer förrän dess – spela när den kör,
    // om det fortfarande känns som svar på trycket (< 0,5 s).
    const t = performance.now();
    ctx.resume().then(() => {
      if (ctx.state === "running" && performance.now() - t < 500) synth();
    }, () => {});
  } catch {
    // Ignore audio errors
  }
}

function initMuteToggle() {
  const btn = $("#btn-mute");
  const iconOn = $("#icon-sound-on");
  const iconOff = $("#icon-sound-off");

  // SVG följer inte webbläsarens [hidden]-regel – attributet sätts här och
  // döljs via CSS (.btn-mute svg[hidden]). Högtalare med vågor = ljud på.
  const update = () => {
    iconOn.toggleAttribute("hidden", isMuted);
    iconOff.toggleAttribute("hidden", !isMuted);
    btn.setAttribute("aria-label", isMuted ? "Sätt på ljud" : "Stäng av ljud");
  };
  update();

  btn.addEventListener("click", () => {
    isMuted = !isMuted;
    localStorage.setItem(MUTE_KEY, String(isMuted));
    update();
    if (!isMuted) playSound("blip");
  });
}

// ===== EFFEKTLAGER (splitter, mynt) =====
const rand = Math.random;

// Ett lager över hela skärmen för partiklar; tas bort av den som skapat det
function fxLayer(): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "fx-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  return layer;
}

function centerOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// ===== HERO: SOLGLASÖGON OCH KRONA =====
function initHero() {
  const btn = $("#btn-hero");
  const shades = document.getElementById("shades");
  const crown = document.getElementById("crown");
  if (!btn || !shades || !crown) return;
  // Lutning efter huvudets vinkel på fotot; sätts en gång, tweens rör bara y/opacitet
  gsap.set(shades, { rotation: -4 });
  gsap.set(crown, { rotation: -5 });
  let state = 0;

  const drop = (el: Element) => {
    if (reducedMotion) return gsap.set(el, { autoAlpha: 1, y: 0 });
    gsap.fromTo(el, { autoAlpha: 1, y: -140 }, { y: 0, duration: 0.45, ease: "steps(6)" });
  };
  const flyOff = (el: Element) => {
    if (reducedMotion) return gsap.set(el, { autoAlpha: 0, y: 0 });
    gsap.to(el, { y: -60, autoAlpha: 0, duration: 0.3, ease: "steps(3)", onComplete: () => gsap.set(el, { y: 0 }) });
  };

  btn.addEventListener("click", () => {
    state = (state + 1) % 3;
    btn.dataset.state = String(state);
    gsap.killTweensOf([shades, crown]);

    if (state === 1) {
      // Solglasögonen faller ner på plats. Kronan nollställs ifall den
      // avbröts mitt i flygningen av ett snabbt tryck.
      gsap.set(crown, { autoAlpha: 0, y: 0 });
      drop(shades);
      playSound("equip");
    } else if (state === 2) {
      flyOff(shades);
      drop(crown);
      playSound("equip", { rate: 1.5 });
    } else {
      gsap.set(shades, { autoAlpha: 0, y: 0 });
      flyOff(crown);
      playSound("blip", { rate: 0.75 });
    }
  });
}

// ===== BLOCKET I MARKEN: GRÄV, SPLITTER, MYNT =====
const RESPAWN_MS = 3000;
const SHARD_COLORS = ["#A3ACBF", "#5B6378", "#FFFFFF", "#0B0E17"];

function initDig() {
  const btn = $<HTMLButtonElement>("#btn-dig");
  const spot = btn?.closest<HTMLElement>(".dig-spot");
  const cracks = btn ? Array.from(btn.querySelectorAll(".crack")) : [];
  const parts = btn ? Array.from(btn.querySelectorAll("svg")) : [];
  const counter = $("#coin-count");
  const hudCoin = document.querySelector(".hud-coin");
  if (!btn || !spot || !counter) return;
  let coins = 0;
  let busy = false;

  const addCoin = () => {
    coins++;
    counter.textContent = String(coins).padStart(2, "0");
    if (!reducedMotion && hudCoin) {
      gsap.fromTo([counter, hudCoin], { scale: 1.6 }, { scale: 1, duration: 0.3, ease: "steps(3)" });
    }
  };

  const burst = () => {
    const { x, y } = centerOf(btn);
    const layer = fxLayer();
    const done = () => layer.remove();
    if (reducedMotion) {
      // Slutläge utan rörelse: myntet syns en stund ovanför hålet
      const coin = document.createElement("div");
      coin.className = "fx";
      coin.innerHTML = spriteSvg("coin", 3);
      layer.appendChild(coin);
      gsap.set(coin, { x: x - 12, y: y - 60 });
      gsap.delayedCall(0.8, done);
      return;
    }
    const tl = gsap.timeline({ onComplete: done });
    for (let i = 0; i < 10; i++) {
      const s = document.createElement("div");
      s.className = "fx shard";
      s.style.background = SHARD_COLORS[i % SHARD_COLORS.length];
      layer.appendChild(s);
      const dx = (rand() - 0.5) * 120;
      tl.fromTo(
        s,
        { x: x - 3, y: y - 3 },
        { keyframes: { x: [x - 3 + dx * 0.5, x - 3 + dx], y: [y - 40 - rand() * 40, y + 40] }, duration: 0.6, ease: "steps(6)" },
        0
      );
      tl.to(s, { opacity: 0, duration: 0.2, ease: "steps(2)" }, 0.45);
    }
    const coin = document.createElement("div");
    coin.className = "fx";
    coin.innerHTML = spriteSvg("coin", 3);
    layer.appendChild(coin);
    tl.fromTo(coin, { x: x - 12, y: y - 12 }, { y: y - 80, duration: 0.35, ease: PX }, 0.05);
    tl.to(coin, { opacity: 0, duration: 0.2, ease: "steps(2)" }, 0.55);
  };

  btn.addEventListener("click", () => {
    if (busy) return;
    busy = true;
    spot.dataset.state = "dug";
    btn.setAttribute("aria-disabled", "true");
    playSound("dig");

    const breakBlock = () => {
      gsap.set(parts, { autoAlpha: 0 });
      burst();
      addCoin();
      playSound("coin");
    };
    if (reducedMotion) {
      breakBlock();
    } else {
      // Sprickor i två steg med skak, sedan går blocket sönder
      gsap
        .timeline()
        .set(cracks[0], { autoAlpha: 1 })
        .to(btn, { keyframes: { x: [-3, 3, 0] }, duration: 0.12, ease: "steps(3)" })
        .set(cracks[1], { autoAlpha: 1 })
        .to(btn, { keyframes: { x: [-3, 3, 0] }, duration: 0.12, ease: "steps(3)" })
        .add(breakBlock);
    }

    // Nytt block efter 3 s
    gsap.delayedCall(RESPAWN_MS / 1000, () => {
      gsap.set(cracks, { autoAlpha: 0 });
      gsap.set(parts.filter((p) => !p.classList.contains("crack")), { autoAlpha: 1 });
      if (!reducedMotion) gsap.fromTo(btn, { scale: 0 }, { scale: 1, duration: 0.3, ease: "steps(3)" });
      busy = false;
      delete spot.dataset.state;
      btn.removeAttribute("aria-disabled");
    });
  });
}

// ===== SKATTKISTAN =====
function initChest() {
  const btn = $("#btn-chest");
  if (!btn) return;
  let open = false;
  let bursting = false;

  const coinRain = () => {
    if (bursting) return;
    bursting = true;
    btn.dataset.bursting = "true";
    const { x, y } = centerOf(btn);
    const layer = fxLayer();
    const count = 16;
    const coins: HTMLElement[] = [];
    for (let i = 0; i < count; i++) {
      const c = document.createElement("div");
      c.className = "fx coin";
      c.innerHTML = spriteSvg("coin", rand() < 0.5 ? 2 : 3);
      layer.appendChild(c);
      coins.push(c);
    }
    const done = () => {
      layer.remove();
      bursting = false;
      delete btn.dataset.bursting;
    };
    if (reducedMotion) {
      // Slutläge utan rörelse: mynten ligger utspridda runt kistan och tonar ut
      coins.forEach((c) => gsap.set(c, { x: x + (rand() - 0.5) * 200, y: y - 40 - rand() * 120 }));
      gsap.to(coins, { opacity: 0, duration: 0.3, delay: 1.2, onComplete: done });
      return;
    }
    const h = window.innerHeight;
    const all = gsap.timeline({ onComplete: done });
    coins.forEach((c) => {
      const dx = (rand() - 0.5) * 260;
      const peak = y - 120 - rand() * 160;
      gsap.set(c, { x: x - 10, y: y - 16 });
      const t = gsap
        .timeline()
        .to(c, { x: x - 10 + dx * 0.6, y: peak, duration: 0.4 + rand() * 0.15, ease: "power2.out" })
        .to(c, { x: x - 10 + dx, y: h + 40, duration: 0.7 + rand() * 0.3, ease: "power2.in" });
      // Mynten "snurrar" i pixelsteg
      gsap.to(c, { scaleX: 0.2, duration: 0.15, repeat: 7, yoyo: true, ease: "steps(2)" });
      all.add(t, rand() * 0.25);
    });
  };

  btn.addEventListener("click", () => {
    open = !open;
    btn.dataset.open = String(open);
    btn.setAttribute("aria-label", open ? "Stäng skattkistan" : "Öppna skattkistan");
    if (!reducedMotion) {
      gsap.fromTo(btn, { y: 0 }, { keyframes: { y: [-8, 0] }, duration: 0.2, ease: "steps(2)" });
    }
    if (open) {
      playSound("chest");
      coinRain();
    } else {
      playSound("blip", { rate: 0.75 });
    }
  });
}

// ===== PIZZA (Vad händer) =====
// Tuggor i spritens pixelkoordinater (cx, cy, r): spetsen, mitten, nästan allt
// utom kanten. En tugga är hela svarta pixlar i en SVG-mask: pixlarna raderas,
// inget ritas ovanpå (fungerar mot alla bakgrunder).
const BITES: [number, number, number][][] = [
  [[8, 1.5, 3.8]],
  [[5.5, 6.5, 3], [10.5, 6.5, 3], [8, 5, 3.2]],
  [[4, 10, 3], [12, 10, 3], [8, 9.5, 3.6], [8, 6, 3]],
];
const PIZZA_LABELS = ["Ta en tugga!", "Mums!", "En till?", "Bara kanten kvar…"];

function initPizza() {
  const btn = $("#btn-pizza");
  const label = $("#pizza-label");
  const svg = btn?.querySelector("svg");
  if (!btn || !label || !svg) return;
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  };
  // Masken läggs till med JS; utan JS syns hela pizzan
  const mask = el("mask", { id: "bite-mask", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 16, height: 16 });
  const bites = el("g", { fill: "black" });
  mask.append(el("rect", { width: 16, height: 16, fill: "white" }), bites);
  const slice = el("g", { mask: "url(#bite-mask)" });
  slice.append(...Array.from(svg.childNodes));
  svg.append(el("defs", {}), slice);
  svg.firstElementChild!.append(mask);
  let n = 0;

  btn.addEventListener("click", () => {
    if (n < BITES.length) {
      // Pixlar inom tuggan, med tandad kant (varannan pixel i ytterkanten står kvar)
      for (const [cx, cy, r] of BITES[n]) {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            if (d < r - 0.8 || (d < r && (x + y) % 2)) bites.append(el("rect", { x, y, width: 1, height: 1 }));
          }
        }
      }
      n++;
      playSound("crunch");
    } else {
      // Fjärde trycket: ny bit
      bites.replaceChildren();
      n = 0;
      playSound("blip");
    }
    if (!reducedMotion) gsap.fromTo(btn, { y: 0 }, { keyframes: { y: [-6, 0] }, duration: 0.16, ease: "steps(2)" });
    label.textContent = PIZZA_LABELS[n];
    btn.dataset.bites = String(n);
  });
}

// ===== HJÄRTAN (LIV) =====
function initHearts() {
  const btn = $("#btn-hearts");
  const msg = $("#hearts-msg");
  if (!btn || !msg) return;
  const hearts = Array.from(btn.querySelectorAll<HTMLElement>(".heart"));
  const MAX = hearts.length;
  let lives = MAX;
  let clear: gsap.core.Tween | null = null;

  const render = () => {
    hearts.forEach((h, i) => h.classList.toggle("lost", i >= lives));
    btn.dataset.lives = String(lives);
    btn.setAttribute(
      "aria-label",
      lives ? `Liv: ${lives} av ${MAX}. Tryck för att ta ett liv` : "Game over. Tryck för extra liv"
    );
  };

  // Meddelande under hjärtana; "GAME OVER?" står kvar tills nästa tryck
  const say = (text: string, good: boolean, stay: boolean) => {
    clear?.kill();
    msg.textContent = text;
    msg.classList.toggle("good", good);
    if (!reducedMotion) gsap.fromTo(msg, { y: -6 }, { y: 0, duration: 0.15, ease: "steps(2)" });
    clear = stay ? null : gsap.delayedCall(1.2, () => (msg.textContent = ""));
  };

  btn.addEventListener("click", () => {
    if (lives > 0) {
      lives--;
      render();
      if (!reducedMotion) {
        gsap.fromTo(btn, { x: 0 }, { keyframes: { x: [-5, 5, -4, 4, 0] }, duration: 0.25, ease: "steps(5)" });
        gsap.fromTo(hearts[lives], { y: 0 }, { keyframes: { y: [-6, 0] }, duration: 0.2, ease: "steps(2)" });
      }
      if (lives === 0) {
        say("GAME OVER?", false, true);
        playSound("gameover");
      } else {
        say("OUCH!", false, false);
        playSound("ouch");
      }
    } else {
      lives = MAX;
      render();
      say("EXTRA LIFE!", true, false);
      playSound("levelup");
      if (!reducedMotion) {
        gsap.fromTo(hearts, { scale: 0 }, { scale: 1, duration: 0.2, stagger: 0.1, ease: "steps(2)" });
      }
    }
  });
}

// ===== KONFETTI OCH LEVEL UP =====
const PIXEL_COLORS = ["#5BC236", "#8B5A2B", "#5EC8F2", "#FF3EB5", "#FFC83D"];

// Stor pixeltext mitt på skärmen: "LEVEL UP!" vid OSA-ja, "NEW HIGH SCORE!" vid ny etta
function showLevelUp(text = "LEVEL UP!") {
  const el = document.createElement("div");
  el.className = text.length > 10 ? "levelup long" : "levelup";
  el.setAttribute("aria-hidden", "true");
  el.textContent = text;
  document.body.appendChild(el);
  if (reducedMotion) {
    gsap.delayedCall(1.5, () => el.remove());
    return;
  }
  gsap
    .timeline({ onComplete: () => el.remove() })
    .fromTo(el, { scale: 0.3, opacity: 1 }, { scale: 1, duration: 0.3, ease: "steps(4)" })
    .to(el, { opacity: 0, duration: 0.15, repeat: 3, yoyo: true, ease: "steps(1)" }, "+=0.6")
    .to(el, { y: -30, opacity: 0, duration: 0.3, ease: "steps(3)" });
}

function fireConfettiBig() {
  // Fyrkantiga, platta partiklar = pixelkonfetti
  const base = { shapes: ["square"], flat: true, scalar: 1.4, colors: PIXEL_COLORS };
  if (reducedMotion) {
    confetti({ ...base, particleCount: 20, spread: 60, origin: { y: 0.7 }, disableForReducedMotion: false });
    return;
  }
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      confetti({ ...base, particleCount: 50, spread: 80, startVelocity: 38, origin: { x: 0.2 + i * 0.3, y: 0.7 } });
    }, i * 350);
  }
}

function fireConfettiSmall() {
  confetti({
    particleCount: reducedMotion ? 5 : 15,
    spread: 40,
    origin: { y: 0.7 },
    shapes: ["square"],
    flat: true,
    colors: ["#5B6378", "#A3ACBF"],
    gravity: 1.5,
    disableForReducedMotion: false,
  });
}

// ===== RSVP FORM =====
interface StoredRSVP {
  name: string;
  attending: string;
  diet: string;
  phone: string;
  message: string;
}

function initRSVP() {
  const form = $<HTMLFormElement>("#rsvp-form");
  const summary = $("#rsvp-summary");
  const summaryText = $("#summary-text");
  const btnChange = $("#btn-change");
  const fieldName = $<HTMLInputElement>("#field-name");
  const fieldAttending = $<HTMLInputElement>("#field-attending");
  const fieldDiet = $<HTMLTextAreaElement>("#field-diet");
  const fieldPhone = $<HTMLInputElement>("#field-phone");
  const fieldMessage = $<HTMLTextAreaElement>("#field-message");
  const fieldChanged = $<HTMLInputElement>("#form-changed");
  const errorName = $("#error-name");
  const errorAttending = $("#error-attending");
  const btnSubmit = $<HTMLButtonElement>("#btn-submit");
  const submitText = $("#submit-text");
  const spinner = $("#spinner");
  const formStatus = $("#form-status");
  const btnYes = $<HTMLButtonElement>("#btn-yes");
  const btnNo = $<HTMLButtonElement>("#btn-no");

  // Toggle attending buttons
  btnYes.addEventListener("click", () => {
    fieldAttending.value = "ja";
    btnYes.classList.add("active");
    btnNo.classList.remove("active");
    errorAttending.textContent = "";
    playSound("blip");
  });

  btnNo.addEventListener("click", () => {
    fieldAttending.value = "nej";
    btnNo.classList.add("active");
    btnYes.classList.remove("active");
    errorAttending.textContent = "";
    playSound("blip", { rate: 0.75 });
  });

  // Check stored answer
  const key = rsvpKey();
  // Skickas alltid med till Formspree, så att varje svar går att koppla till sin inbjudan
  const fieldGuest = $<HTMLInputElement>("#form-guest");
  if (fieldGuest) fieldGuest.value = guestName() || "okänd";
  (window as unknown as { __rsvpKey?: string }).__rsvpKey = key; // visas med ?debug=1
  const stored = localStorage.getItem(key);
  let isUpdate = false;

  if (stored) {
    try {
      const data: StoredRSVP = JSON.parse(stored);
      showSummary(data);
    } catch {
      // Invalid stored data, show form
    }
  }

  function showSummary(data: StoredRSVP) {
    const attendingText =
      data.attending === "ja" ? "ja" : "nej";
    let text = `Ni har svarat ${attendingText} för ${data.name}`;
    if (data.diet) text += ` · ${data.diet}`;
    summaryText.textContent = text;
    summary.hidden = false;
    form.hidden = true;
  }

  btnChange.addEventListener("click", () => {
    summary.hidden = true;
    form.hidden = false;
    isUpdate = true;
    fieldChanged.value = "yes";

    // Prefill
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const data: StoredRSVP = JSON.parse(stored);
        fieldName.value = data.name;
        fieldAttending.value = data.attending;
        fieldDiet.value = data.diet;
        fieldPhone.value = data.phone;
        fieldMessage.value = data.message;

        if (data.attending === "ja") {
          btnYes.classList.add("active");
          btnNo.classList.remove("active");
        } else if (data.attending === "nej") {
          btnNo.classList.add("active");
          btnYes.classList.remove("active");
        }
      } catch {
        // ignore
      }
    }
  });

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate
    let valid = true;
    if (!fieldName.value.trim()) {
      errorName.textContent = "Skriv barnets namn";
      valid = false;
    } else {
      errorName.textContent = "";
    }

    if (!fieldAttending.value) {
      errorAttending.textContent = "Välj om ni kommer eller inte";
      valid = false;
    } else {
      errorAttending.textContent = "";
    }

    if (!valid) return;

    // Disable & spinner
    btnSubmit.disabled = true;
    submitText.textContent = "Skickar...";
    spinner.hidden = false;
    formStatus.textContent = "";
    formStatus.className = "form-status";

    try {
      const formData = new FormData(form);
      if (!isUpdate) {
        formData.delete("changed");
      }

      const res = await fetch(content.rsvp.endpoint, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        // Save to localStorage
        const rsvpData: StoredRSVP = {
          name: fieldName.value.trim(),
          attending: fieldAttending.value,
          diet: fieldDiet.value.trim(),
          phone: fieldPhone.value.trim(),
          message: fieldMessage.value.trim(),
        };
        localStorage.setItem(key, JSON.stringify(rsvpData));

        // Success state
        if (fieldAttending.value === "ja") {
          formStatus.textContent = `Hurra! ${seeYouText()}`;
          formStatus.className = "form-status success";
          fireConfettiBig();
          showLevelUp();
          playSound("levelup");
        } else {
          formStatus.textContent = "Synd, men tack för svaret!";
          formStatus.className = "form-status success";
          fireConfettiSmall();
        }

        // Show summary after a moment
        setTimeout(() => {
          showSummary(rsvpData);
        }, 3000);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      formStatus.textContent =
        "Något gick fel – testa igen om en stund";
      formStatus.className = "form-status error";
    } finally {
      btnSubmit.disabled = false;
      submitText.textContent = "Skicka svar";
      spinner.hidden = true;
    }
  });
}

// ===== INIT =====
// ?reset=1 rensar alla sparade OSA-svar i denna webbläsare (alla gäster, även
// en nyckel utan gäst) och laddar om utan parametern. ?g behålls.
function handleReset(): boolean {
  const url = new URL(window.location.href);
  if (url.searchParams.get("reset") !== "1") return false;
  Object.keys(localStorage)
    .filter((k) => k === STORAGE_PREFIX || k.startsWith(`${STORAGE_PREFIX}:`))
    .forEach((k) => localStorage.removeItem(k));
  url.searchParams.delete("reset");
  window.location.replace(url.toString());
  return true;
}

// ===== BONUS LEVEL (minispelet i src/game.ts) =====

// Topplistan (src/leaderboard.ts) ligger under spelet och laddar Firebase vid
// första spelstart eller när Bonus level syns – aldrig vid sidladdning
function initBonus() {
  const board = initLeaderboard({
    guest: guestName(),
    play: (s) => playSound(s),
    toast: showLevelUp,
    localBest: bestScore,
  });
  const game = initGame($("#game"), (s) => playSound(s), {
    onStart: board.connect,
    onOver: (score) => board.over(score),
  });
  board.attach(game);
}

// Varje steg körs för sig: ett fel i t.ex. ljud eller konfetti ska inte stoppa
// resten. Fel loggas till window.__errors (visas med ?debug=1, se <head>).
function init() {
  if (handleReset()) return;
  const root = document.documentElement;
  const steps: [string, () => void][] = [
    ["greeting", initGreeting],
    ["stars", createStars],
    ["content", populateContent],
    ["animations", initAnimations],
    ["start", initPressStart],
    ["signpost", initSignpost],
    ["hero", initHero],
    ["dig", initDig],
    ["chest", initChest],
    ["pizza", initPizza],
    ["hearts", initHearts],
    ["bonus", initBonus],
    ["mute", initMuteToggle],
    ["audio", initAudioUnlock],
    ["rsvp", initRSVP],
  ];
  let failed = false;
  for (const [name, step] of steps) {
    try {
      step();
    } catch (e) {
      failed = true;
      const errs = ((window as unknown as { __errors?: string[] }).__errors ??= []);
      errs.push(`init:${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // Något steg föll: visa allt utan inanimering i stället för att lämna dolt innehåll
  if (failed) root.classList.remove("js");
  root.classList.add("js-ready");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
