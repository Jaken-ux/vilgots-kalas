# Vilgots kalas — inbjudan

Mobilanpassad, ensidig inbjudningssida till Vilgots 10-årskalas (gamingkalas). Sidan är byggd som ett 8-bitars spel: en titelskärm med PRESS START, sedan "nivåerna" När, Var och Vad händer, OSA som "Join game?" och sist en high score-lista. Byggd med Vite + vanilla TypeScript, GSAP-scrollanimationer och Formspree-formulär. Koden är en kopia av Livias kalas med samma funktioner men ny design (se DECISIONS.md).

## Vad sidan innehåller

| Del | Innehåll | Tryckinteraktion |
|---|---|---|
| Titelskärm (`#intro`) | Porträtt, titel, PRESS START (länk till När), HUD och mark | Porträttet: solglasögon → krona → av. Hjärtana uppe till vänster: varje tryck tar ett liv ("OUCH!"), vid noll "GAME OVER?", nästa tryck "EXTRA LIFE!". Blocket i marken: sprickor, splitter, ett mynt räknas i myntverket uppe till höger, nytt block efter 3 s |
| När (`#act-when`) | Datum, tid, nedräkning som mynträkneverk | – |
| Var (`#act-where`) | Skylt och skattkista | Skylten vecklar ut en skattkarta med adress och kartlänkar. Kistan öppnas med ett regn av pixelmynt |
| Vad händer (`#act-program`) | Gaming, snacks, ta med (egen ruta) | – |
| Bonus level (`#act-bonus`) | Minispel i `<canvas>` (src/game.ts, src/engine.ts) och topplistan under det | Tryck startar, tryck = hopp, ett tryck till i luften = dubbelhopp. Fyra miljöer med egna hinder. Tre liv. Under spelet: utfällbar "HIGH SCORE"-panel med den delade topplistan |
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

Tre filer, utan bibliotek:
- `src/engine.ts`: reglerna, utan DOM. Fart, hopp och dubbelhopp, hinder, krockar och utplacering.
- `src/levels.ts`: miljöer, hinder och fysik per miljö.
- `src/game.ts`: ritning, tryck och loop.

Budget 20 kB minifierat för alla tre. Nu 19 759 B (≈9 kB gzip), mätt med esbuild `--charset=utf8`, som bygget levererar.

Spelet räknar i spelpixlar (192×96). Canvasen får bredden 192·k *enhetspixlar*, med k som heltal, och ritar med `ctx.scale(k)`, så varje spelpixel blir exakt k×k skärmpixlar.

- **Start:** spelet startar bara på ett riktigt tryck (eller Mellanslag/Enter), aldrig av scroll. I viloläge släpps scrollgester igenom (`touch-action: pan-y`). Under spel äts all touch (`.playing` → `touch-action: none` + `preventDefault`), så ett hopp aldrig scrollar sidan.
- **Loop:** körs med `requestAnimationFrame` bara under spel. Spelet pausas när det är mindre än 30 % synligt eller fliken döljs, och fortsätter bara på tryck.
- **Exakt värld:** allt räknas ur speltiden.
  - Sträckan är integralen av fartkurvan (`distAt`).
  - Varje hinders läge är en funktion av sträckan (`xAt`).
  - Gubbens höjd räknas ur hoppets startögonblick (`fy`).
  - Spelet, utplaceringen och botarna ser därför samma värld, oavsett bildfrekvens.
  - Krockar provas i delsteg på högst 4 px.
- **Hopp och dubbelhopp:** ett tryck på marken hoppar. Ett andra tryck i luften ger ett nytt hopp med 60 % av ett vanligt hopps höjd och en liten pixelpuff under gubben. Ett tredje tryck gör inget förrän gubben landat. Rymden har lägre gravitation: lika högt hopp, men 0,76 s i luften i stället för 0,58.
- **Poäng och liv:** poängen är sprungen sträcka. Tre krockar ger game over, med en kort skyddstid efter varje krock.
- **Levels och miljöer:** ny level var 30:e sekund, med "LEVEL N" upptill och "LEVEL UP!" som blinkar till ett kort pling vid bytet.
  - Miljöerna i ordning: gräs, grotta, stad, rymd. Därefter börjar varv 2.
  - Bytet sker utan paus. Himmel och mark tonar under 1 s, och bakgrundsdekoren byts när den har rullat ut.
