// Minispelets miljöer: hinder, paletter och bakgrundsdekor per level-miljö.
// Hindren har samma höjdklasser i alla miljöer (låg 6/8, mellan 16, hög 28,
// flygare i huvudhöjd), så fysiken och rättvisekalkylen i game.ts gäller överallt.
// Sprites är ASCII-rader med tecken ur PALETTE i sprites.ts ("." = genomskinligt).
import { SPRITES } from "./sprites";

export const GROUND = 80; // markens överkant
// Dykare: från DIVE_TOP ner till huvudhöjd DIVE_LOW under 60 px
export const DIVE_TOP = 30;
export const DIVE_LOW = 69;

// Hindertyper. f = animationsrutor (sprite-rader), w/h = storlek, y = överkant
// (marken om inget anges), dive = avstånd där dykaren når huvudhöjd,
// stand = ska INTE hoppas över, pair = kan komma två i rad.
export interface Kind {
  f: string[][];
  w: number;
  h: number;
  y: number;
  dive?: number;
  stand?: boolean;
  pair?: boolean;
}
const kind = (f: string[][], y?: number, o?: Partial<Kind>): Kind => {
  const h = f[0].length;
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
const STALACTITE = ["SSSSSS", "SsssSS", ".sssS.", ".ssS..", "..sS..", "..sS..", "..s...", "..s..."];

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

// ----- Rymd -----
const CRATER = ["...ssss...", ".ssSSSSss.", "sSSkkkkSSs", "sSkkkkkkSs", "ssSSSSSSss", "ssssssssss"];
const MOONROCK = recolor(BLOCK, { k: "S", w: "c", s: "s", S: "S" });
const LANDER = recolor(BIG, { k: "S", w: "c" });
const ROCKET = [
  "..rr..", ".rrrr.", ".wwww.", "wwbbww", "wwbbww",
  ...Array.from({ length: 19 }, (_, i) => (i % 6 === 5 ? "rrrrrr" : "wwwwww")),
  "rwwwwr", "rrwwrr", "rr..rr", "r....r",
];
const SATELLITE = [
  ["BB.yy.BB", "bbyyyybb", "BB.yy.BB", "...k...."],
  ["BB.yy.BB", "bbyrrybb", "BB.yy.BB", "...k...."],
];
const STARS = [
  ".......w........", "................", "..w.............", "............c...", "......c.........",
  "w...............", "..........w.....", "................", "....c........w..", "................",
];

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
  kinds: Record<"bush" | "block" | "big" | "pillar" | "bird" | "dive" | "swoop", Kind>;
  decor: { f: string[]; y: number[]; par: number }; // dekor: sprite, y per plats, parallax
}

const kinds = (low1: string[], low2: string[], mid: string[], high: string[], flyer: string[][], diver: string[][]) => ({
  bush: kind([low1], undefined, { pair: true }), // låg
  block: kind([low2], undefined, { pair: true }), // låg
  big: kind([mid]), // mellan: kräver bra timing
  pillar: kind([high]), // hög: hoppa tidigt
  bird: kind(flyer, GROUND - 10), // rakt fram i huvudhöjd
  dive: kind(diver, DIVE_LOW, { dive: 30 }), // når huvudhöjd innan den är framme: hoppa
  swoop: kind(diver, DIVE_LOW, { dive: -40, stand: true }), // sveper över huvudet: stå kvar
});

// I ordning: gräs, grotta, stad, rymd – sedan varv 2 från början
export const ENVS: Env[] = [
  {
    name: "gras",
    pal: { sky: "#10162C", top: "#5BC236", edge: "#3A8C2A", fill: "#8B5A2B", dot: "#5E3B1A" },
    dot: [2, 2],
    kinds: kinds(BUSH, BLOCK, BIG, PILLAR, BIRD, DIVE),
    decor: { f: SPRITES.cloud, y: [14, 23, 32, 18], par: 0.3 },
  },
  {
    name: "grotta",
    pal: { sky: "#08070C", top: "#8A93A6", edge: "#5B6378", fill: "#3A3F4D", dot: "#25314F" },
    dot: [3, 2],
    kinds: kinds(STALAGMITE, ROCK, BOULDER, COLUMN, BAT, DIVE.map((f) => recolor(f, { y: "n", k: "r" }))),
    decor: { f: STALACTITE, y: [0, 0, 0, 0], par: 0.5 },
  },
  {
    name: "stad",
    pal: { sky: "#0B0E2A", top: "#6B6B78", edge: "#4B4B55", fill: "#2A2A33", dot: "#D8D8E0" },
    dot: [6, 1],
    kinds: kinds(CONE, MAILBOX, DUMPSTER, TRUCK, DRONE, DIVE.map((f) => recolor(f, { y: "r" }))),
    decor: { f: HOUSE, y: [GROUND - 22, GROUND - 22, GROUND - 22, GROUND - 22], par: 0.45 },
  },
  {
    name: "rymd",
    pal: { sky: "#000000", top: "#C8C8D0", edge: "#9A9AA8", fill: "#8C8C99", dot: "#5B6378" },
    dot: [3, 2],
    kinds: kinds(CRATER, MOONROCK, LANDER, ROCKET, SATELLITE, DIVE.map((f) => recolor(f, { y: "b" }))),
    decor: { f: STARS, y: [6, 20, 10, 28], par: 0.15 },
  },
];
