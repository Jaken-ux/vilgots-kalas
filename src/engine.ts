// Minispelets regler utan DOM: fart, hopp, hinder, krockar och utplacering.
// game.ts ritar och tar emot tryck; testsvitens botar kör motorn direkt i Node.
// Allt räknas exakt ur speltiden: sträckan är integralen av fartkurvan, och
// varje hinders läge är en funktion av sträckan. Gubbens höjd räknas ur
// hoppets startögonblick, inte stegvis. Därför ser spelet, utplaceringen och
// botarna samma värld, oavsett bildfrekvens.
import { ENVS, GROUND, DIVE_TOP, DIVE_LOW, type Kind, type Env } from "./levels";

export const W = 192;
export const H = 96;
export const RX = 24; // gubbens x
export const LIVES = 3;
export const LEVEL_SECONDS = 30;
// Hinder kommer in i högerkanten: så långt bort (d) syns de först
export const SIGHT = W - RX - 6;
// Dubbelhoppet: ett nytt hopp med 60 % av ett vanligt hopps höjd
export const DOUBLE = Math.sqrt(0.6);

// ----- Fart: sågtand -----
// Farten stiger linjärt inom varje level och sänks 15 % vid nästa levelstart.
// Slutfarten per level (spelpixlar/s) är kalibrerad mot botarna i testsviten;
// efter tabellen fortsätter den med samma ökning per level, utan tak.
const V1 = 70;
const DROP = 0.85;
const ENDS = [130, 210, 310, 470, 593, 723, 880, 1350];
const GROW = 1.2;
export const levelEnd = (n: number): number => ENDS[n - 1] ?? ENDS[ENDS.length - 1] * GROW ** (n - ENDS.length);
export const levelStart = (n: number) => (n > 1 ? DROP * levelEnd(n - 1) : V1);
export const levelAt = (t: number) => Math.floor(Math.max(0, t) / LEVEL_SECONDS) + 1;
export const envAt = (t: number): Env => ENVS[(levelAt(t) - 1) % ENVS.length];
export function vAt(t: number) {
  const n = levelAt(t);
  const s = levelStart(n);
  return s + ((levelEnd(n) - s) * (Math.max(0, t) - (n - 1) * LEVEL_SECONDS)) / LEVEL_SECONDS;
}
// Sprungen sträcka efter t sekunder (integralen av vAt)
const cum = [0];
export function distAt(t: number) {
  t = Math.max(0, t);
  const n = levelAt(t);
  while (cum.length < n) {
    const i = cum.length;
    cum.push(cum[i - 1] + (LEVEL_SECONDS * (levelStart(i) + levelEnd(i))) / 2);
  }
  const u = t - (n - 1) * LEVEL_SECONDS;
  const s = levelStart(n);
  return cum[n - 1] + u * (s + ((levelEnd(n) - s) * u) / (2 * LEVEL_SECONDS));
}
// Tätare hinder när baslinjen (levelns startfart) stiger
export const density = (t: number) => Math.max(0.35, Math.sqrt(V1 / levelStart(levelAt(t))));

// ----- Hinder -----
export interface Hazard {
  n: string; // typens namn i miljön
  k: Kind;
  t0: number; // när ankaret är vid x0
  x0: number;
  s0: number; // sträckan vid t0
  f: number; // egen fart mot gubben, andel av markfarten
  b: number; // sträcka efter t0 där inbromsningen börjar (Infinity = aldrig)
  on: number; // träffytan gäller från denna tid (landning, nedslag, skott)
  seen: number; // första gången hindret eller dess förvarning syns
  x: number;
  y: number;
  braked?: number; // när inbromsningen började (sätts av motorn)
  twin?: boolean; // andra hindret i ett tätt högt par (kräver dubbelhopp)
  smp?: Samples;
}
const RAMP = 40; // inbromsning: från egen fart till stillastående på 40 px mark

