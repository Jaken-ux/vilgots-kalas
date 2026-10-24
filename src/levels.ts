// Minispelets miljöer: hinder, paletter, fysik och bakgrundsdekor per level-miljö.
// Grundhindren har samma höjdklasser i alla miljöer (låg 6/8, mellan 16, hög 28,
// flygare i huvudhöjd). Varje miljö har dessutom egna hinder med förvarning.
// Sprites är ASCII-rader med tecken ur PALETTE i sprites.ts ("." = genomskinligt).
import { SPRITES } from "./sprites";

export const GROUND = 80; // markens överkant
// Dykare: från DIVE_TOP ner till huvudhöjd DIVE_LOW under 60 px
export const DIVE_TOP = 30;
export const DIVE_LOW = 69;

// Hindertyper. f = animationsrutor (sprite-rader), w/h = träffytans storlek,
// y = träffytans överkant (marken om inget anges), dive = avstånd där dykaren
// når huvudhöjd, pair = kan komma två i rad. Resten är egna beteenden:
// move = egen fart mot gubben (andel av markfarten), drop = faller ner från
// taket eller himlen och blir ett hinder först när det landat (fall = spriten
// under fallet), shot = skott
// från ett rymdskepp, hole = hål i marken, hang = hänger från taket.
export interface Kind {
  f: string[][];
  w: number;
  h: number;
  y: number;
  dive?: number;
  pair?: boolean;
  move?: number;
  drop?: "roof" | "sky";
  fall?: string[];
  shot?: boolean;
  hole?: boolean;
  hang?: boolean;
}
const kind = (f: string[][], y?: number, o?: Partial<Kind>): Kind => {
  const h = o?.h ?? f[0].length;
  return { f, w: f[0][0].length, h, y: y ?? GROUND - h, ...o };
};
// Samma sprite med andra färger, t.ex. { n: "u" }
const recolor = (rows: string[], map: Record<string, string>) =>
  rows.map((r) => r.replace(/./g, (c) => map[c] ?? c));
const rep = (n: number, row: string) => Array.from({ length: n }, () => row);

// ----- Gräs -----
const BUSH = ["...GGG....", ".GGgggGG..", "GgglggggG.", "GgggggglgG", "GggggggggG", "GGGGGGGGGG"];
const BLOCK = ["kkkkkkkk", "kwssssSk", "kssssssk", "kssSsssk", "ksssssSk", "kSssssSk", "kSSSSSSk", "kkkkkkkk"];
const BIG = [...BLOCK, ...BLOCK].map((r) => r + r); // 16×16
const PILLAR = ["kkkkkk", ...Array.from({ length: 26 }, (_, i) => (i % 7 === 6 ? "kSSSSk" : "kwsssk")), "kkkkkk"];
const BIRD = [
  ["bb....bb", ".bbkbbb.", "..bbbbyy", "........"],
  ["........", "..bkbbb.", ".bbbbbyy", "bb....bb"],
];
// Bred häck (16×28): tätt högt par av dessa kräver dubbelhopp
const HEDGE = Array.from({ length: 28 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => (x % 15 === 0 || !y ? "G" : (x * 3 + y * 5) % 7 ? ((x + y) % 4 ? "g" : "G") : "l")).join("")
);
// Dykaren: neonfärgad, stora vingslag (vingarna upp, sedan ner)
const WING = ["n........n", ".nn....nn."];
const BODY = ["..nnknnnyy", "...nnnnn.."];
const NONE = "..........";
const DIVE = [
  [...WING, ...BODY, NONE, NONE],
  [NONE, NONE, ...BODY, ...WING.slice().reverse()],
];

