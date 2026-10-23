# Vilgots kalas — inbjudan

Mobilanpassad, ensidig inbjudningssida till Vilgots 10-årskalas (gamingkalas). Sidan är byggd som ett 8-bitars spel: en titelskärm med PRESS START, sedan "nivåerna" När, Var och Vad händer, OSA som "Join game?" och sist en high score-lista. Byggd med Vite + vanilla TypeScript, GSAP-scrollanimationer och Formspree-formulär. Koden är en kopia av Livias kalas med samma funktioner men ny design (se DECISIONS.md).

## Vad sidan innehåller

| Del | Innehåll | Tryckinteraktion |
|---|---|---|
| Titelskärm (`#intro`) | Porträtt, titel, PRESS START (länk till När), HUD och mark | Porträttet: solglasögon → krona → av. Hjärtana uppe till vänster: varje tryck tar ett liv ("OUCH!"), vid noll "GAME OVER?", nästa tryck "EXTRA LIFE!". Blocket i marken: sprickor, splitter, ett mynt räknas i myntverket uppe till höger, nytt block efter 3 s |
| När (`#act-when`) | Datum, tid, nedräkning som mynträkneverk | – |
| Var (`#act-where`) | Skylt och skattkista | Skylten vecklar ut en skattkarta med adress och kartlänkar. Kistan öppnas med ett regn av pixelmynt |
| Vad händer (`#act-program`) | Gaming, snacks, ta med (egen ruta) | – |
| Bonus level (`#act-bonus`) | Minispel i `<canvas>` (src/game.ts) och topplistan under det | Tryck startar, tryck = hopp över buskar, block och fåglar. Tre liv. Under spelet: utfällbar "HIGH SCORE"-panel med den delade topplistan |
| OSA (`#act-rsvp`) | Formuläret | Ja ger pixelkonfetti och "LEVEL UP!" |
| High score (`#act-outro`) | "Vilgot – 10 år" och "Du?" (statisk dekoration, ingen koppling till topplistan) | Ljud av/på |

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

`src/game.ts` (fysik, loop, inmatning) och `src/levels.ts` (miljöer, hinder, paletter), utan bibliotek. Budget 20 kB minifierat; nu 10 401 B (4,9 kB gzip), mätt med esbuild `--charset=utf8`, som bygget levererar. Spelet räknar i spelpixlar (192×96). Canvasen får bredden 192·k *enhetspixlar*, med k som heltal, och ritar med `ctx.scale(k)`, så varje spelpixel blir exakt k×k skärmpixlar.

- **Start:** spelet startar bara på ett riktigt tryck (eller Mellanslag/Enter), aldrig av scroll. I viloläge släpps scrollgester igenom (`touch-action: pan-y`). Under spel äts all touch (`.playing` → `touch-action: none` + `preventDefault`), så ett hopp aldrig scrollar sidan.
- **Loop:** körs med `requestAnimationFrame` bara under spel. Spelet pausas när det är mindre än 30 % synligt eller fliken döljs, och fortsätter bara på tryck.
- **Poäng och liv:** poängen är sprungen sträcka. Tre krockar ger game over, med en kort skyddstid efter varje krock.
- **Levels och miljöer:** ny level var 30:e sekund, med "LEVEL N" upptill och "LEVEL UP!" som blinkar till ett kort pling vid bytet.
  - Miljöerna i ordning: gräs, grotta, stad, rymd. Därefter börjar varv 2 från början, med tätare hinder.
  - Bytet sker utan paus. Himmel och mark tonar till den nya paletten under 1 s, och bakgrundsdekoren (moln, droppstenar, hus, stjärnor) byts när den har rullat ut till vänster.
  - Hindren byter utseende per miljö (buske → stalagmit → trafikkon → krater, fågel → fladdermus → drönare → satellit, pelare → stenpelare → lastbil → raketdel) men behåller sina höjdklasser.
