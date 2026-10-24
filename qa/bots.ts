// Botar för minispelet. De kör mot motorn (src/engine.ts) – i Node för
// statistiken och i webbläsaren via window.__gameHook för helheten.
//
// Alla botar använder samma planering som utplaceringen (plan/rescue): avstamp
// mitt i hoppfönstret, dubbelhopp när ett vanligt hopp inte räcker eller när
// hoppet annars slutar i ett hinder. Skillnaden är vad boten vet:
// - perfekt (delay 0): ett hinder från första bildrutan det (eller dess
//   förvarning) syns, en inbromsning från första bildrutan den syns.
// - mänsklig (delay 0,25): samma sak 250 ms senare. Under de 250 ms efter en
//   inbromsning tror boten att bilen fortfarande kör i full fart.
// - passiv (delay null): trycker aldrig.
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
import { createEngine, plan, rescue, samples, type Engine, type Hazard, type Plan } from "../src/engine";

export function makeBot(e: Engine, delay: number | null, doubles = true, press = () => void e.press()) {
  const hidden = new WeakMap<Hazard, Hazard>();
  let key = "";
  let cached: Plan | null = null;
  let dbl: number | null = null;
  let flightKey = "";

  // Det boten vet just nu
  const view = (now: number) =>
    e.obs
      .filter((o) => now >= o.seen + delay!)
      .map((o) => {
        if (o.b === Infinity || (o.braked !== undefined && now >= o.braked + delay!)) return o;
        let u = hidden.get(o);
        if (!u) hidden.set(o, (u = { ...o, b: Infinity, smp: undefined }));
        u.x = o.x;
        return u;
      });
  const ids = new WeakMap<Hazard, number>();
  let nextId = 0;
  const id = (o: Hazard) => ids.get(o) ?? (ids.set(o, ++nextId), nextId);

  return function tick() {
    if (delay === null || e.over) return;
    const now = e.clock;
    const v = view(now);
    const k = v.map((o) => id(o)).join(",");
    if (!e.fl) {
      dbl = null;
      if (k !== key || !cached || cached.at < now - 1 / 30) {
        key = k;
        cached = plan(now, v);
      }
      // Går det inte att klara: hoppa ändå när hindret är nära (bästa försök)
      if (!cached) {
        const near = v.find((o) => samples(o).start - now < 0.25 && samples(o).end > now);
        if (near) press();
      } else if (cached.at <= now + 1e-9) press();
      return;
    }
    if (e.fl.d !== undefined || !doubles) return;
    const fk = `${k}|${e.fl.t}`;
    if (fk !== flightKey) {
      flightKey = fk;
      dbl = rescue(e.fl, now, v);
    }
    if (dbl !== null && dbl <= now + 1e-9) {
      press();
      dbl = null;
    }
  };
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
  kinds: Record<string, number>;
}

// En hel körning utan webbläsare: 60 bildrutor/s med samma delsteg som spelet
export function simulate(seed: number, delay: number | null, limit = 400, start = 0, doubles = true): RunResult {
  const crashes: number[] = [];
  const e = createEngine({ rand: seeded(seed), start, emit: (ev) => (ev === "ouch" || ev === "over") && crashes.push(e.clock) });
  const bot = makeBot(e, delay, doubles);
  const kinds: Record<string, number> = {};
  const seen = new Set<Hazard>();
  const dt = 1 / 60;
  while (!e.over && e.clock < limit) {
    bot();
    const n = Math.max(1, Math.ceil((e.speed * dt) / 4));
    for (let i = 0; i < n && !e.over; i++) e.step(dt / n);
    for (const o of e.obs) {
      if (o.x < 192 && !seen.has(o)) {
        seen.add(o);
        const nm = o.b < Infinity ? `${o.n}+broms` : o.twin ? `${o.n}+tvilling` : o.n;
        kinds[nm] = (kinds[nm] ?? 0) + 1;
      }
    }
  }
  return { end: e.clock, level: e.level, crashes, doubles: e.doubles, kinds };
}