// ----- Grotta -----
const STALAGMITE = ["...ss...", "...sS...", "..ssS...", "..sssS..", ".ssssSS.", "sssssSSS"];
const ROCK = recolor(BLOCK, { w: "c" });
const BOULDER = recolor(BIG, { w: "c" });
const COLUMN = ["..ss..", "..sS..", ".ssS..", ...rep(23, ".ssSS."), "ssssSS", "ssssSS"];
// Ljusa vingar och röda ögon: mörka färger försvinner mot grottans svarta himmel
const BAT = [
  ["ss....ss", ".ssSSss.", "...rr...", "........"],
  ["........", "..sSSs..", ".ssrrss.", "ss....ss"],
];
const COLUMNS = Array.from({ length: 28 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => (x > 12 || (x * 7 + y * 3) % 11 === 0 ? "S" : x % 15 && y ? "s" : "S")).join("")
);
const STALACTITE = ["SSSSSS", "SsssSS", ".sssS.", ".ssS..", "..sS..", "..sS..", "..s...", "..s..."];
// Lossnad stalaktit: spetsen nere i marken, bred topp, grus runt foten (8×16)
const SHARD = [
  "SSSSSSSS", "SssssssS", ".sssssS.", ".sssssS.", ".ssssSS.", "..sssS..", "..sssS..", "..ssSS..",
  "...ssS..", "...ssS..", "...sS...", "...sS...", "...sS...", "..ssSs..", ".sSssSs.", "sSsSSsSs",
];
// Hängande stalaktit ner till strax ovanför huvudet: spring under, hoppa inte (8×68)
const HANG = Array.from({ length: GROUND - 12 }, (_, y) =>
  y < 56 ? (y % 9 === 4 ? ".sSSSSs." : ".ssSSSs.") : y < 61 ? "..sSSs.." : y < 65 ? "...sS..." : "...s...."
);

// ----- Stad -----
const CONE = ["..hh..", "..ww..", ".hhhh.", ".wwww.", "hhhhhh", "HHHHHH"];
const MAILBOX = [".BBBBB..", "BbbbbbBr", "BbwwbbBr", "BbbbbbB.", "BBBBBBB.", "...kk...", "...kk...", "..kkkk.."];
const DUMPSTER = [
  "kkkkkkkkkkkkkkkk",
  ...Array.from({ length: 12 }, (_, i) => (i % 3 === 1 ? "kGgGGGgGGgGGGgGk" : "kGGGGGGGGGGGGGGk")),
  "kkkkkkkkkkkkkkkk",
  ".kk..........kk.",
  ".kk..........kk.",
];
// Lastbil från sidan, 24×28: skåp, hytt åt höger, chassi och runda hjul (två bak, ett fram)
const WHEEL = [".kkk.", "kSwSk", "kSSSk", ".kkk."];
const TRUCK = Array.from({ length: 28 }, (_, y) => {
  const box = y === 0 || y === 21 ? "k".repeat(18) : y < 21 ? "k" + (y === 10 ? "r" : "w").repeat(16) + "k" : "";
  const cab = y < 10 ? "......" : y === 10 ? "kkkkk." : y < 14 ? "krbbbk" : y < 21 ? "krrrrk" : "kkkkkk";
  if (y < 22) return box + cab;
  if (y < 24) return "k".repeat(24);
  const w = WHEEL[y - 24];
  return "." + w + "." + w + "......" + w + ".";
});
const DRONE = [
  ["ww....ww", ".kssssk.", "..ssrs..", "........"],
  [".ww..ww.", ".kssssk.", "..ssrs..", "........"],
];
const HOUSE = Array.from({ length: 22 }, (_, y) =>
  y === 0 ? ".QQQQQQQQQQQQQQQQQQ." : Array.from({ length: 20 }, (_, x) => (x % 4 === 2 && y % 5 === 2 && (x * y) % 3 ? "y" : "Q")).join("")
);
// Öppet brunnslock: hålet (14 px brett) ner i asfalten, locket bredvid
const HOLE = [
  "..............ssss..",
  ".SSSSSSSSSSSS.SssssS",
  "SkkkkkkkkkkkkS......",
  "kxxxxxxxxxxxxk......",
  ".kxxxxxxxxxxk.......",
  "..kkkkkkkkkk........",
];
// Bilar mot gubben (fronten åt vänster): liten röd bil (låg) och blå skåpbil (mellan)
const CAR = [
  "....kkkkkk....",
  "...kcckccck...",
  "..kccckcccck..",
  "kkkkkkkkkkkkkk",
  "kyrrrrrrrrrrRk",
  "krrrrrrrrrrrRk",
  "kkkkkkkkkkkkkk",
  ".kSk......kSk.",
];
const VAN = Array.from({ length: 16 }, (_, y) =>
  y > 13
    ? `..k${y > 14 ? "S" : "k"}k..........k${y > 14 ? "S" : "k"}k....`
    : y % 13
      ? "k" + (y > 1 && y < 5 ? "cckBccckBccckBccckBB" : y === 8 ? "w".repeat(20) : y === 12 ? "yBBBBBBBBBBBBBBBBBBR" : "B".repeat(20)) + "k"
      : "k".repeat(22)
);

