// Delad topplista för minispelet (Firebase Realtime Database, /scores).
// OPT-IN: inget postas utan att gästen svarat "Ja!" eller kryssat "Posta alltid".
// Listan ligger i en utfällbar panel direkt under spelet (#board). Firebase
// laddas först när den behövs (första spelstart eller när Bonus level-sektionen
// syns), aldrig vid sidladdning. Allt är inlindat i try/catch och
// tidsgränser: svarar eller nekar Firebase visas det lokala rekordet i stället.
import { content } from "./content";
import { PALETTE } from "./sprites";
import type { InfoLine } from "./game";

export interface Score {
  name: string;
  score: number;
  updatedAt?: number;
}
export type Scores = Record<string, Score> | null;

// Det topplistan behöver av databasen. Firebase-versionen finns i
// firebase-backend.ts; testsviten ersätter den med window.__leaderboardBackend.
export interface Backend {
  listen(onData: (all: Scores) => void, onError: (e: unknown) => void): void;
  // Skriver bara om poängen är högre än den sparade. true = skrivet.
  post(key: string, entry: { name: string; score: number }): Promise<boolean>;
}

export const MAX_SCORE = 99999;
const TIMEOUT_MS = 5000;
const AUTO_KEY = "vilgots-kalas-autopost"; // + ":<gäst>", per gäst
const OPEN_KEY = "vilgots-kalas-board-open"; // utfälld panel, per webbläsare (utfälld om inget sparats)

// Gästens nyckel (gemener) och visningsnamn – bara om ?g-namnet finns i gästlistan
export function guestIdentity(g: string): { key: string; name: string } | null {
  const key = g.trim().toLowerCase();
  const name = content.guests.find((n) => n.toLowerCase() === key);
  return key && name ? { key, name } : null;
}

export interface Row {
  key: string;
  name: string;
  score: number;
  rank: number;
}