- **Fart, sågtand:** farten stiger linjärt inom varje level och sänks 15 % vid nästa levelstart, med stigande baslinje och utan tak. Slutfarten per level (spelpixlar/s) står i `ENDS` i `engine.ts`, och efter tabellen ökar den 20 % per level. Relativa enheter där startfarten (70 px/s) = 50:

  | Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
  |---|---|---|---|---|---|---|---|---|
  | Start → slut | 50→101 | 86→174 | 148→286 | 243→348 | 296→424 | 360→516 | 439→629 | 534→964 |

  Hindertätheten följer baslinjen (`density`).
- **Spelet tar alltid slut**, även för en perfekt spelare. Hindren kommer in 162 px bort, och den höga klassen kräver avstamp tidigt. Över ~1 060 px/s (i rymden ~900 px/s, med långsammare hopp) syns de för sent.
- **Hinder i alla miljöer:** låga (6/8 px), mellan (16), höga (28), breda höga (16 px breda, 28 höga), en rak flygare i huvudhöjd och en dykare i två varianter.
  - Den tidiga dykaren ska hoppas över.
  - Den sena sveper över huvudet: stå kvar.
  - Från level 2 kommer fler höga hinder och fler par. Högst 6 hinder i rad saknar ett högt, så att spelet alltid tar slut.
  - Ett *tätt högt par* (två breda väggar) går varken att klara med ett hopp eller två, bara med hopp + dubbelhopp. Paret läggs bara där det fungerar, eftersom fysiken inte tillåter det vid alla farter. I rymden klarar ett långt hopp båda väggarna, så där behövs inget dubbelhopp.
- **Egna hinder per miljö, med förvarning:**

  | Miljö | Hinder | Förvarning | Regel |
  |---|---|---|---|
  | Grotta | Stalaktit som lossnar och landar framför gubben | Droppar från taket ~1 s innan den lossnar | Hoppa |
  | Grotta | Hängande stalaktit ner till strax ovanför huvudet | Syns | Hoppa inte |
  | Stad | Öppet brunnslock (ramlar man i är det en krock) | Locket bredvid | Hoppa |
  | Stad | Bilrad (liten snabb bil = låg, skåpbil = mellan), kör mot gubben | Trafikljuset blir rött ~1 s innan raden kommer | Hoppa, med bilens fart |
  | Stad | Bil som bromsar in precis framför gubben | Bromsljus och rök | Vänta in den, eller förläng hoppet med ett dubbelhopp |
  | Rymd | Meteorit som faller snett uppifrån och blir ett lågt eller mellanhögt hinder | Skugga på marken som växer ~1 s före nedslaget | Hoppa |
  | Rymd | Rymdskepp som skjuter ett skott | Skeppet flyger in och siktar ~0,5 s | Skott i huvudhöjd: hoppa. Skott i hopphöjd: stå kvar |

  Förvarningen börjar alltid ~1 s före, men ett hinder syns bara 162/v sekunder innan det når gubben. I hög fart syns förvarningen därför kortare (~0,3–0,75 s i grottan i varv 1).
- **Rättvisa: utplaceringen spelar själv.** En "spökspelare" i `engine.ts` hoppar mitt i varje hoppfönster, med en bildrutas fördröjning per tryck, och ser alla hinder i förväg.
  - Ett nytt hinder läggs aldrig så att spöket inte klarar det. Går det inte vid den farten hoppas hindret över.
  - Vanliga hinder ska gå med vanliga hopp. Dubbelhopp krävs bara av täta höga par och räddar bromsande bilar.
  - Synligheten räknas inte: den är spelets ärliga slut.
  - Planeringen (`plan`, `rescue`) provar hoppbanor mot hindrens träffytor var 1/480 s.
- **Botar** (`qa/bots.ts`) använder samma planering men olika kunskap. Testsviten kör dem i Node, 10 fasta frön vardera, och den perfekta också i webbläsaren med riktiga tryck.
  - Perfekt (ser allt från första bildrutan): ska nå rymden, inte krocka före sikt-gränsen och dö inom 3:30–4:30.
  - Mänsklig (reagerar 250 ms efter att ett hinder eller dess förvarning syns, och märker en inbromsning 250 ms sent): ska nå staden i minst 8/10 och rymden i minst 3/10, och dö inom 3 min.
  - Passiv: ska dö inom 15 s.
  - Perfekt utan dubbelhopp: dör vid de täta paren (bevis för att dubbelhoppet behövs).