// ----- Rymd -----
const CRATER = ["...ssss...", ".ssSSSSss.", "sSSkkkkSSs", "sSkkkkkkSs", "ssSSSSSSss", "ssssssssss"];
const MOONROCK = recolor(BLOCK, { k: "S", w: "c", s: "s", S: "S" });
const LANDER = recolor(BIG, { k: "S", w: "c" });
const ROCKET = [
  "..rr..", ".rrrr.", ".wwww.", "wwbbww", "wwbbww",
  ...Array.from({ length: 19 }, (_, i) => (i % 6 === 5 ? "rrrrrr" : "wwwwww")),
  "rwwwwr", "rrwwrr", "rr..rr", "r....r",
];
// Bränsletank (16×28)
const TANK = Array.from({ length: 28 }, (_, y) =>
  y < 2 ? "..SSSSSSSSSSSS.." : y % 9 === 4 ? "SyyyyyyyyyyyyyyS" : "Sccsssssss" + (y % 9 === 5 ? "rr" : "ss") + "sSSS"
);
const SATELLITE = [
  ["BB.yy.BB", "bbyyyybb", "BB.yy.BB", "...k...."],
  ["BB.yy.BB", "bbyrrybb", "BB.yy.BB", "...k...."],
];
const STARS = [
  ".......w........", "................", "..w.............", "............c...", "......c.........",
  "w...............", "..........w.....", "................", "....c........w..", "................",
];
// Meteorit i luften (glöd bakåt) och nedslagen: glödande sten, låg 8 eller mellan 16
const METEOR = ["....yy", "..yyrr", ".yrSSk", "yrSssk", "yrSsSk", ".kkkk."];
const HOTROCK = recolor(BLOCK, { k: "S", w: "y", s: "s", S: "r" });
const HOTBIG = recolor(BIG, { k: "S", w: "y", S: "r" });
// Skott i huvudhöjd (hoppa) och i hopphöjd (stå kvar)
const SHOT = ["oyyyyy", "nnnnnn", "oyyyyy"];

// Färger per miljö: himmel, markens överkant, kantlinje, mark, prickar/streck
export interface Palette {
  sky: string;
  top: string;
  edge: string;
  fill: string;
  dot: string;
}

export interface Env {
  name: string;
  pal: Palette;
  dot: [number, number]; // prickarnas storlek (stadens asfalt: vita streck)
  kinds: Record<string, Kind>;
  // Blandning efter uppvärmningen: [enhet, vikt]. En enhet är ett hinder eller
  // en grupp (bilrad, rymdskepp med skott), se pick() i engine.ts.
  mix: [string, number][];
  // Hopp: gravitation och utgångsfart (rymden: lägre gravitation, längre hopp)
  g: number;
  v0: number;
  decor: { f: string[]; y: number[]; par: number }; // dekor: sprite, y per plats, parallax
}

const base = (low1: string[], low2: string[], mid: string[], high: string[], wide: string[], flyer: string[][], diver: string[][]) => ({
  bush: kind([low1], undefined, { pair: true }), // låg
  block: kind([low2], undefined, { pair: true }), // låg
  big: kind([mid], undefined, { pair: true }), // mellan: kräver bra timing (par från level 2)
  pillar: kind([high]), // hög: hoppa tidigt
  wall: kind([wide]), // hög och bred: två tätt i rad kräver dubbelhopp
  bird: kind(flyer, GROUND - 10), // rakt fram i huvudhöjd
  dive: kind(diver, DIVE_LOW, { dive: 30 }), // når huvudhöjd innan den är framme: hoppa
  swoop: kind(diver, DIVE_LOW, { dive: -40 }), // sveper över huvudet: stå kvar
});
const MIX: [string, number][] = [["bush", 20], ["block", 15], ["big", 20], ["pillar", 15], ["bird", 10], ["dive", 10], ["swoop", 10]];

