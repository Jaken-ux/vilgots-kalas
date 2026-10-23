# Vilgots kalas — inbjudan

Mobilanpassad, ensidig inbjudningssida till Vilgots 10-årskalas (gamingkalas). Sidan är byggd som ett 8-bitars spel: en titelskärm med PRESS START, sedan "nivåerna" När, Var och Vad händer, OSA som "Join game?" och sist en high score-lista. Byggd med Vite + vanilla TypeScript, GSAP-scrollanimationer och Formspree-formulär. Koden är en kopia av Livias kalas med samma funktioner men ny design (se DECISIONS.md).

## Vad sidan innehåller

| Del | Innehåll | Tryckinteraktion |
|---|---|---|
| Titelskärm (`#intro`) | Porträtt, titel, PRESS START (länk till När), HUD och mark | Porträttet: solglasögon → krona → av. Hjärtana uppe till vänster: varje tryck tar ett liv ("OUCH!"), vid noll "GAME OVER?", nästa tryck "EXTRA LIFE!". Blocket i marken: sprickor, splitter, ett mynt räknas i myntverket uppe till höger, nytt block efter 3 s |
| När (`#act-when`) | Datum, tid, nedräkning som mynträkneverk | – |
| Var (`#act-where`) | Skylt och skattkista | Skylten vecklar ut en skattkarta med adress och kartlänkar. Kistan öppnas med ett regn av pixelmynt |
| Vad händer (`#act-program`) | Gaming, snacks, ta med (egen ruta) | – |
| Bonus level (`#act-bonus`) | Minispel i `<canvas>` (src/game.ts) | Tryck startar, tryck = hopp över buskar, block och fåglar. Tre liv. Bästa poäng visas i high score |
| OSA (`#act-rsvp`) | Formuläret | Ja ger pixelkonfetti och "LEVEL UP!" |
| High score (`#act-outro`) | "Vilgot – 10 år", "Ditt rekord: N" (när minispelet spelats) och "Du?" | Ljud av/på |

## Köra lokalt

```bash
npm install
npm run dev
```

Öppna `http://localhost:5173/vilgots-kalas/` i webbläsaren.

## Ändra fakta

All information (datum, tid, adress, program, "Ta med") finns i **`src/content.ts`**. Ändra där, inget annat behöver röras.

Vid bygget fyller `vite.config.ts` i följande direkt i HTML:en, så att sidan går att läsa även om JavaScript inte körs:

- **Texter och kartlänkar:** insticket `prerender-content`, utifrån `staticText()`/`staticHref()` i `content.ts`.
- **Pixelgrafiken:** insticket `prerender-sprites`, utifrån `src/sprites.ts`.

Bygget avbryts om ett element som en text ska in i saknas i `index.html`, eller om en sprite är okänd.

## Pixelgrafik

All grafik (hjärtan, mynt, moln, träd, block, kista, karta, handkontroll, padda, snacks, solglasögon, krona) ritas som ASCII i `src/sprites.ts`, en rad per pixelrad och ett tecken per färg i `PALETTE`. I `index.html` står bara `<svg data-sprite="namn" width=… height=…></svg>`. Bredd och höjd bör vara en heltalsmultipel av spritens storlek, så att pixlarna blir skarpa. Figurerna är egna och generiska. Inga figurer, logotyper eller blockmönster från riktiga spel får användas.

## Bilder

Originalfoton ligger i `assets/` (`vilgot-padda.png` = porträttet, `vilgot-labb.png`, `vilgot-titt.png`). De beskärs och skalas till `public/` som .webp + .jpg med:

```bash
node scripts/convert-images.mjs
```

Beskärningen står i skriptet. Ändras porträttets beskärning måste solglasögonens och kronans placering (`.shades`, `.crown` i `src/style.css`) kalibreras om.

## Minispelet (Bonus level)

`src/game.ts`, utan bibliotek, under 6,5 kB (6,2 kB minifierat, 3,1 kB gzip; mätt med esbuild `--charset=utf8`, som bygget levererar). Spelet räknar i spelpixlar (192×96). Canvasen får bredden 192·k *enhetspixlar*, med k som heltal, och ritar med `ctx.scale(k)`, så varje spelpixel blir exakt k×k skärmpixlar.