// Hindrets x vid tiden t
export function xAt(o: Hazard, t: number) {
  const s = distAt(t) - o.s0;
  let p = s + o.f * Math.min(s, o.b);
  if (s > o.b) {
    const z = s - o.b;
    p += o.f * (z < RAMP ? z - (z * z) / (2 * RAMP) : RAMP / 2);
  }
  return o.x0 - p;
}
// Dykaren: från DIVE_TOP ner till huvudhöjd, klar vid d = dive
export const yOf = (k: Kind, x: number) =>
  k.dive === undefined ? k.y : DIVE_LOW - (DIVE_LOW - DIVE_TOP) * Math.min(1, Math.max(0, (x - RX - 6 - k.dive) / 60));
// När hindret når x = X (x minskar med tiden)
export function when(o: Hazard, X: number) {
  let lo = o.t0 - 8;
  let hi = o.t0;
  while (xAt(o, hi) > X && hi < o.t0 + 60) hi += 0.5;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (xAt(o, m) > X) lo = m;
    else hi = m;
  }
  return hi;
}

// Krock: samma ytor som alltid, 1 px förlåtelse runt om
export function hits(o: Hazard, y: number, t: number) {
  const top = GROUND - 10 - y;
  return (
    t >= o.on &&
    RX + 7 > o.x + 1 &&
    RX + 1 < o.x + o.k.w - 1 &&
    top + 10 > o.y + 1 &&
    top + 1 < o.y + o.k.h - 1
  );
}

// ----- Hopp -----
// Ett hopp: avstamp vid t med gravitation g och utgångsfart v0, ev. dubbelhopp vid d
export interface Flight {
  t: number;
  g: number;
  v0: number;
  d?: number;
}
const rise = (v: number, g: number, u: number) => v * u - (g * u * u) / 2;
// Höjd över marken vid tiden t
export function fy(fl: Flight, t: number) {
  if (t <= fl.t) return 0;
  if (fl.d === undefined || t < fl.d) return Math.max(0, rise(fl.v0, fl.g, t - fl.t));
  return Math.max(0, rise(fl.v0, fl.g, fl.d - fl.t) + rise(fl.v0 * DOUBLE, fl.g, t - fl.d));
}
// När hoppet landar
export function landAt(fl: Flight) {
  if (fl.d === undefined) return fl.t + (2 * fl.v0) / fl.g;
  const y = rise(fl.v0, fl.g, fl.d - fl.t);
  const v = fl.v0 * DOUBLE;
  return fl.d + (v + Math.sqrt(v * v + 2 * fl.g * y)) / fl.g;
}

// ----- Planering -----
// Varje hinder provas i förväg var 1/480 s medan det överlappar gubben i sidled
// (1 px marginal): vid varje tidpunkt ett höjdband (lo, hi) där gubben krockar.
// Ett band som innehåller 0 betyder att hindret måste hoppas över.
interface Samples {
  t: number[];
  lo: number[];
  hi: number[];
  start: number;
  end: number;
  last: number; // sista tidpunkten där en gubbe på marken krockar
}
const STEP = 1 / 480;
export function samples(o: Hazard): Samples {
  if (o.smp) return o.smp;
  const a = when(o, RX + 7);
  const b = when(o, RX + 1 - o.k.w);
  const s: Samples = { t: [], lo: [], hi: [], start: Infinity, end: -Infinity, last: -Infinity };
  for (let t = a - STEP; t <= b + STEP; t += STEP) {
    if (t < o.on) continue;
    const y = yOf(o.k, xAt(o, t));
    s.t.push(t);
    s.lo.push(GROUND - y - o.k.h - 9);
    s.hi.push(GROUND - y);
    if (GROUND - y - o.k.h - 9 < 0) s.last = t;
  }
  if (s.t.length) {
    s.start = s.t[0];
    s.end = s.t[s.t.length - 1];
  }
  return (o.smp = s);
}
// Första tidpunkten ≥ F där hindret träffar en gubbe som står på marken
function groundHit(o: Hazard, F: number) {
  const s = samples(o);
  for (let i = 0; i < s.t.length; i++) if (s.t[i] >= F && s.lo[i] < 0) return s.t[i];
  return Infinity;
}
// Klarar hoppet alla hinder? Gubben står på marken från F till avstampet och
// efter landningen. Hinder som hoppet berör måste vara helt passerade.
// Före avstampet behöver inget provas: avstampet ligger aldrig efter första
// krocken på marken (plan), och i luften (rescue) är det redan passerat.
function clear(fl: Flight, land: number, F: number, hz: Hazard[], next: Hazard | null) {
  const from = Math.max(F, fl.t);
  for (const o of hz) {
    const s = samples(o);
    if (s.end < from) continue;
    if (s.start >= land) {
      if (o === next) return false; // landar före hindret
      continue;
    }
    // Första provpunkten efter avstampet (binärsökning)
    let i = 0;
    let j = s.t.length;
    while (i < j) {
      const m = (i + j) >> 1;
      if (s.t[m] < from) i = m + 1;
      else j = m;
    }
    for (; i < s.t.length && s.t[i] < land; i++) {
      const y = fy(fl, s.t[i]);
      if (y > s.lo[i] && y < s.hi[i]) return false;
    }
    if (s.last >= land) return false; // landar mitt i hindret
  }
  return true;
}