// Högst poäng först; vid lika poäng den som kom dit först, sedan namn
export function ranking(all: Scores): Row[] {
  return Object.entries(all ?? {})
    .filter(([, s]) => s && typeof s.score === "number")
    .map(([key, s]) => ({ key, s }))
    .sort((a, b) => b.s.score - a.s.score || (a.s.updatedAt ?? 0) - (b.s.updatedAt ?? 0) || a.key.localeCompare(b.key))
    .map(({ key, s }, i) => ({
      key,
      // Visningsnamnet från gästlistan (rätt stavning), annars det sparade
      name: content.guests.find((n) => n.toLowerCase() === key) ?? String(s.name),
      score: s.score,
      rank: i + 1,
    }));
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

// Visningsnamnet överallt på topplistan: "Familjen Vilgot". Databasnyckeln och
// det sparade namnet är fortfarande bara gästnamnet.
export const family = (name: string) => `Familjen ${name}`;
// Genitiv: "Familjen Vilgots", men "Familjen Elias" (slutar på s, x eller z)
export const genitive = (s: string) => (/[sxz]$/i.test(s) ? s : s + "s");
// Utan giltig ?g-länk: ingen plats på listan
export const NO_LINK = "Du spelar utan inbjudningslänk. Öppna länken från sms:et för att tävla.";
const NO_LINK_LINES = ["Du spelar utan", "inbjudningslänk.", "Öppna länken från", "sms:et för att tävla."];

// Versalt Å saknar synlig ring i Press Start 2P (och Ä/Ö blir små): sådana namn
// skrivs med gemener i pixelfonten, "Åsa" → "åsa". Datan ändras inte.
export const pixelSafe = (name: string) => (/[ÅÄÖ]/.test(name) ? name.toLowerCase() : name);

// En rad på game over-skärmen (högst 23 tecken): "1. Familjen Vilgot 1234".
// Räcker inte platsen blir det "Fam. Vilgot", annars kapas namnet.
export function scoreLine(rank: number, name: string, score: number) {
  const room = 23 - String(rank).length - 3 - String(score).length;
  let n = family(name);
  if (n.length > room) n = `Fam. ${name}`;
  return `${rank}. ${pixelSafe(n.slice(0, room)).padEnd(room)} ${score}`;
}

interface Options {
  guest: string; // ?g-namnet (kan vara tomt eller okänt)
  play(sound: "chest"): void;
  toast(text: string): void;
  localBest(): number;
}

export function initLeaderboard(opts: Options) {
  const me = guestIdentity(opts.guest);
  const board = document.getElementById("board");
  const toggle = document.getElementById("board-toggle");
  const list = document.getElementById("board-list") as HTMLOListElement | null;
  const panel = document.getElementById("game-panel");
  const yes = document.getElementById("btn-post-yes");
  const no = document.getElementById("btn-post-no");
  const always = document.getElementById("post-always") as HTMLInputElement | null;

  let backend: Backend | null = null;
  let status: "off" | "loading" | "ok" | "fail" = "off";
  let rows: Row[] = [];
  let topScore: number | null = null; // ettans poäng i förra ögonblicksbilden
  let lastOver: number | null = null; // poängen på game over-skärmen som visas nu
  let offered = 0; // högsta poäng vi frågat om den här sessionen
  let postFailed = false;
  let game: { info(l: InfoLine[]): void; hold(on: boolean): void } | null = null;

  const autoPost = () => {
    try {
      return !!me && localStorage.getItem(`${AUTO_KEY}:${me.key}`) === "1";
    } catch {
      return false;
    }
  };

  // ----- Utfällbar panel under spelet -----
  const setOpen = (open: boolean, save = true) => {
    if (!list || !toggle) return;
    list.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (!save) return;
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      // Privat läge: läget sparas inte
    }
  };
  const savedOpen = () => {
    try {
      // Utfälld som standard; ihopfälld bara om gästen själv fällt ihop den
      return localStorage.getItem(OPEN_KEY) !== "0";
    } catch {
      return true;
    }
  };

  // ----- Listan -----
  const row = (rank: string, name: string, score: string, cls = "") => {
    const li = document.createElement("li");
    li.className = `hs-row ${cls}`;
    for (const [c, t] of [["hs-rank", rank], ["hs-name", name], ["hs-dots", ""], ["hs-score", score]]) {
      const s = document.createElement("span");
      s.className = c;
      s.textContent = t;
      if (c === "hs-dots") s.setAttribute("aria-hidden", "true");
      li.appendChild(s);
    }
    return li;
  };

  // En rad med bara text (laddar, fel, tips, lokalt rekord)
  const note = (text: string, cls = "") => {
    const li = document.createElement("li");
    li.className = `hs-note ${cls}`;
    li.textContent = text;
    return li;
  };

  // Topp 10, egen rad markerad (och egen placering under om den är längre ner).
  // Webbläsarens eget rekord står alltid sist – det är också reserven när
  // Firebase inte svarar.
  const renderList = () => {
    if (!list) return;
    const items: HTMLElement[] = [];
    if (status === "off" || status === "loading") items.push(note("Laddar topplistan…"));
    else if (status === "fail") items.push(note("Topplistan svarar inte just nu", "hs-error"));
    else {
      for (const r of rows.slice(0, 10)) {
        items.push(row(String(r.rank), pixelSafe(family(r.name)), String(r.score), r.key === me?.key ? "hs-me" : ""));
      }
      const mine = me && rows.find((r) => r.key === me.key);
      if (mine && mine.rank > 10) items.push(row("", "…", ""), row(String(mine.rank), pixelSafe(family(mine.name)), String(mine.score), "hs-me"));
      if (!rows.length) items.push(note("Ingen på listan än – bli först!"));
      if (me && !mine) items.push(row(String(rows.length + 1), "Du?", "???", "hs-you"));
      if (!me) items.push(note(NO_LINK));
    }
    const best = opts.localBest();
    if (best > 0) items.push(note(`Ditt rekord: ${best}`, "hs-local"));
    list.replaceChildren(...items);
  };

  // ----- Topp 3 och egen placering på game over-skärmen -----
  // Utan giltig ?g: bara ettan och raderna om inbjudningslänken (max 5 rader)
  const renderInfo = () => {
    if (!game || lastOver === null) return;
    const lines: InfoLine[] = [];
    const sr: string[] = []; // samma sak i hela meningar för skärmläsare
    const add = (t: string, c: string) => (lines.push([t, c]), sr.push(t));
    const noLink = () => (lines.push(...NO_LINK_LINES.map((t): InfoLine => [t, PALETTE.b])), sr.push(NO_LINK));
    if (status === "fail" || postFailed) {
      add(postFailed ? "Kunde inte posta" : "Topplistan svarar inte", PALETTE.r);
      add(`Ditt rekord: ${opts.localBest()}`, PALETTE.b);
    } else if (status === "ok") {
      for (const r of rows.slice(0, me ? 3 : 1)) {
        lines.push([scoreLine(r.rank, r.name, r.score), r.key === me?.key ? PALETTE.n : PALETTE.w]);
        sr.push(`${r.rank}. ${family(r.name)} ${r.score}`);
      }
      const mine = me && rows.find((r) => r.key === me.key);
      if (!me) noLink();
      else if (mine) add(`Du: plats ${mine.rank} (${mine.score})`, PALETTE.n);
      else add("Du är inte på listan än", PALETTE.b);
    } else if (!me) noLink();
    game.info(lines);
    const live = document.getElementById("board-status");
    if (live) live.textContent = sr.join(". ");
  };

  const setStatus = (s: typeof status) => {
    status = s;
    if (list) list.dataset.board = s; // för testsviten och felsökning
  };

  const onData = (all: Scores) => {
    setStatus("ok");
    rows = ranking(all);
    const top = rows[0]?.score ?? 0;
    // Ny etta (efter första ögonblicksbilden): fanfar och NEW HIGH SCORE!
    if (topScore !== null && top > topScore) {
      opts.play("chest");
      opts.toast("NEW HIGH SCORE!");
    }
    topScore = top;
    renderList();
    renderInfo();
  };

  const fail = () => {
    setStatus("fail");
    renderList();
    renderInfo();
  };

  // Laddar Firebase (eller testsvitens låtsasdatabas) en gång. Kommer inget
  // svar inom 5 s räknas topplistan som nere; data som kommer senare visas ändå.
  const connect = () => {
    if (status !== "off") return;
    setStatus("loading");
    renderList();
    const timer = setTimeout(() => status === "loading" && fail(), TIMEOUT_MS);
    const fake = (window as unknown as { __leaderboardBackend?: Backend }).__leaderboardBackend;
    (fake ? Promise.resolve(fake) : import("./firebase-backend").then((m) => m.createBackend()))
      .then((b) => {
        backend = b;
        b.listen(
          (all) => {
            clearTimeout(timer);
            try {
              onData(all);
            } catch {
              fail();
            }
          },
          () => {
            clearTimeout(timer);
            fail();
          }
        );
      })
      .catch(() => {
        clearTimeout(timer);
        fail();
      });
  };

  const post = async (score: number) => {
    if (!me || !backend) return;
    postFailed = false;
    let posted = false;
    try {
      posted = await withTimeout(backend.post(me.key, { name: me.name, score: Math.min(score, MAX_SCORE) }));
    } catch {
      postFailed = true; // nekad, nätet nere eller timeout: lokalt rekord gäller
    }
    renderInfo();
    if (!posted) return;
    // Postat: fäll ut listan och visa den egna raden om den inte syns
    setOpen(true);
    const mine = list?.querySelector(".hs-me");
    const r = mine?.getBoundingClientRect();
    if (mine && r && (r.bottom > window.innerHeight || r.top < 0)) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      mine.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    }
  };

  const closePanel = () => {
    if (panel) panel.hidden = true;
    game?.hold(false);
  };

  yes?.addEventListener("click", () => {
    try {
      if (always?.checked && me) localStorage.setItem(`${AUTO_KEY}:${me.key}`, "1");
    } catch {
      // Privat läge: "Posta alltid" sparas inte
    }
    const s = lastOver;
    closePanel();
    if (s !== null) post(s);
  });
  no?.addEventListener("click", closePanel);

  // Panelen syns bara med JS (topplistan kräver det); utfällt läge från förra gången
  if (board && toggle && list) {
    board.hidden = false;
    setOpen(savedOpen(), false);
    toggle.addEventListener("click", () => setOpen(list.hidden));
    renderList();
  }

  // Bonus level-sektionen i bild laddar också topplistan (alla ska se den)
  const section = document.getElementById("act-bonus");
  if (section && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      connect();
    });
    io.observe(section);
  }

  return {
    attach(g: { info(l: InfoLine[]): void; hold(on: boolean): void }) {
      game = g;
    },
    connect,
    // Game over: fråga (eller posta direkt) om poängen slår gästens plats på listan
    over(score: number) {
      lastOver = score;
      postFailed = false;
      renderList(); // webbläsarens rekord kan ha ändrats
      renderInfo();
      if (!me || status !== "ok" || !panel) return;
      const mine = rows.find((r) => r.key === me.key);
      if (score <= (mine?.score ?? 0) || score <= offered) return;
      offered = score;
      if (autoPost()) return void post(score);
      const title = document.getElementById("game-panel-title");
      if (title) title.textContent = `Nytt rekord! Posta ${family(genitive(me.name))} rekord?`;
      if (always) always.checked = false;
      panel.hidden = false;
      game?.hold(true);
      yes?.focus({ preventScroll: true });
    },
  };
}
