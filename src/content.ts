export const content = {
  child: { name: "Vilgot", age: 10 },
  // Gäster som kan hamna på minispelets topplista (via sin ?g-länk). Ändras
  // listan: kör `npm run rules` (nya regler + sms-länkarna i README) och
  // klistra in de nya reglerna i Firebase (README).
  guests: ["Vilgot", "Vilhelm", "Eric", "Frank", "Sam", "John", "Cedrik"],
  party: {
    kind: "Gamingkalas",
    dateISO: "2026-11-20",
    dateText: "Fredag 20 november",
    start: "17:00",
    end: "19:30",
    where: "Hemma hos oss",
    street: "Kardemummagränd 20",
    postal: "135 36 Tyresö",
    mapsQuery: "Kardemummagränd 20, 135 36 Tyresö",
    program: ["Det bjuds på pizza!", "Gaming tillsammans", "Snacks och tilltugg", "Högt tempo, låg ljudnivå – kanske"],
    // Visas som egen "Ta med"-ruta i Vad händer
    bring: "Egen padda eller mobil med Roblox/Minecraft installerat" as string | null,
    dresscode: null as string | null,
    gifts: null as string | null,
    contact:
      "Frågor? Ring eller sms:a Jacob, 070-355 35 29" as string | null,
  },
  rsvp: {
    deadlineISO: "2026-11-17",
    deadlineText: "Svara senast tisdag 17 november",
    endpoint: "https://formspree.io/f/xaeqprpb",
    subject: "Vilgots kalas – OSA",
  },
  site: {
    title: "Vilgot fyller 10 – du är bjuden!",
    repoName: "vilgots-kalas",
    // Publicerad adress: sms-länkarna i README (npm run rules) bygger på den
    url: "https://jaken-ux.github.io/vilgots-kalas/",
  },
};

// "Vi ses den 20:e!" – dagen ur dateISO
export function seeYouText(c = content): string {
  return `Vi ses den ${Number(c.party.dateISO.slice(8, 10))}:e!`;
}

// Texter och länkar som ska synas även utan JS. En enda källa: vite.config.ts
// fyller i dem i index.html vid bygget, och populateContent() i main.ts sätter
// samma värden i webbläsaren. Nyckel = element-id i index.html.
export function staticText(c = content): Record<string, string> {
  const p = c.party;
  return {
    "title-name": c.child.name,
    "title-age": `fyller ${c.child.age}!`,
    "party-kind": p.kind.toLowerCase(),
    "when-date": p.dateText,
    "when-time": `Kl ${p.start} – ${p.end}`,
    "when-dresscode": p.dresscode ?? "",
    "sign-text": p.where,
    "address-street": p.street,
    "address-postal": p.postal,
    "beat-pizza-text": p.program[0],
    "beat-gaming-text": p.program[1],
    "beat-snacks-text": p.program[2],
    "beat-tempo-text": p.program[3],
    "bring-text": p.bring ?? "",
    "gifts-line": p.gifts ?? "",
    "contact-line": p.contact ?? "",
    "rsvp-deadline": c.rsvp.deadlineText,
    "outro-see-you": seeYouText(c),
  };
}

export function staticHref(c = content): Record<string, string> {
  const q = encodeURIComponent(c.party.mapsQuery);
  return {
    "btn-google-maps": `https://www.google.com/maps/search/?api=1&query=${q}`,
    "btn-apple-maps": `https://maps.apple.com/?q=${q}`,
  };
}
