// Pixelgrafiken ritas här som ASCII, en rad per pixelrad. Varje tecken är en
// färg i PALETTE, "." är genomskinligt. Egna, generiska figurer – inga figurer,
// logotyper eller blockmönster från riktiga spel.
//
// Används på två ställen: vite.config.ts fyller vid bygget i varje
// <svg data-sprite="namn"></svg> i index.html (så grafiken syns utan JS), och
// main.ts bygger partiklar (mynt, splitter) med spriteSvg().

export const PALETTE: Record<string, string> = {
  k: "#0B0E17", // kontur
  w: "#FFFFFF",
  x: "#000000",
  y: "#FFC83D", // guld
  Y: "#C98A12",
  o: "#FFF2A8",
  r: "#E8384F",
  R: "#9E1F33",
  p: "#FF9AAE",
  g: "#5BC236", // gräs
  G: "#3A8C2A",
  l: "#8EE05A",
  d: "#8B5A2B", // jord
  D: "#5E3B1A",
  e: "#A87342",
  s: "#A3ACBF", // sten
  S: "#5B6378",
  b: "#5EC8F2", // himmel
  B: "#2E7FB8",
  c: "#CFEFFF",
  q: "#34446A", // moln mot natthimmel
  Q: "#25314F",
  u: "#4A5E8C",
  n: "#FF3EB5", // neon
  h: "#B8732F", // trä
  H: "#7A4A1C",
  m: "#EAD6A6", // karta
  M: "#B8955A",
};

