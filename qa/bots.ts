// Botar för minispelet. De kör mot motorn (src/engine.ts) – i Node för
// statistiken och i webbläsaren via window.__gameHook för helheten.
//
// Alla botar använder samma planering som utplaceringen (plan/rescue): avstamp
// mitt i hoppfönstret, dubbelhopp när hoppet annars slutar i ett hinder.
// Skillnaden är vad boten vet och hur exakt den trycker:
// - perfekt: ett hinder (eller dess förvarning) och en inbromsning från första
//   bildrutan de syns.
// - mänsklig: reaktionstid 300 ms ± 120 ms (slumpad per hinder), för hinder,
//   inbromsningar och hjärtan. 10 % av hoppen är panikhopp 0,1–0,3 s för
//   tidigt; boten försöker då rädda sig med ett dubbelhopp. Under reaktions-
//   tiden efter en inbromsning tror den att bilen kör i full fart.
// - passiv: trycker aldrig.
// Med hunt går boten på hjärtat (hopp + dubbelhopp) när den sett det.
//
// Klarningsregler per hinder (planeringen räknar fram dem ur träffytorna):
// - låga, mellan, höga, hål, bilar, nedslagna meteoriter, lossnad stalaktit,
//   skott i huvudhöjd: hoppa så att gubben är ovanför hindret hela tiden det
//   överlappar i sidled (bilar och skott med sin egen fart).
// - hängande stalaktit, svepande dykare, skott i hopphöjd: stå på marken medan
//   det passerar.
// - tätt högt par: ett hopp och ett dubbelhopp.
// - bil som bromsar: planera om när inbromsningen syns (dubbelhopp om boten
//   redan är i luften).
import { catchPlans, createEngine, plan, rescue, samples, type Engine, type Hazard, type Heart, type Plan } from "../src/engine";

export type BotKind = "perfect" | "human" | "passive";
export interface BotOpts {
  doubles?: boolean; // får dubbelhoppa (false = bevis för att dubbelhoppet behövs)
  hunt?: boolean; // går på hjärtan
  rand?: () => number; // botens egen slump (reaktionstid, panikhopp)
  press?: () => void;
}