// Normal fysik: 0,58 s i luften och 37 px topphöjd
const G = 900;
const V0 = 260;

// I ordning: gräs, grotta, stad, rymd – sedan varv 2 från början
export const ENVS: Env[] = [
  {
    name: "gras",
    pal: { sky: "#10162C", top: "#5BC236", edge: "#3A8C2A", fill: "#8B5A2B", dot: "#5E3B1A" },
    dot: [2, 2],
    kinds: base(BUSH, BLOCK, BIG, PILLAR, HEDGE, BIRD, DIVE),
    mix: MIX,
    g: G,
    v0: V0,
    decor: { f: SPRITES.cloud, y: [14, 23, 32, 18], par: 0.3 },
  },
  {
    name: "grotta",
    pal: { sky: "#08070C", top: "#8A93A6", edge: "#5B6378", fill: "#3A3F4D", dot: "#25314F" },
    dot: [3, 2],
    kinds: {
      ...base(STALAGMITE, ROCK, BOULDER, COLUMN, COLUMNS, BAT, DIVE.map((f) => recolor(f, { y: "n", k: "r" }))),
      drop: kind([SHARD], undefined, { drop: "roof", fall: SHARD }), // droppar ~1 s, lossnar, landar framför: hoppa
      hang: kind([HANG], 0, { hang: true }), // hänger ner till huvudet: hoppa inte
    },
    mix: [...MIX, ["drop", 18], ["hang", 16]],
    g: G,
    v0: V0,
    decor: { f: STALACTITE, y: [0, 0, 0, 0], par: 0.5 },
  },
  {
    name: "stad",
    pal: { sky: "#0B0E2A", top: "#6B6B78", edge: "#4B4B55", fill: "#2A2A33", dot: "#D8D8E0" },
    dot: [6, 1],
    kinds: {
      ...base(CONE, MAILBOX, DUMPSTER, TRUCK, TRUCK, DRONE, DIVE.map((f) => recolor(f, { y: "r" }))),
      hole: kind([HOLE], GROUND - 2, { w: 14, h: 3, hole: true }), // trillar man i är det en krock
      car: kind([CAR], undefined, { move: 0.5 }), // liten och snabb (låg)
      van: kind([VAN], undefined, { move: 0.25 }), // stor och långsammare (mellan)
    },
    mix: [...MIX, ["hole", 22], ["cars", 22]],
    g: G,
    v0: V0,
    decor: { f: HOUSE, y: [GROUND - 22, GROUND - 22, GROUND - 22, GROUND - 22], par: 0.45 },
  },
  {
    name: "rymd",
    pal: { sky: "#000000", top: "#C8C8D0", edge: "#9A9AA8", fill: "#8C8C99", dot: "#5B6378" },
    dot: [3, 2],
    kinds: {
      ...base(CRATER, MOONROCK, LANDER, ROCKET, TANK, SATELLITE, DIVE.map((f) => recolor(f, { y: "b" }))),
      meteor: kind([HOTROCK], undefined, { drop: "sky", fall: METEOR }), // skugga ~1 s före nedslag
      meteorBig: kind([HOTBIG], undefined, { drop: "sky", fall: METEOR }),
      shotLow: kind([SHOT], GROUND - 10, { shot: true, move: 0.6 }), // huvudhöjd: hoppa
      shotHigh: kind([SHOT], GROUND - 26, { shot: true, move: 0.6 }), // hopphöjd: stå kvar
    },
    mix: [...MIX, ["meteor", 20], ["ship", 18]],
    // Lägre gravitation: lika högt hopp men 0,76 s i luften i stället för 0,58
    g: 560,
    v0: 212,
    decor: { f: STARS, y: [6, 20, 10, 28], par: 0.15 },
  },
];