export interface Plan {
  at: number; // avstamp (Infinity = inget hopp behövs)
  land: number;
  // Hoppet klarar nästa hinder men inte de som följer tätt efter: de kräver
  // ett dubbelhopp i luften (rescue)
  more?: boolean;
  h?: Hazard; // hindret hoppet gäller
  dbl?: number; // andra trycket (hjärtat)
}
const PSTEP = 1 / 120;
export const MARGIN = 2 / 60; // två bildrutor: ett tryck kommer alltid i en bildruta
// Ett tryck landar i första bildrutan efter planerad tid: spöket räknar med att
// varje hopp kommer en bildruta sent, annars hamnar en riktig spelare efter
// spöket i en lång kedja av hopp och landar för sent före nästa hinder
export const LAG = 1 / 60;
export const physAt = (t: number) => envAt(t);

// Sammanhängande körningar av godkända tider: [första, sista]
function runs(ok: boolean[], t0: number, step: number) {
  const out: [number, number][] = [];
  let a = -1;
  ok.forEach((v, i) => {
    if (v && a < 0) a = i;
    if ((!v || i === ok.length - 1) && a >= 0) {
      out.push([t0 + a * step, t0 + (v ? i : i - 1) * step]);
      a = -1;
    }
  });
  return out;
}

// Nästa hopp för en gubbe som står på marken från F: mitt i första fönstret
// som går att nå (aldrig före F). need = hur lång tid av fönstret som minst ska
// finnas kvar efter avstampet (högst 40 % av ett smalt fönster). Går inget
// hopp över alla kända hinder planeras hoppet bara över nästa (more = true).
// null = nästa hinder går inte att klara.
export function plan(F: number, hz: Hazard[], need = MARGIN): Plan | null {
  let next: Hazard | null = null;
  let tg = Infinity;
  for (const o of hz) {
    const t = groundHit(o, F);
    if (t < tg) {
      tg = t;
      next = o;
    }
  }
  if (!next) return { at: Infinity, land: F };
  const ge = physAt(tg);
  const t1 = tg - (2 * ge.v0) / ge.g - PSTEP;
  const end = samples(next).end;
  for (const only of [hz, hz.filter((o) => samples(o).start <= end)]) {
    const ok: boolean[] = [];
    for (let t = t1; t <= tg; t += PSTEP) {
      const e = physAt(t);
      const fl = { t, g: e.g, v0: e.v0 };
      ok.push(clear(fl, landAt(fl), F, only, next));
    }
    const r = runs(ok, t1, PSTEP).find(([a, b]) => b - Math.max(F, (a + b) / 2) >= Math.max(MARGIN, Math.min(need, 0.4 * (b - a))) - 1e-9);
    if (r) {
      const at = Math.max(F, (r[0] + r[1]) / 2);
      const e = physAt(at);
      return { at, land: landAt({ t: at, g: e.g, v0: e.v0 }), more: only !== hz, h: next };
    }
  }
  return null;
}

