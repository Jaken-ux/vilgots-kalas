export const content = {
  child: { name: "Vilgot", age: 10 },
  party: {
    kind: "Gamingkalas",
    dateISO: "2026-11-20",
    dateText: "Fredag 20 november",
    start: "18:00",
    end: "20:30",
    where: "Hemma hos oss",
    street: "Kardemummagränd 20",
    postal: "135 36 Tyresö",
    mapsQuery: "Kardemummagränd 20, 135 36 Tyresö",
    program: ["Gaming tillsammans", "Snacks och tilltugg", "Högt tempo, låg ljudnivå – kanske"],
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
    "beat-gaming-text": p.program[0],
    "beat-snacks-text": p.program[1],
    "beat-tempo-text": p.program[2],
    "bring-text": p.bring ?? "",
    "gifts-line": p.gifts ?? "",
    "contact-line": p.contact ?? "",
    "rsvp-deadline": c.rsvp.deadlineText,
    "hs-name": c.child.name,
    "hs-score": `${c.child.age} år`,
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