- **Dolt `?level=N`:** börjar direkt på level N med rätt fart. Decimaler går också, till exempel `?level=1.9` för att se ett levelbyte efter 3 s. Det är ett övningsläge, så varken rekordet eller topplistan påverkas.
- **Rekord:** bästa poäng sparas per webbläsare (inte per gäst) i `localStorage` under `vilgots-kalas-best`, och rensas inte av `?reset=1`.
- **Testkrokar:** `#game` har `data-state` (idle/run/pause/over), `data-lives`, `data-score`, `data-jumps`, `data-doubles`, `data-level` och `data-env`. Finns `window.__gameHook` när spelet startar får den motorn för pågående spel (`engine()`), som botarna använder.

## Topplistan (Firebase)

Minispelet har en delad topplista i Firebase Realtime Database under `/scores/<gästnamn i gemener>` = `{ name, score, updatedAt }`. Koden ligger i `src/leaderboard.ts` (logik och visning) och `src/firebase-backend.ts` (Firebase-anropen och konfigurationen, som är publik by design).

- **Bara opt-in.** Inget postas utan att gästen trycker "Ja!" i frågan "Nytt rekord! Posta Familjen Vilgots rekord?", eller tidigare har kryssat "Posta alltid". Det valet sparas per gäst i `localStorage` (`vilgots-kalas-autopost:<gäst>`).
- **Identitet.** Gästens identitet är `?g`-namnet, men bara om det finns i `guests` i `src/content.ts` (gemener jämförs). Utan giltigt `?g` fungerar spelet som förut med lokalt rekord, och listan och game over-skärmen visar "Du spelar utan inbjudningslänk. Öppna länken från sms:et för att tävla." Länkarna att skicka finns under [Sms-länkar](#sms-länkar).
- **Visningsnamn.** Överallt på topplistan står "Familjen <Namn>" (listan, game over-skärmen och frågan). Databasnyckeln och det sparade namnet är fortfarande bara gästnamnet. Är raden på game over-skärmen för lång blir det "Fam. <Namn>".
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

1. Kör `npm run rules`. Skriptet läser `guests` och skriver om `database.rules.json` och sms-länkarna i README (kräver Node 22.18 eller senare).
2. Öppna [Firebase-konsolen](https://console.firebase.google.com/) → projektet **vilgots-kalas** → **Build → Realtime Database** → fliken **Rules**.
3. Markera allt i redigeraren och ta bort det. Klistra in hela innehållet i `database.rules.json`.
4. Klicka **Publish**.
5. Committa den nya `database.rules.json` och README tillsammans med ändringen i `content.ts`.

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

## Sms-länkar

En färdig länk per namn i `guests` (`src/content.ts`). Skicka varje gäst sin egen länk i sms:et. Bara med den kan gästen hamna på topplistan (som "Familjen <Namn>"), och namnet står i inbjudan och i OSA-formuläret. Listan skrivs om av `npm run rules` när `guests` ändras. Ändra den inte för hand.

<!-- sms-länkar:start (skrivs av npm run rules – ändra inte för hand) -->
- Vilgot: https://jaken-ux.github.io/vilgots-kalas/?g=Vilgot
<!-- sms-länkar:end -->

## Sparat OSA-svar

Svaret sparas bara i webbläsarens `localStorage`, **per gäst**: nyckeln är `vilgots-kalas-rsvp:<namn från ?g, gemener>` eller `vilgots-kalas-rsvp:default` utan `?g`. Lägg till `?reset=1` för att rensa alla sparade svar i den aktuella webbläsaren (ljudinställningen behålls). Sidan laddas då om utan parametern.

## Testa

```bash
npm run build
npx playwright test
```

Sviten (`qa/verify.spec.ts`) startar `npm run preview` själv. Minispelets botar (`qa/bots.ts`) spelar i Node direkt mot `src/engine.ts`. Webbläsarboten (`qa/bot-browser.ts`) paketeras med esbuild och trycker med riktiga tryck på spelytan. Den fryser också spelet för skärmdumparna av varje hinder (`qa/screenshot-hinder-*.png`). Alla anrop till Formspree fångas och besvaras med ett fejkat svar, så inga riktiga OSA-svar skickas. All trafik mot Firebase (HTTP och websocket) stoppas, och topplistan testas mot en låtsasdatabas (`window.__leaderboardBackend`). Skärmdumpar och Lighthouse-data hamnar i `qa/` (gitignorerade).

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