- **Fart:** `vAt(t) = 70 + 2t + 0,022t²` spelpixlar/s, utan tak (150 vid 30 s, 270 vid 60 s, 430 vid 90 s). Över ~1 193 px/s syns de höga hindren för sent för att någon ska hinna hoppa, eftersom de kommer in i högerkanten. Den gränsen nås efter ~185 s, så spelet tar alltid slut, även för en perfekt spelare, efter 3–4 minuter. Hindren blir också tätare med tiden (`density()`), och 25 % tätare per varv.
- **Hinder:** tre markhöjder (låga 6/8 px, mellan 16, höga 28), en rak flygare i huvudhöjd och en dykare i två varianter. Den tidiga dykaren når huvudhöjd innan den är framme och ska hoppas över. Den sena sveper över huvudet och kräver att man står kvar. Cirka 20 % av de låga hindren kommer i par.
- **Rättvisa:** `jumpWindow()` räknar ut inom vilket avstånd ett avstamp klarar ett hinder vid aktuell fart. `minGap()` räknar ut det kortaste avstånd mellan två hinder som går att klara, och `nextGap()` slumpar aldrig under det, oavsett täthet. Fysiken delas upp i delsteg på högst 4 px, så att snabba hinder inte kan passera gubben mellan två bildrutor.
  - Testsviten låter en bot som hoppar mitt i fönstret spela från start: den ska nå rymden, inte krocka före 3 min och dö inom 3–4 min speltid.
  - En bot som aldrig hoppar ska dö inom 15 s.
- **Dolt `?level=N`:** börjar direkt på level N med rätt fart. Decimaler går också, till exempel `?level=1.9` för att se ett levelbyte efter 3 s. Det är ett övningsläge, så varken rekordet eller topplistan påverkas.
- **Rekord:** bästa poäng sparas per webbläsare (inte per gäst) i `localStorage` under `vilgots-kalas-best`, och rensas inte av `?reset=1`.
- **Testkrokar:** `#game` har `data-state` (idle/run/pause/over), `data-lives`, `data-score`, `data-jumps`, `data-level` och `data-env`. Finns `window.__gameHook` när spelet startar får den läsa höjd, hinder, fart och speltid (används av botarna).

## Topplistan (Firebase)

Minispelet har en delad topplista i Firebase Realtime Database under `/scores/<gästnamn i gemener>` = `{ name, score, updatedAt }`. Koden ligger i `src/leaderboard.ts` (logik och visning) och `src/firebase-backend.ts` (Firebase-anropen och konfigurationen, som är publik by design).

- **Bara opt-in.** Inget postas utan att gästen trycker "Ja!" i frågan "Nytt rekord! Posta på leaderboarden?", eller tidigare har kryssat "Posta alltid". Det valet sparas per gäst i `localStorage` (`vilgots-kalas-autopost:<gäst>`).
- **Identitet.** Gästens identitet är `?g`-namnet, men bara om det finns i `guests` i `src/content.ts` (gemener jämförs). Utan giltigt `?g` fungerar spelet som förut med lokalt rekord, och game over-skärmen visar "Öppna din egen länk för att hamna på listan".
- **När frågan visas.** Frågan kommer när poängen slår gästens plats på listan och är högst hittills i sessionen. Ett nej frågas alltså inte om igen för en lägre poäng.
- **Topplistan ligger direkt under spelet** som en utfällbar panel (`#board`). Rubriken "HIGH SCORE" med en pixelpil syns alltid och växlar färg i pixelsteg. Ett tryck fäller ut listan: topp 10, egen rad markerad, egen placering under om den är längre ner, och webbläsarens eget rekord sist.
  - Utfällt läge sparas i `localStorage` (`vilgots-kalas-board-open`).
  - När en poäng har postats fälls listan ut av sig själv, och den egna raden scrollas fram om den inte syns.
  - Tar någon förstaplatsen spelas en fanfar och "NEW HIGH SCORE!" visas.
  - Panelen syns bara med JS.