export const SPRITES: Record<string, string[]> = {
  coin: [
    "..kkkk..",
    ".kyyyyk.",
    "kyooyyYk",
    "kyoyyyYk",
    "kyoyyyYk",
    "kyyyyyYk",
    ".kYYYYk.",
    "..kkkk..",
  ],
  heart: [
    ".kk...kk.",
    "kppk.krrk",
    "kprrkrrRk",
    "krrrrrrRk",
    ".krrrrRk.",
    "..krrRk..",
    "...kRk...",
    "....k....",
  ],
  "heart-empty": [
    ".kk...kk.",
    "kSSk.kSSk",
    "kSQQkQQSk",
    "kSQQQQQSk",
    ".kSQQQSk.",
    "..kSQSk..",
    "...kSk...",
    "....k....",
  ],
  cloud: [
    "......qqqq......",
    "...qqquuuuqq....",
    ".qquuuuuuuuuqq..",
    "quuuuuuuuuuuuuqq",
    "QqqqqqqqqqqqqqqQ",
    ".QQQQQQQQQQQQQQ.",
  ],
  tree: [
    "....GGGG....",
    "..GGggggGG..",
    ".GgglgggggG.",
    "GgglllggggGG",
    "GggllggggggG",
    "GgggggggglgG",
    ".GgggggglllG",
    ".GGggggglgG.",
    "..GGGgggGG..",
    "....GGGG....",
    ".....dD.....",
    ".....dD.....",
    ".....dD.....",
    "....ddDD....",
  ],
  controller: [
    "..kkkkkkkkkkkk..",
    ".kssssssssssssk.",
    "ksssksssssssyssk",
    "ksskkksSSssbsrsk",
    "ksssksssssssgssk",
    "kssssssssssssssk",
    "ksssskkkkkkssssk",
    "kSssk......kssSk",
    ".kkk........kkk.",
  ],
  tablet: [
    "kkkkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSSSk",
    "kSbbbbbbbbbbyySk",
    "kSbcccbbbbbbyySk",
    "kSbbbbbbbbbbbbSk",
    "kSbbbbbgggbbbbSk",
    "kSgggggggggggggk",
    "kSddddddeddddSSk",
    "kSdeddddddddddSk",
    "kSSSSSSSwSSSSSSk",
    "kkkkkkkkkkkkkkkk",
  ],
  // Pizzabit (16×16): spetsen uppåt, kanten nedtill. Tuggorna i main.ts
  // (initPizza) maskar bort hela pixlar.
  pizza: [
    ".......kk.......",
    ".......kk.......",
    "......kyyk......",
    "......kyok......",
    ".....koyyyk.....",
    ".....kyRryk.....",
    "....kyyrroyk....",
    "....kyyoyyyk....",
    "...kyoyyyyRrk...",
    "...kyrRyyyrrk...",
    "..kyyRryoyyyyk..",
    "..kyyyoyyyyyyk..",
    ".kyyoyyyyyyoyyk.",
    "keeeeeeeeeeeeeek",
    "khhhhhhhhhhhhhhk",
    ".kkkkkkkkkkkkkk.",
  ],
  snacks: [
    "....y..yy.y...",
    "..yyoyyoyyyy..",
    ".yyyyyYyyyyyy.",
    "kkkkkkkkkkkkkk",
    "kbbbbbbbbbbbBk",
    ".kbcbbbbbbbBk.",
    "..kbbbbbbbBk..",
    "...kkkkkkkk...",
  ],
  "chest-closed": [
    "..kkkkkkkkkkkk..",
    ".khhhhhhhhhhhhk.",
    "khhyhhhhhhhhyhhk",
    "khhyhhhhhhhhyhhk",
    "kHHyHHHHHHHHyHHk",
    "kkkkkkkyykkkkkkk",
    "khhyhhhyyhhhyhhk",
    "khhyhhhkkhhhyhhk",
    "khhyhhhhhhhhyhhk",
    "khhyhhhhhhhhyhhk",
    "kHHyHHHHHHHHyHHk",
    "kkkkkkkkkkkkkkkk",
  ],
  "chest-open": [
    ".kkkkkkkkkkkkkk.",
    "kHHyHHHHHHHHyHHk",
    "kDDDDDDDDDDDDDDk",
    "kDoDyDoyyDyoDyDk",
    "kyyoyyyyoyyyyoyk",
    "kkkkkkkyykkkkkkk",
    "khhyhhhyyhhhyhhk",
    "khhyhhhkkhhhyhhk",
    "khhyhhhhhhhhyhhk",
    "khhyhhhhhhhhyhhk",
    "kHHyHHHHHHHHyHHk",
    "kkkkkkkkkkkkkkkk",
  ],
  shades: [
    "kkkkkkkkkkkkkkkkkkkkkk",
    "..kwwkkkkk..kwwkkkkk..",
    "..kkwwkkkk..kkwwkkkk..",
    "...kkkkkk....kkkkkk...",
    "....kkkk......kkkk....",
  ],
  crown: [
    ".o.....o.....o.",
    "oyo...oyo...oyo",
    "yyy..yyyyy..yyy",
    "yyyy.yyyyy.yyyy",
    "yyyyyyyyyyyyyyy",
    "YyyryyynyyybyyY",
    "yyyyyyyyyyyyyyy",
    "YYYYYYYYYYYYYYY",
  ],
  "dig-block": [
    ".kkkkkkkkkk.",
    "kwwssssssssk",
    "kwsssssSsssk",
    "kssssyysSssk",
    "ksssyooysssk",
    "ksSsyoyysssk",
    "ksssyyyyssSk",
    "kssssyyssssk",
    "kssSssssssSk",
    "ksssssssSSSk",
    "kSSSSSSSSSSk",
    ".kkkkkkkkkk.",
  ],
  "crack-1": [
    "............",
    "............",
    "......k.....",
    ".....k......",
    ".....kk.....",
    "......k.....",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  "crack-2": [
    "............",
    "..k.........",
    "...k..k.....",
    "...kkk......",
    ".....kk..k..",
    "......kkk...",
    "...k..k.....",
    "....kk.k....",
    ".......kk...",
    "........k...",
    "............",
    "............",
  ],
  map: [
    "MMMMMMMMMMMMMMMMMMMMMMMMMMMM",
    "MbbbmmmmmmmmmmmmmmmmmmmmmmmM",
    "MbbmmmmmmmmmmmmmggmmmmmmmmmM",
    "MbmmmmmmmmmmmmmgGGgmmrmrmmmM",
    "MmmmmmmmmmmmmmmmDDmDmmrmmmmM",
    "MmmmmmmmmmmmmmmmmDmmmrmrmmmM",
    "MmmRRmmmmmmmmmmDmmmmmmmmmmmM",
    "MmRRRRmmmmmmmDmmmmmmmmmmmmmM",
    "MmhhhhmDmDmDmmmmmmmmmmmmmmmM",
    "MmhHHhmmmmmmmmmmmmmmmmmmmmmM",
    "MmmmmmmmmmmmmmmmmmmmmmmmmmmM",
    "MMMMMMMMMMMMMMMMMMMMMMMMMMMM",
  ],
  star: [
    ".c.",
    "cwc",
    ".c.",
  ],
};

export function spriteSize(name: string): [number, number] {
  const rows = SPRITES[name];
  if (!rows) throw new Error(`Okänd sprite: ${name}`);
  return [rows[0].length, rows.length];
}

// En <path> per färg, en delbana per sammanhängande vågrät pixelrad
export function spritePaths(name: string): string {
  const rows = SPRITES[name];
  if (!rows) throw new Error(`Okänd sprite: ${name}`);
  const byColor: Record<string, string[]> = {};
  rows.forEach((row, y) => {
    if (row.length !== rows[0].length) throw new Error(`Sprite ${name}: rad ${y} har fel längd`);
    for (let x = 0; x < row.length; ) {
      const ch = row[x];
      let n = 1;
      while (row[x + n] === ch) n++;
      if (ch !== ".") {
        if (!PALETTE[ch]) throw new Error(`Sprite ${name}: okänd färg "${ch}"`);
        (byColor[ch] ??= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      }
      x += n;
    }
  });
  return Object.entries(byColor)
    .map(([ch, d]) => `<path fill="${PALETTE[ch]}" d="${d.join("")}"/>`)
    .join("");
}

export function spriteSvg(name: string, scale = 3): string {
  const [w, h] = spriteSize(name);
  return `<svg viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" aria-hidden="true">${spritePaths(name)}</svg>`;
}
