// Delad topplista för minispelet (Firebase Realtime Database, /scores).
// OPT-IN: inget postas utan att gästen svarat "Ja!" eller kryssat "Posta alltid".
// Firebase laddas först när den behövs (första spelstart eller när high
// score-delen syns), aldrig vid sidladdning. Allt är inlindat i try/catch och
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

// Versalt Å saknar synlig ring i Press Start 2P (och Ä/Ö blir små): sådana namn
// skrivs med gemener i pixelfonten, "Åsa" → "åsa". Datan ändras inte.
export const pixelSafe = (name: string) => (/[ÅÄÖ]/.test(name) ? name.toLowerCase() : name);

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s + " ".repeat(n - s.length));

interface Options {
  guest: string; // ?g-namnet (kan vara tomt eller okänt)
  play(sound: "chest"): void;
  toast(text: string): void;
  localBest(): number;
}

export function initLeaderboard(opts: Options) {
  const me = guestIdentity(opts.guest);
  const list = document.querySelector<HTMLOListElement>(".hiscore");
  const recordRow = document.getElementById("hs-record-row");
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

  // ----- Topplistan i high score-delen -----
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

  // Utan poster står den statiska listan (Vilgot – 10 år, Du?) kvar
  const renderList = () => {
    if (!list || !rows.length) return;
    const items: HTMLElement[] = rows.slice(0, 10).map((r) =>
      row(String(r.rank), pixelSafe(r.name), String(r.score), r.key === me?.key ? "hs-me" : "")
    );
    const mine = me && rows.find((r) => r.key === me.key);
    if (mine && mine.rank > 10) items.push(row("", "…", ""), row(String(mine.rank), pixelSafe(mine.name), String(mine.score), "hs-me"));
    if (!mine) items.push(row(String(rows.length + 1), "Du?", "???", "hs-you"));
    if (recordRow) items.push(recordRow);
    list.replaceChildren(...items);
    list.dataset.live = "true";
  };

  // ----- Topp 3 och egen placering på game over-skärmen -----
  const renderInfo = () => {
    if (!game || lastOver === null) return;
    const lines: InfoLine[] = [];
    if (status === "fail" || postFailed) {
      lines.push([postFailed ? "Kunde inte posta" : "Topplistan svarar inte", PALETTE.r]);
      lines.push([`Ditt rekord: ${opts.localBest()}`, PALETTE.b]);
    } else if (status === "ok") {
      for (const r of rows.slice(0, 3)) {
        lines.push([`${r.rank}. ${pad(pixelSafe(r.name), 10)} ${String(r.score).padStart(5)}`, r.key === me?.key ? PALETTE.n : PALETTE.w]);
      }
      const mine = me && rows.find((r) => r.key === me.key);
      if (!me) lines.push(["Öppna din egen länk", PALETTE.b], ["för att hamna på listan", PALETTE.b]);
      else if (mine) lines.push([`Du: plats ${mine.rank} (${mine.score})`, PALETTE.n]);
      else lines.push(["Du är inte på listan än", PALETTE.b]);
    } else if (!me) {
      lines.push(["Öppna din egen länk", PALETTE.b], ["för att hamna på listan", PALETTE.b]);
    }
    game.info(lines);
    const sr = document.getElementById("board-status");
    if (sr) sr.textContent = lines.map(([t]) => t).join(". ");
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
    renderInfo();
  };

  // Laddar Firebase (eller testsvitens låtsasdatabas) en gång. Kommer inget
  // svar inom 5 s räknas topplistan som nere; data som kommer senare visas ändå.
  const connect = () => {
    if (status !== "off") return;
    setStatus("loading");
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
    try {
      await withTimeout(backend.post(me.key, { name: me.name, score: Math.min(score, MAX_SCORE) }));
    } catch {
      postFailed = true; // nekad, nätet nere eller timeout: lokalt rekord gäller
    }
    renderInfo();
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

  // High score-delen i bild laddar också topplistan (alla ska se den)
  if (list && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      connect();
    });
    io.observe(list);
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
      renderInfo();
      if (!me || status !== "ok" || !panel) return;
      const mine = rows.find((r) => r.key === me.key);
      if (score <= (mine?.score ?? 0) || score <= offered) return;
      offered = score;
      if (autoPost()) return void post(score);
      if (always) always.checked = false;
      panel.hidden = false;
      game?.hold(true);
      yes?.focus({ preventScroll: true });
    },
  };
}