export function makeBot(e: Engine, kind: BotKind, o: BotOpts = {}) {
  const doubles = o.doubles ?? true;
  const rand = o.rand ?? Math.random;
  const press = o.press ?? (() => void e.press());
  const human = kind === "human";
  const hidden = new WeakMap<Hazard, Hazard>();
  const delays = new WeakMap<object, number>();
  const panics = new WeakMap<object, number>();
  // Reaktionstid och panik slumpas en gång per hinder/hjärta
  const delay = (x: object) => {
    if (!human) return 0;
    let d = delays.get(x);
    if (d === undefined) delays.set(x, (d = 0.3 + (rand() - 0.5) * 0.24));
    return d;
  };
  const panic = (x: object) => {
    if (!human) return 0;
    let p = panics.get(x);
    if (p === undefined) panics.set(x, (p = rand() < 0.1 ? 0.1 + 0.2 * rand() : 0));
    return p;
  };
  let key = "";
  let cached: Plan | null = null;
  let dbl: number | null = null;
  let flightKey = "";
  let heartFlight: number | null = null; // andra trycket i ett hjärthopp
  let chosen: { h: Heart; p: Plan } | null = null;
  const state = { heartJumps: 0, heartCrashes: 0, inHeartJump: false };

  // Det boten vet just nu
  const view = (now: number) =>
    e.obs
      .filter((x) => now >= x.seen + delay(x))
      .map((x) => {
        if (x.b === Infinity || (x.braked !== undefined && now >= x.braked + delay(x))) return x;
        let u = hidden.get(x);
        if (!u) hidden.set(x, (u = { ...x, b: Infinity, smp: undefined }));
        u.x = x.x;
        return u;
      });
  const ids = new WeakMap<Hazard, number>();
  let nextId = 0;
  const id = (x: Hazard) => ids.get(x) ?? (ids.set(x, ++nextId), nextId);

  // Hjärthoppet: mitt bland alla hopp som tar hjärtat, eller det tidigaste som
  // fortfarande går om boten är sen
  const heartPlan = (now: number): Plan | null => {
    const h = e.heart;
    if (!o.hunt || !h || h.got || now < h.seen + delay(h)) return null;
    const ps = catchPlans(h);
    if (!chosen || chosen.h !== h || chosen.p.at < now - 1 / 30) {
      const ok = ps.filter((p) => p.at >= now - 1e-9);
      if (!ok.length) return null;
      const mid = ps[ps.length >> 1];
      chosen = { h, p: mid.at >= now ? mid : ok[0] };
    }
    return chosen.p;
  };

  function tick() {
    if (kind === "passive" || e.over) return;
    const now = e.clock;
    const v = view(now);
    const k = v.map((x) => id(x)).join(",");
    if (!e.fl) {
      dbl = null;
      heartFlight = null;
      state.inHeartJump = false;
      if (k !== key || !cached || cached.at < now - 1 / 30) {
        key = k;
        cached = plan(now, v);
      }
      const hp = heartPlan(now);
      if (hp && (!cached || hp.at <= cached.at)) {
        const off = panic(hp);
        if (now >= hp.at - off - 1e-9) {
          press();
          heartFlight = hp.dbl! - off;
          state.heartJumps++;
          state.inHeartJump = true;
        }
        return;
      }
      // Går det inte att klara: hoppa ändå när hindret är nära (bästa försök)
      if (!cached) {
        const near = v.find((x) => samples(x).start - now < 0.25 && samples(x).end > now);
        if (near) press();
      } else if (now >= cached.at - (cached.h ? panic(cached.h) : 0) - 1e-9) press();
      return;
    }
    if (e.fl.d !== undefined || !doubles) return;
    if (heartFlight !== null) {
      if (now >= heartFlight - 1e-9) press();
      return;
    }
    const fk = `${k}|${e.fl.t}`;
    if (fk !== flightKey) {
      flightKey = fk;
      dbl = rescue(e.fl, now, v);
    }
    if (dbl !== null && dbl <= now + 1e-9) {
      press();
      dbl = null;
    }
  }
  return Object.assign(tick, { state });
}
// Seedad slump (mulberry32), så att körningarna går att upprepa
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RunResult {
  end: number; // speltid vid game over
  level: number;
  crashes: number[];
  doubles: number;
  hearts: number; // plockade hjärtan
  heartJumps: number;
  heartCrashes: number; // krockar under ett hjärthopp (ska alltid vara 0)
  kinds: Record<string, number>;
}

// En hel körning utan webbläsare: 60 bildrutor/s med samma delsteg som spelet.
// Spelets och botens slump är skilda frön, så att boten inte ändrar banan.
export function simulate(seed: number, kind: BotKind, o: BotOpts & { limit?: number; start?: number } = {}): RunResult {
  const crashes: number[] = [];
  let bot: ReturnType<typeof makeBot> | null = null;
  let heartCrashes = 0;
  const e = createEngine({
    rand: seeded(seed),
    start: o.start ?? 0,
    emit: (ev) => {
      if (ev !== "ouch" && ev !== "over") return;
      crashes.push(e.clock);
      if (bot?.state.inHeartJump) heartCrashes++;
    },
  });
  bot = makeBot(e, kind, { rand: seeded(seed * 7919 + 1), ...o });
  const kinds: Record<string, number> = {};
  const seen = new Set<Hazard>();
  const dt = 1 / 60;
  const limit = o.limit ?? 400;
  while (!e.over && e.clock < limit) {
    bot();
    const n = Math.max(1, Math.ceil((e.speed * dt) / 4));
    for (let i = 0; i < n && !e.over; i++) e.step(dt / n);
    for (const x of e.obs) {
      if (x.x < 192 && !seen.has(x)) {
        seen.add(x);
        const nm = x.b < Infinity ? `${x.n}+broms` : x.twin ? `${x.n}+tvilling` : x.n;
        kinds[nm] = (kinds[nm] ?? 0) + 1;
      }
    }
  }
  return { end: e.clock, level: e.level, crashes, doubles: e.doubles, hearts: e.hearts, heartJumps: bot.state.heartJumps, heartCrashes, kinds };
}
