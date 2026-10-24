// Genererar database.rules.json för minispelets topplista ur gästlistan i
// src/content.ts, och skriver om sektionen "Sms-länkar" i README.md (en
// färdig ?g-länk per gäst). Kör: npm run rules (kräver Node 22.18+, som läser
// .ts direkt). Klistra sedan in regelfilen i Firebase-konsolen – se README,
// "Topplistan".
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Regelobjektet för en gästlista (exporteras för testsviten)
export function buildRules(guests) {
  const keys = guests.map((g) => g.trim().toLowerCase());
  // Firebase-nycklar får inte innehålla . $ # [ ] / och inte vara tomma
  for (const k of keys) {
    if (!k || /[.$#[\]/]/.test(k)) throw new Error(`Ogiltigt gästnamn för databasen: "${k}"`);
  }
  if (new Set(keys).size !== keys.length) throw new Error("Gästlistan har dubbletter (gemener jämförs)");

  const q = (s) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  const isGuest = keys.map((k) => `$name === ${q(k)}`).join(" || ");
  return {
    rules: {
      ".read": false,
      ".write": false,
      scores: {
        // Läs för alla
        ".read": true,
        $name: {
          // Skriv bara till gästernas nycklar, och aldrig radera (.validate körs
          // inte vid radering, så det skyddet måste ligga här)
          ".write": `(${isGuest}) && newData.exists()`,
          ".validate": "newData.hasChildren(['name', 'score', 'updatedAt']) && newData.child('updatedAt').val() === now",
          name: { ".validate": "newData.isString() && newData.val().toLowerCase() === $name" },
          score: {
            // Heltal 0–99999 och högre än den sparade poängen
            ".validate":
              "newData.isNumber() && newData.val() % 1 === 0 && newData.val() >= 0 && newData.val() <= 99999 && (!data.exists() || newData.val() > data.val())",
          },
          updatedAt: { ".validate": "newData.val() === now" },
          $other: { ".validate": false },
        },
      },
    },
  };
}

// En rad per gäst: "- Vilgot: https://…/?g=Vilgot" (namnet URL-kodat)
export const smsLinks = (guests, url) => guests.map((g) => `- ${g}: ${url}?g=${encodeURIComponent(g)}`).join("\n");

// README med sms-länkarna utbytta mellan markörerna
const START = "<!-- sms-länkar:start (skrivs av npm run rules – ändra inte för hand) -->";
const END = "<!-- sms-länkar:end -->";
export function withSmsLinks(readme, guests, url) {
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a < 0 || b < a) throw new Error(`README.md saknar markörerna för sms-länkarna (${START} … ${END})`);
  return readme.slice(0, a + START.length) + "\n" + smsLinks(guests, url) + "\n" + readme.slice(b);
}

// Körs som skript (npm run rules): läs gästlistan och skriv filerna
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { content } = await import("../src/content.ts");
  const rules = buildRules(content.guests);
  writeFileSync(new URL("../database.rules.json", import.meta.url), JSON.stringify(rules, null, 2) + "\n");
  console.log(`database.rules.json skriven för ${content.guests.length} gäst(er): ${content.guests.join(", ")}`);
  const readme = new URL("../README.md", import.meta.url);
  writeFileSync(readme, withSmsLinks(readFileSync(readme, "utf8"), content.guests, content.site.url));
  console.log("README.md: sms-länkarna uppdaterade.");
  console.log("Klistra in den i Firebase-konsolen: Realtime Database → Rules → ersätt allt → Publish.");
}