// Gubben i luften: behövs ett dubbelhopp för att klara hindren (eller för att
// nästa hinder ska gå att nå efter landningen)? Ger tiden för andra trycket,
// null om det inte behövs eller inte hjälper.
export function rescue(fl: Flight, now: number, hz: Hazard[]): number | null {
  const land = landAt(fl);
  if (clear(fl, land, now, hz, null) && plan(land, hz)) return null;
  const top = fl.t + (2 * fl.v0) / fl.g;
  const ok: boolean[] = [];
  for (let d = now; d < top - 1 / 60; d += PSTEP) {
    const f2 = { ...fl, d };
    const l2 = landAt(f2);
    ok.push(clear(f2, l2, now, hz, null) && !!plan(l2, hz));
  }
  const r = runs(ok, now, PSTEP)[0];
  return r ? Math.max(now, (r[0] + r[1]) / 2) : null;
}

// ----- Hjärtat -----
// Ett per level, ungefär mitt i: så högt att bara ett dubbelhopp når det
// (ett vanligt hopp når 47,5 px, i rymden 50 px). Plockat = +1 liv (max 3).
export const HEART_LO = 53; // underkant över marken
const HEART_W = 9;
const HEART_H = 8;
export interface Heart {
  t0: number; // när det kommer in i högerkanten
  s0: number;
  seen: number;
  level: number;
  x: number;
  got?: boolean;
  plans?: Plan[];
}
export const heartX = (h: Heart, t: number) => W - (distAt(t) - h.s0);
// Gubbens ruta mot hjärtats, utan förlåtelse
export const catches = (h: Heart, y: number, t: number) => {
  const x = heartX(h, t);
  return RX + 8 > x && RX < x + HEART_W && y + 10 > HEART_LO && y < HEART_LO + HEART_H;
};
// Alla hopp + dubbelhopp (var 1/60 s) som tar hjärtat: [avstamp, andra tryck, landning]
export function catchPlans(h: Heart): Plan[] {
  if (h.plans) return h.plans;
  let a = h.t0;
  while (heartX(h, a) > RX + 8) a += 1 / 240;
  const out: Plan[] = [];
  for (let t = a - 1; t < a + 0.3; t += 1 / 60) {
    const e = physAt(t);
    for (let d = t + 2 / 60; d < t + (2 * e.v0) / e.g - 1 / 60; d += 1 / 60) {
      const fl = { t, g: e.g, v0: e.v0, d };
      for (let u = Math.max(a, d); u < a + 0.3; u += 1 / 240) {
        if (catches(h, fy(fl, u), u)) {
          out.push({ at: t, dbl: d, land: landAt(fl) });
          break;
        }
      }
    }
  }
  return (h.plans = out);
}

// ----- Motorn -----
export type EngineEvent = "jump" | "double" | "ouch" | "over" | "level" | "coin" | "life";
// Rymdskepp: flyger in, siktar och skjuter (skottet är hindret)
const SHIP_LEAD = 0.55;
const LIGHT_LEAD = 1.4; // trafikljuset: syns 1,4 s före bilraden, rött 1 s före
export interface Light {
  on: number;
  red: number;
  off: number;
}
export interface Puff {
  t: number;
  x: number;
  y: number;
}

interface Spec {
  n: string;
  mode: "free" | "tight" | "twin";
  lead?: number;
  brake?: boolean;
  row?: boolean;
}