- **Start:** spelet startar bara på ett riktigt tryck (eller Mellanslag/Enter), aldrig av scroll. I viloläge släpps scrollgester igenom (`touch-action: pan-y`). Under spel äts all touch (`.playing` → `touch-action: none` + `preventDefault`), så ett hopp aldrig scrollar sidan.
- **Loop:** körs med `requestAnimationFrame` bara under spel. Spelet pausas när det är mindre än 30 % synligt eller fliken döljs, och fortsätter bara på tryck.
- **Poäng och liv:** poängen är sprungen sträcka. Tre krockar ger game over, med en kort skyddstid efter varje krock.
- **Svårighet:** farten går från 70 till 212 spelpixlar/s (170 efter ~25 s, taket efter ~35 s). Hindren (`KINDS`) kommer i tre markhöjder: låga buskar och block, mellanblock och en hög, smal pelare. Till det kommer en rak fågel i huvudhöjd och en dykfågel i två varianter. Den tidiga dykaren når huvudhöjd innan den är framme och ska hoppas över. Den sena sveper över huvudet och kräver att man står kvar. Cirka 20 % av de låga hindren kommer i par.
- **Rättvisa:** `jumpWindow()` räknar ut inom vilket avstånd ett avstamp klarar ett hinder vid aktuell fart. `minGap()` räknar ut det kortaste avstånd mellan två hinder som går att klara, och `nextGap()` slumpar aldrig under det. Testsviten låter en bot som hoppar mitt i fönstret spela 60 s utan krock, och en bot som aldrig hoppar ska dö inom 15 s.
- **Rekord:** bästa poäng sparas per webbläsare (inte per gäst) i `localStorage` under `vilgots-kalas-best`, och rensas inte av `?reset=1`.
- **Testkrokar:** `#game` har `data-state` (idle/run/pause/over), `data-lives`, `data-score` och `data-jumps`. Finns `window.__gameHook` när spelet startar får den läsa höjd, hinder och fart (används av botarna).

## Ljud

Alla ljud (även minispelets hopp och dödsljud) är syntetiserade 8-bitarsljud (fyrkant- och triangelvågor, brus för grävljudet) i `SYNTHS` i `src/main.ts`. Det finns inga ljudfiler. Ljudet startar först vid ett tryck (krav i iOS), ljudknappen i high score-delen stänger av allt, och valet sparas i `localStorage` (`vilgots-kalas-mute`).

## Utan JavaScript och felsökning

- **Utan JS** syns porträtt, all text, pixelgrafiken och adressen. PRESS START är en vanlig länk. Animationer, tryckinteraktioner, ljud, nedräkningen och namnet från `?g` kräver JS.
- **Inanimering:** ett litet skript i `<head>` sätter klassen `js` på `<html>`, och bara då döljer CSS de element som tonas in. Blir huvudskriptet inte klart inom 4 s, eller fallerar ett steg i `init()`, tas klassen bort och allt visas utan animation.
- **Felrapport:** lägg till `?debug=1` i URL:en. Efter cirka 4,5 s visas en ruta längst ner med webbläsarens user agent, porträttets status, vilken OSA-nyckel som lästes och alla JS-fel.

## Personlig länk

Lägg till `?g=Namn` i URL:en, så står det "…och Namn är bjuden på" i titelskärmen (i stället för "du"), och namnet förifylls i OSA-formulärets fält "Barnets namn (som inbjudan gäller)" (går att ändra). Namnet skickas dessutom alltid med till Formspree i det dolda fältet `guest` ("okänd" utan `?g`):

```
https://<user>.github.io/vilgots-kalas/?g=Emma
```

## Sparat OSA-svar

Svaret sparas bara i webbläsarens `localStorage`, **per gäst**: nyckeln är `vilgots-kalas-rsvp:<namn från ?g, gemener>` eller `vilgots-kalas-rsvp:default` utan `?g`. Lägg till `?reset=1` för att rensa alla sparade svar i den aktuella webbläsaren (ljudinställningen behålls). Sidan laddas då om utan parametern.

## Testa

```bash
npm run build
npx playwright test
```

Sviten (`qa/verify.spec.ts`) startar `npm run preview` själv. Alla anrop till Formspree fångas och besvaras med ett fejkat svar, så inga riktiga OSA-svar skickas. Skärmdumpar och Lighthouse-data hamnar i `qa/` (gitignorerade).

## Deploya till GitHub Pages

En push till `main` bygger och publicerar via `.github/workflows/deploy.yml`. Första gången:

1. Skapa ett **publikt** repo med namnet `vilgots-kalas` på GitHub (namnet måste matcha `base` i `vite.config.ts`), koppla remote och pusha `main`.
2. Gå till repot → **Settings → Pages → Source: GitHub Actions**.
3. När Actions-jobbet kört klart finns sajten på `https://<ditt-användarnamn>.github.io/vilgots-kalas/`.

## Viktigt om integritet

Telefonnumret i `content.party.contact` blir publikt på ett publikt repo och sajt. Sätt fältet till `null` för att dölja det. Fotona i `assets/` och `public/` blir också publika.

## Teknikstack

- **Vite**: build och dev-server
- **TypeScript**: vanilla, inget UI-ramverk
- **GSAP + ScrollTrigger**: scroll- och tryckanimationer (i pixelsteg med `steps()`)
- **canvas-confetti**: fyrkantig pixelkonfetti vid OSA-ja
- **Web Audio API**: syntetiserade 8-bitarsljud
- **Formspree**: formulärbackend (OSA)
- **Google Fonts (Press Start 2P)**: bara för rubriker och spel-UI. Brödtexten använder systemfont