- **Outron** ("Vilgot – 10 år", "Du?") är statisk dekoration utan koppling till Firebase.
- **På game over-skärmen** visas topp 3 och den egna placeringen.
- **Laddning.** Firebase laddas först vid första spelstart eller när Bonus level-sektionen syns, aldrig vid sidladdning. Firebase-chunken är 223,5 kB (49,5 kB gzip), och huvudbundlen växte med 5,6 kB.
- **Fel.** Svarar Firebase inte inom 5 s, eller nekar, visar panelen "Topplistan svarar inte just nu" och det lokala rekordet. Inget kraschar.

### Databasreglerna – gör om varje gång `guests` ändras

1. Kör `npm run rules`. Skriptet läser `guests` och skriver om `database.rules.json` (kräver Node 22.18 eller senare).
2. Öppna [Firebase-konsolen](https://console.firebase.google.com/) → projektet **vilgots-kalas** → **Build → Realtime Database** → fliken **Rules**.
3. Markera allt i redigeraren och ta bort det. Klistra in hela innehållet i `database.rules.json`.
4. Klicka **Publish**.
5. Committa den nya `database.rules.json` tillsammans med ändringen i `content.ts`.

Reglerna:
- Alla får läsa `/scores`.
- Skrivning bara till nycklar i gästlistan, och aldrig radering.
- `score` ska vara ett heltal 0–99999 och högre än den sparade poängen.
- `name` ska vara samma som nyckeln (gemener jämförs).
- `updatedAt` ska vara serverns tid.
- Inga andra fält.

### Kontrollera reglerna efter Publish

```bash
npm run rules:check
```

Skriptet skriver via REST till den **riktiga** databasen under `/scores/vilgot`.

**Kontrollerna** (a)–(f): giltig poäng och högre poäng ska gå igenom. Lägre poäng, okänt namn, fel typ, för hög poäng, decimaltal, fel namn, fel tidsstämpel, extra fält och anonym radering ska nekas. Läsning ska gå.

**Om Vilgot redan har en poäng** avbryter skriptet utan att skriva.

**Testposten tas bort så här:** reglerna förbjuder radering, så skriptet kan inte ta bort testposten (poäng 2) utan nyckel. Välj ett av två sätt:
- Sätt `FIREBASE_DB_SECRET` före kommandot (`FIREBASE_DB_SECRET=… npm run rules:check`). Hemligheten hittar du i **Projektinställningar → Service accounts → Database secrets**. Lägg den aldrig i repot.
- Ta bort `scores/vilgot` för hand under fliken **Data**.

Skriptet avslutar med felkod om någon kontroll ger fel resultat.

## Ljud

Alla ljud (även minispelets hopp, levelbyte och dödsljud) är syntetiserade 8-bitarsljud (fyrkant- och triangelvågor, brus för grävljudet) i `SYNTHS` i `src/main.ts`. Det finns inga ljudfiler. Ljudet startar först vid ett tryck (krav i iOS), ljudknappen i high score-delen stänger av allt, och valet sparas i `localStorage` (`vilgots-kalas-mute`).

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

Sviten (`qa/verify.spec.ts`) startar `npm run preview` själv. Alla anrop till Formspree fångas och besvaras med ett fejkat svar, så inga riktiga OSA-svar skickas. All trafik mot Firebase (HTTP och websocket) stoppas, och topplistan testas mot en låtsasdatabas (`window.__leaderboardBackend`). Skärmdumpar och Lighthouse-data hamnar i `qa/` (gitignorerade).

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
- **Firebase Realtime Database** (modular SDK, `firebase/app` + `firebase/database`): minispelets topplista, laddas vid behov
- **Google Fonts (Press Start 2P)**: bara för rubriker och spel-UI. Brödtexten använder systemfont