// Ett hinder av typen n i miljön env som kommer in i högerkanten vid t0
export function hazard(n: string, t0: number, env: Env): Hazard {
  const k = env.kinds[n];
  const x0 = k.shot ? W - 28 : W;
  const o: Hazard = { n, k, t0, x0, s0: distAt(t0), f: k.move ?? 0, b: Infinity, on: -Infinity, seen: t0, x: W + 99, y: k.y };
  if (k.shot) {
    // Skeppet syns SHIP_LEAD s innan det skjuter; skottet finns först då
    o.seen = t0 - SHIP_LEAD;
    o.on = t0;
  }
  if (k.drop) {
    // Förvarningen (dropp, skugga) ska synas ~1 s innan hindret landar, men
    // det måste landa framför gubben (minst 12 px): i hög fart syns den kortare
    const dl = Math.max(12, SIGHT - 1.05 * vAt(t0));
    o.on = when(o, RX + 6 + dl);
  }
  return o;
}

export function createEngine(opts: { rand?: () => number; start?: number; emit?: (e: EngineEvent) => void }) {
  const rand = opts.rand ?? Math.random;
  const emit = opts.emit ?? (() => {});
  const startClock = opts.start ?? 0;

  const e = {
    clock: startClock,
    dist: 0, // sprungen sträcka sedan start
    speed: vAt(startClock),
    level: levelAt(startClock),
    lives: LIVES,
    inv: 0, // skyddstid efter en krock
    fl: null as Flight | null, // pågående hopp
    y: 0,
    jumps: 0,
    doubles: 0,
    over: false,
    obs: [] as Hazard[],
    lights: [] as Light[],
    puffs: [] as Puff[],
    heart: null as Heart | null,
    hearts: 0, // plockade hjärtan
    lifeAt: -9, // när senaste extralivet kom ("+1 LIV")
    heartWin: [0, 0] as [number, number], // tiden som hålls fri från hinder runt hjärtat
    press,
    step,
  };

  // Utplaceringen: en "spökspelare" som spelar perfekt (avstamp mitt i fönstret)
  // och ser alla hinder i förväg. Ett nytt hinder läggs aldrig så att spöket
  // inte klarar det; synligheten i högerkanten räknas inte – den är spelets
  // ärliga slut när farten blir för hög.
  let ghostF = startClock; // spöket står på marken från denna tid
  let prevF = startClock; // ... och före senaste hindret
  let ghostAt = Infinity; // spökets avstamp för senaste hindret
  let lastT0 = startClock + 0.6; // när senast utplacerade hinder kommer in
  let lastW = 0;
  const queue: Spec[] = [];
  let sinceHigh = 0;
  let heartLevel = 0; // level som senast fick ett hjärta
  const s0 = distAt(startClock);

  const known = () => e.obs.filter((o) => samples(o).end >= prevF);
  // Klarar spöket hindret från F? Ger tiden då spöket står på marken igen.
  // Med dbl får spöket dubbelhoppa i luften – som en spelare: hoppa över det
  // första hindret och dubbelhoppa när det ser nästa (tidigast när det syns).
  const ghost = (o: Hazard, F: number, dbl = false, need = MARGIN): number | null => {
    if (samples(o).start < F) return null;
    const hz = [...known(), o];
    for (let i = 0; i < 6; i++) {
      const p = plan(F, hz, need);
      if (!p) return null;
      if (p.at === Infinity) return F;
      ghostAt = p.at;
      F = p.land + LAG;
      if (p.more) {
        if (!dbl) return null;
        const ev = physAt(p.at);
        const fl: Flight = { t: p.at + LAG, g: ev.g, v0: ev.v0 };
        const d = rescue(fl, Math.max(fl.t + LAG, o.seen), hz);
        if (d === null) return null;
        F = landAt({ ...fl, d: d + LAG }) + LAG;
      }
    }
    return F;
  };

  // Nästa enhet: ett hinder eller en grupp. Uppvärmning: bara låga och mellan.
  const pick = (env: Env, t: number) => {
    const lvl = levelAt(t);
    const r = rand();
    let n = r < 0.4 ? "bush" : r < 0.7 ? "block" : "big";
    if (e.dist >= 800) {
      // Från level 2: fler höga hinder
      const mix = env.mix.map(([m, w]): [string, number] => [m, m === "pillar" && lvl >= 2 ? w * 1.7 : w]);
      let x = rand() * mix.reduce((a, [, w]) => a + w, 0);
      n = mix.find(([, w]) => (x -= w) < 0)?.[0] ?? "bush";
      // Aldrig fler än 6 enheter i rad utan ett högt hinder (från level 2):
      // spelet ska ta slut även med otur i slumpen
      if (lvl >= 2 && ++sinceHigh > 6) n = "pillar";
      if (n === "pillar") sinceHigh = 0;
    }
    if (n === "cars") {
      // 1–3 bilar, snabbast först så att ingen kör ikapp en annan; ibland bromsar den sista
      const row = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => (rand() < 0.55 ? "car" : "van"));
      row.sort((a, b) => env.kinds[b].move! - env.kinds[a].move!);
      row.forEach((c, i) =>
        queue.push({ n: c, mode: i ? "tight" : "free", lead: i ? 0 : LIGHT_LEAD, row: true, brake: i === row.length - 1 && rand() < 0.4 })
      );
      return;
    }
    if (n === "ship") return void queue.push({ n: rand() < 0.5 ? "shotLow" : "shotHigh", mode: "free", lead: SHIP_LEAD });
    if (n === "meteor" && rand() < 0.4) n = "meteorBig";
    queue.push({ n, mode: "free" });
    const k = env.kinds[n];
    // Par: två i rad där andra hoppet görs vid landningen. Från level 2 fler par,
    // och höga par så tätt att det krävs ett dubbelhopp.
    if (lvl >= 2 && n === "pillar" && rand() < 0.5) {
      queue[queue.length - 1].n = "wall";
      queue.push({ n: "wall", mode: "twin" });
    }
    else if (k.pair && (lvl >= 2 || n !== "big") && rand() < (lvl >= 2 ? 0.35 : 0.2)) {
      queue.push({ n: rand() < 0.5 ? "bush" : "block", mode: "tight" });
    }
  };

  // Placera nästa hinder: tidigast när spöket klarar det, plus slumpad lucka
  function schedule() {
    const base = lastT0 + (lastW + 6) / vAt(lastT0);
    const env = envAt(base + 0.3);
    const L = levelAt(base);
    const mid = (L - 1) * LEVEL_SECONDS;
    if (heartLevel !== L && !queue.length && base > mid + 13 && base < mid + 25 && placeHeart(base, L)) return;
    // Miljön bytte mitt i en grupp: börja om med den nya miljöns hinder
    if (queue.length && !env.kinds[queue[0].n]) queue.length = 0;
    if (!queue.length) pick(env, base);
    const spec = queue.shift()!;
    const dens = density(base);
    let t = Math.max(e.clock + (spec.lead ?? 0), base);
    let o: Hazard | null = null;
    let F: number | null = null;
    let from = ghostF;
    let at = ghostAt;

    if (spec.mode === "twin") {
      // Högt par så tätt att varken ett hopp över båda eller två hopp räcker –
      // bara ett dubbelhopp: spöket hoppar över första väggen som vanligt och
      // dubbelhoppar när det ser den andra.
      const alone = ghostAt;
      const twin = (c: Hazard) => (ghost(c, prevF) === null ? ghost(c, prevF, true) : null);
      // Luckan Δ mellan ankomsterna ur hoppfysiken: över båda i ett hopp går
      // inte om Δ + överlapp > tiden ovanför väggen; två hopp går inte om andra
      // väggens sista avstamp kommer före landningen efter första.
      const A = e.obs[e.obs.length - 1];
      const ev = physAt(alone);
      const k = env.kinds[spec.n];
      const sq = Math.sqrt(ev.v0 * ev.v0 - 2 * ev.g * (GROUND - k.y - 1));
      const up = (ev.v0 - sq) / ev.g;
      const ovl = (k.w + 4) / vAt(A.t0);
      const lo = (2 * sq) / ev.g - ovl;
      const hi = ovl + 2 * up + LAG;
      if (hi - lo > 0.04) {
        const mid = (lo + hi) / 2;
        for (const dd of [0, -0.02, 0.02, -0.04, 0.04]) {
          if (mid + dd < lo + 0.01 || mid + dd > hi - 0.01) continue;
          const c = hazard(spec.n, A.t0 + mid + dd, env);
          c.twin = true;
          F = twin(c);
          if (F !== null) {
            o = c;
            from = prevF;
            at = ghostAt;
            break;
          }
        }
      }
      // Inget tätt läge: hoppa över andra väggen
      if (F === null) {
        lastT0 = Math.max(lastT0 + 0.05, e.clock);
        return;
      }
    }

    if (F === null) {
      // Som förut: en hopptid plus en slumpad del som krymper med tätheten,
      // räknat från förra hindret. Par: direkt efter landningen.
      const need = spec.mode === "tight" ? MARGIN : 0.08;
      if (spec.mode === "tight") t += 0.02;
      else t = Math.max(t, lastT0 + (2 * env.v0) / env.g + (0.15 + 0.85 * rand()) * dens);
      for (let i = 0; i < 80 && F === null; i++, t += 0.03) {
        o = hazard(spec.n, t, env);
        F = groundHit(o, -Infinity) === Infinity ? standFits(o) : ghost(o, ghostF, false, need);
      }
      // Går inte att placera (för smalt fönster vid den här farten): hoppa över
      // hindret. Spöket räknar inte med synligheten, så sikt-gränsen – spelets
      // slut – påverkas inte av detta.
      if (F === null) {
        lastT0 = Math.max(lastT0 + 0.05, e.clock);
        return;
      }
      at = ghostAt;
    }
    o = o!;
    // Luckan räckte över levelgränsen: hindret hör till förra miljön. Släng det
    // och börja om i den nya.
    if (envAt(o.t0) !== env) {
      queue.length = 0;
      ghostAt = at;
      lastT0 = Math.max(lastT0 + 0.05, o.t0 - 0.3);
      lastW = 0;
      return;
    }

    // Bilen som bromsar in precis framför gubben: bara om spöket då hinner
    // med (vänta in den på marken eller förlänga hoppet med ett dubbelhopp)
    prevF = from;
    if (spec.brake) F = brake(o) ?? F;
    ghostF = F;
    ghostAt = at;
    // Släcks efter sista bilen, men senast efter 3 s (raden kan avbrytas av ett miljöbyte)
    if (spec.row && spec.lead) e.lights.push({ on: o.t0 - LIGHT_LEAD, red: o.t0 - 1, off: o.t0 + 3 });
    if (spec.row && !queue.some((q) => q.row)) {
      const l = e.lights[e.lights.length - 1];
      if (l) l.off = Math.min(l.off, samples(o).end + 0.3);
    }
    e.obs.push(o);
    lastT0 = o.t0;
    lastW = o.k.w;
  }

  // Hjärtat läggs bara där hela fönstret för att ta det – tidigaste avstamp
  // (0,35 s extra för ett panikhopp) till senaste landning – är fritt från
  // hinder. Hinder efter hjärtat placeras efter fönstret (ghostF).
  function placeHeart(base: number, L: number): boolean {
    for (let t0 = Math.max(base, e.clock + 0.1); t0 < base + 3; t0 += 0.05) {
      const h: Heart = { t0, s0: distAt(t0), seen: t0, level: L, x: W + 99 };
      const ps = catchPlans(h);
      if (!ps.length) return false;
      const a = Math.min(...ps.map((p) => p.at)) - 0.35;
      const b = Math.max(...ps.map((p) => p.land)) + 0.1;
      if (a < ghostF || levelAt(b) !== L) continue;
      if (e.obs.some((o) => samples(o).end >= a && samples(o).start <= b)) continue;
      e.heart = h;
      e.heartWin = [a, b];
      heartLevel = L;
      prevF = ghostF = b;
      ghostAt = Infinity;
      lastT0 = t0;
      lastW = HEART_W;
      return true;
    }
    return false;
  }

  // Hinder man ska stå kvar under: spöket måste stå på marken medan det passerar
  function standFits(o: Hazard): number | null {
    const s = samples(o);
    if (s.start < ghostF + MARGIN) return null;
    return plan(ghostF, [...known(), o]) ? ghostF : null;
  }

  function brake(o: Hazard): number | null {
    const tb = when(o, RX + 6 + 40 + rand() * 30);
    if (tb < o.t0 + 0.05) return null;
    const c: Hazard = { ...o, b: distAt(tb) - o.s0, smp: undefined };
    const others = known();
    // Spöket ser inbromsningen när den börjar: står det på marken planerar det
    // om, är det redan i luften förlänger det hoppet med ett dubbelhopp
    const p0 = plan(prevF, [...others, o]);
    if (!p0 || p0.more) return null;
    const hz = [...others, c];
    let G = Math.max(prevF, tb);
    if (p0.at < tb) {
      const ev = physAt(p0.at);
      const fl: Flight = { t: p0.at, g: ev.g, v0: ev.v0 };
      const d = rescue(fl, tb, hz);
      const f2 = d === null ? fl : { ...fl, d };
      if (!clear(f2, landAt(f2), tb, hz, null)) return null;
      G = landAt(f2) + LAG;
    }
    for (let i = 0; i < 4; i++) {
      const p = plan(G, hz);
      if (!p) return null;
      if (p.at === Infinity) {
        o.b = c.b;
        o.smp = undefined;
        return G;
      }
      G = p.land + LAG;
    }
    return null;
  }

  // Ett tryck under spel: hopp från marken, eller dubbelhopp i luften
  function press(): EngineEvent | null {
    if (e.over) return null;
    const env = envAt(e.clock);
    if (!e.fl) {
      e.fl = { t: e.clock, g: env.g, v0: env.v0 };
      e.jumps++;
      emit("jump");
      return "jump";
    }
    if (e.fl.d !== undefined || e.clock - e.fl.t < 1 / 60) return null;
    e.fl = { ...e.fl, d: e.clock };
    e.doubles++;
    e.puffs.push({ t: e.clock, x: RX, y: GROUND - e.y });
    emit("double");
    return "double";
  }

  function step(dt: number) {
    if (e.over) return;
    const before = Math.floor(e.dist / 1000);
    e.clock += dt;
    const t = e.clock;
    e.speed = vAt(t);
    e.dist = distAt(t) - s0;
    if (levelAt(t) !== e.level) {
      e.level = levelAt(t);
      emit("level");
    }
    if (e.fl) {
      e.y = fy(e.fl, t);
      if (t >= landAt(e.fl)) {
        e.fl = null;
        e.y = 0;
      }
    }
    for (const o of e.obs) {
      o.x = xAt(o, t);
      o.y = yOf(o.k, o.x);
      if (o.b < Infinity && o.braked === undefined && distAt(t) - o.s0 >= o.b) o.braked = t;
    }
    e.obs = e.obs.filter((o) => o.x > -o.k.w - 24);
    const h = e.heart;
    if (h) {
      h.x = heartX(h, t);
      if (!h.got && catches(h, e.y, t)) {
        h.got = true;
        e.hearts++;
        if (e.lives < LIVES) {
          e.lives++;
          e.lifeAt = t;
        }
        emit("life");
      }
      if (h.x < -HEART_W || e.level !== h.level) e.heart = null;
    }
    e.puffs = e.puffs.filter((p) => t - p.t < 0.4);
    e.lights = e.lights.filter((l) => t < l.off);
    while (t >= lastT0 - 0.05) schedule();
    if (e.inv > 0) e.inv -= dt;
    else if (e.obs.some((o) => hits(o, e.y, t))) {
      e.lives--;
      if (!e.lives) {
        e.over = true;
        emit("over");
        return;
      }
      e.inv = 1.2;
      emit("ouch");
    }
    if (Math.floor(e.dist / 1000) > before) emit("coin");
  }

  return e;
}
export type Engine = ReturnType<typeof createEngine>;
