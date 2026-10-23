// Kontrollerar att databasreglerna som är publicerade i Firebase gör det de ska,
// genom att skriva via REST mot den riktiga databasen. Kör: npm run rules:check
//
// Skriptet rör bara /scores/<första gästen> och försöker skriva till ett namn
// utanför gästlistan (ska nekas). Finns det redan en poäng för gästen avbryter
// det utan att skriva – testet skulle annars höja en riktig poäng.
//
// Städning: reglerna förbjuder radering, så testposten kan inte tas bort
// anonymt (det kontrolleras också). Sätt FIREBASE_DB_SECRET (databashemlighet
// från Firebase-konsolen) så tar skriptet bort den; annars skrivs instruktioner ut.
// RULES_CHECK_URL ersätter databasadressen (används bara för att testa skriptet).
import { content } from "../src/content.ts";

const BASE =
  process.env.RULES_CHECK_URL ?? "https://vilgots-kalas-default-rtdb.europe-west1.firebasedatabase.app";
const SECRET = process.env.FIREBASE_DB_SECRET;
const guest = content.guests[0];
const key = guest.toLowerCase();
const now = { ".sv": "timestamp" };

const call = async (method, path, body, auth) => {
  const url = `${BASE}/${path}.json${auth ? `?auth=${encodeURIComponent(auth)}` : ""}`;
  const res = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.text() };
};

let failed = 0;
const check = async (label, expectOk, method, path, body) => {
  const r = await call(method, path, body);
  const ok = r.status >= 200 && r.status < 300;
  const pass = ok === expectOk;
  if (!pass) failed++;
  console.log(`${pass ? "OK  " : "FEL "} ${label}: väntat ${expectOk ? "tillåten" : "nekad"}, fick ${r.status}${pass ? "" : ` ${r.body}`}`);
};

const existing = await call("GET", `scores/${key}`);
if (existing.status !== 200) {
  console.error(`Kan inte läsa /scores/${key} (status ${existing.status}): ${existing.body}`);
  console.error("Är reglerna publicerade? Läsning ska vara tillåten för alla.");
  process.exit(1);
}
if (existing.body !== "null") {
  console.error(`Det finns redan en poäng för ${guest}: ${existing.body}`);
  console.error("Avbryter utan att skriva, för att inte ändra riktig data. Ta bort posten i konsolen först om du vill testa.");
  process.exit(1);
}

const entry = (score, extra = {}) => ({ name: guest, score, updatedAt: now, ...extra });
console.log(`Testar reglerna mot ${BASE} med /scores/${key}\n`);
await check("(a) giltig poäng 1", true, "PUT", `scores/${key}`, entry(1));
await check("(b) högre poäng 2", true, "PUT", `scores/${key}`, entry(2));
await check("(c) lägre poäng 1", false, "PUT", `scores/${key}`, entry(1));
await check("(c) samma poäng 2", false, "PUT", `scores/${key}`, entry(2));
await check("(d) okänt namn", false, "PUT", "scores/okand-testgast", { name: "okand-testgast", score: 5, updatedAt: now });
await check("(e) poäng som text", false, "PUT", `scores/${key}`, entry("3"));
await check("(e) för hög poäng 100000", false, "PUT", `scores/${key}`, entry(100000));
await check("(e) decimaltal 3.5", false, "PUT", `scores/${key}`, entry(3.5));
await check("(e) negativ poäng", false, "PUT", `scores/${key}`, entry(-1));
await check("(e) fel namn", false, "PUT", `scores/${key}`, entry(3, { name: "Någon annan" }));
await check("(e) tidsstämpel som inte är nu", false, "PUT", `scores/${key}`, entry(3, { updatedAt: 123 }));
await check("(e) extra fält", false, "PUT", `scores/${key}`, entry(3, { hack: true }));
await check("(e) skriva utanför /scores", false, "PUT", "annat", { x: 1 });
await check("(f) radera anonymt", false, "DELETE", `scores/${key}`);
await check("läsa /scores", true, "GET", "scores");

// Städning
console.log("");
if (SECRET) {
  const del = await call("DELETE", `scores/${key}`, undefined, SECRET);
  const after = await call("GET", `scores/${key}`);
  const clean = del.status === 200 && after.body === "null";
  if (!clean) failed++;
  console.log(clean ? `Testposten /scores/${key} är borttagen.` : `FEL: kunde inte ta bort testposten (${del.status} ${del.body}).`);
} else {
  console.log(`Testposten /scores/${key} (poäng 2) finns kvar – reglerna förbjuder anonym radering.`);
  console.log(`Ta bort den: Firebase-konsolen → Realtime Database → Data → håll över "${key}" under "scores" → papperskorgen.`);
}

console.log(failed ? `\n${failed} kontroll(er) gav fel resultat.` : "\nAlla kontroller gav väntat resultat.");
process.exit(failed ? 1 : 0);
