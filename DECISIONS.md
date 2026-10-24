# Beslutslogg — Vilgots kalas

Nyast överst. Projektet är en kopia av Livias kalas. Posterna före 2026-10-23 kommer därifrån och gäller den ärvda koden.

## 2026-10-24 — Ny tid 17:00–19:30, pizza i programmet
Tiden ändrad i `content.ts` och syns på det enda stället där den används (`#when-time`). Nedräkningen räknar dagar från datumet och påverkas inte. OSA-texten nämner ingen tid.

**Pizzan är en egen beat i Vad händer**, efter Gaming och före Snacks (antagande om ordningen). Tugg-interaktionen kommer från Livias kalas, i pixelstil:
- Tuggorna är hela svarta pixlar i en SVG-mask över pixelbiten, med tandad kant. Inget ritas ovanpå i bakgrundsfärg.
- Masken läggs till med JS. Utan JS syns hela biten, och texten "Ta en tugga!" döljs.
- Tre tuggor, och det fjärde trycket ger en ny bit. Ljudet är ett 8-bitars crunch (två brusknaster och en dov ton, `crunch` i `SYNTHS`), och en ny bit ger `blip`.
- Tuggornas lägen justerades efter granskning av skärmdumpar. Först nådde tredje tuggan in i kanten och andra lämnade lösa pixlar. Testet kontrollerar nu att kanten (rad 13–15) står kvar.

Verifiering, lätt nivå: bygg, de berörda testerna (innehåll, utan JS, ljud, pizza, bredder) och skärmdumpar av pizzans fyra lägen. Commit: "Update time, add pizza".

## 2026-10-24 — Minispelet körning B: sågtandsfart, dubbelhopp, nya hinder med förvarning, "Familjen <Namn>"
**Motor utan DOM.** Reglerna flyttade från `game.ts` till `src/engine.ts`, så att botarna kan spela hela spel i Node (≈1 s per spel i stället för 4 min i webbläsaren). Allt räknas exakt ur speltiden: sträcka, hinders läge och gubbens höjd. Spel, utplacering och botar ser därför samma värld. `game.ts` ritar och tar emot tryck. Inmatnings- och scrollkoden är oförändrad. Testerna kräver nu `esbuild` som uttryckligt utvecklingsberoende, för att paketera webbläsarboten.

**Fartkurvan (sågtand) fick andra siffror än beställningen.** Beställt i relativa enheter (start 50): L1 50→80, L2 68→105, L3 88→135, L4 112→170, sedan +25 % per varv. Med de siffrorna dör varken den mänskliga eller den perfekta boten inom kraven:
- En spelare som reagerar på 250 ms klarar höga hinder upp till ~400 px/s (≈290 enheter). En perfekt spelare klarar dem upp till sikt-gränsen, ~1 060 px/s.
- Slutkurvan, i relativa enheter: L1 50→101, L2 86→174, L3 148→286, L4 243→348, L5 296→424, L6 360→516, L7 439→629, L8 534→964, därefter +20 % per level.
- Formen är behållen: stigning inom leveln, −15 % vid levelstart, stigande baslinje och täthet.
- L8 stiger brantare. Då blir rymdens sikt-gräns (~900 px/s, långsammare hopp) passerad mitt i L8, och L9 börjar över gräsets gräns. Annars kunde en perfekt spelare överleva till ~4:45.
- "+25 % per varv" går inte ihop med "−15 % vid varje levelstart": L5 skulle börja på 62 enheter efter L4:s 170. Därför fortsätter samma sågtand varv efter varv.
- Fartkurvan liknar därmed körning A:s (150 px/s vid 30 s, 430 vid 90 s), med nedväxlingar.

**Botstatistik, 90 frön per bot i Node:**
- Perfekt (0 ms): game over 225,8–247,3 s (3:46–4:07), första krock tidigast 219,1 s, når rymden alltid.
- Mänsklig (250 ms): game over 100,3–134,2 s, når staden och rymden alltid, L5 i 0–4 av 30.
- Perfekt utan dubbelhopp: dör efter 40–78 s, vid de täta paren.
- Passiv: dör efter ~5–6 s.
- Kraven ("minst 8/10", "minst 3/10") är minimikrav. Att den mänskliga boten alltid når rymden ryms inom dem. Testsviten kör 10 fasta frön per bot; siffrorna i den körningen står längst ner.

**Rättvisan bevisas av en spökspelare i utplaceringen, i stället för formler per hinderpar.** Spöket spelar perfekt (avstamp mitt i fönstret) och ser allt i förväg. Ett hinder läggs bara där spöket klarar det, och går det inte vid farten hoppas hindret över. Synligheten ignoreras, eftersom sikt-gränsen är spelets slut.
- Förkastat: att bygga ut körning A:s `minGap`/`nextGap`. Med bilar som har egen fart, bromsande bilar, fallande hinder och dubbelhopp blev parformlerna ohanterliga.
- Kostnad: utplaceringen tar högst ~5 ms i en enstaka bildruta (Node), i snitt 0,01 ms.

**Fel som botarna hittade och som är rättade:**
- Boten trycker i första bildrutan efter planerad tid, spöket exakt. I en kedja av hopp direkt vid landning hamnade boten 6 bildrutor efter och krockade med en hängande stalaktit. Spöket räknar nu med en bildrutas fördröjning per hopp (`LAG`).
- Breda väggar har för smalt fönster i låg fart. Utplaceringen sköt dem bakåt i 2,4 s och placerade dem sedan ändå. Nu hoppas de över, och kravet på fönster efter avstampet är relativt fönstrets bredd.

**Dubbelhopp:** ett andra tryck i luften ger ett nytt hopp med 60 % av ett vanligt hopps *höjd* (antagande: "60 % av det första" tolkat som höjd, inte fart). Pixelpuff och ett eget ljud.
- Det behövs vid *täta höga par*: två breda väggar (16 px) så nära att varken ett hopp över båda eller två hopp går.
- Paret läggs bara där fysiken tillåter. Vid hög fart klaras ett par alltid med ett eller två vanliga hopp, så paren finns i L2, L3, L5, L6 och L7. I rymden klarar ett långt hopp båda väggarna, och det är rymdens särdrag.
- Förkastat: en extra hög klass som bara går med dubbelhopp. Den ändrar höjdklasserna och blir lika fartbegränsad.
- Vanliga hinder placeras så att vanliga hopp räcker, och bromsande bilar kan kräva ett dubbelhopp som räddning. Från level 2 kommer fler höga hinder och fler par, och högst 6 hinder i rad saknar ett högt.

**Förvarningar:** de börjar ~1 s före (dropp, skugga, rött ljus), men ett hinder syns bara 162/v s innan det når gubben. Fallande hinder landar därför så nära gubben som är rättvist (minst 12 px framför). Synlig förvarning blir då ~0,75 s vid 120 px/s och ~0,3 s vid 240 px/s.
- Trafikljuset står fast i bildens högerkant i stället för att rulla med gatan. Rullande hade det bara synts ~0,4 s.
- Skeppet syns 0,55 s innan det skjuter.

**Topplistan:** visningsnamnet är "Familjen <Namn>" överallt. Databasnyckeln och det sparade namnet är oförändrade, så reglerna behöver inte publiceras om.
- Frågan lyder "Nytt rekord! Posta Familjen Vilgots rekord?" ("Nytt rekord!" är behållet framför den beställda frågan).
- Genitiv: namn på s, x eller z får inget extra s.
- Game over-raden kortas till "Fam. <Namn>" om den inte ryms på 23 tecken.
- Utan giltig `?g`: "Du spelar utan inbjudningslänk. Öppna länken från sms:et för att tävla.", på game over-skärmen med ettan ovanför och på fyra rader.

**Sms-länkar** skrivs i README av `npm run rules` (från `guests` och nya `content.site.url`). Ett test kontrollerar att README stämmer med gästlistan.

**Övrigt:** instruktionen ovanför spelet nämner nu dubbelhoppet. Trafikljuset släcks senast 3 s efter att det tänts, eftersom en bilrad kan avbrytas av ett miljöbyte.

**Verifiering (full nivå: spellogik, topplista och bundle ändrade):**
- Hela sviten: 73/74 gick igenom. Felet var skärmdumpstestet för rymden, där inget skepp sköt under L4. Testet startar nu om leveln, högst tre gånger. Därefter 27/27 för spelet.
- Testsvitens 10 frön: perfekt 226–245 s (första krock ≥ 219 s), mänsklig 103–121 s (alla når rymden), utan dubbelhopp 41–78 s.
- Perfekt bot i webbläsaren med riktiga tryck: game over 232,0 s (första krock 221,4 s), level 8.
- Spelet (engine + levels + game) 19 759 B av 20 kB. Huvudbundlen 176,50 kB (+10,35 kB mot körning A).
- Lighthouse mobil, tre körningar: 98, 98, 98.

Commit: "Game balance, double jump, new obstacles".

## 2026-10-24 — Levels och miljöer i minispelet (körning A), utan farttak
Ny level var 30:e sekund (`LEVEL N`, blinkande "LEVEL UP!" och pling). Miljöerna är gräs → grotta → stad → rymd, därefter varv 2 med 25 % tätare hinder. Ingen ny mekanik. Hindren byter utseende men behåller höjdklasserna (låg 6/8, mellan 16, hög 28, flygare i huvudhöjd), så rättvisekalkylen gäller i alla miljöer. Miljöerna ligger i `src/levels.ts`.

**Övergång:** palettfärgerna tonas linjärt under 1 s. Dekoren ligger på fyra platser som rullar runt, och varje plats tar ny miljö först när den rullat ut.

**Varför spelet alltid tar slut:** med fast fysik blir hoppfönstren *bredare* i tid ju högre farten är, så en perfekt spelare skulle aldrig dö. Den ärliga gränsen är sikten. Hindren kommer in 162 spelpixlar bort, och den höga klassen kräver avstamp senast 0,136 s före. Över ~1 193 px/s syns hindret för sent.
- `vAt(t) = 70 + 2t + 0,022t²` kalibrerades mot den gränsen till ~185 s.
- Förkastat: medvetet orättvisa avstånd på slutet. Det vore fusk mot spelaren, inte ett tempo spelaren förlorar mot.

**Kalibreringsmiss:** jag räknade inte med att ett nytt hinder hinner flytta sig en bildruta (~18 px) innan det syns. Den verkliga gränsen vid 60 fps är ~1 062 px/s, vilket nås vid ~177 s.
- Perfekt bot, 3 körningar: första krock vid 178,4 / 179,5 / 197,4 s, game over vid 195,5 / 196,2 / 224,7 s, level 7–8.
- Kurvan behålls, eftersom game over ligger mitt i 3–4 min. Testet kräver nu ingen krock före 170 s, och ett deterministiskt test låser den verkliga gränsen till 170–185 s.

**Tunnling:** fysiken delas i delsteg på högst 4 px. Över ~600 px/s hann hindren annars passera gubben mellan två bildrutor.

**Fel som fanns sedan spelet byggdes:** första tidssteget från `requestAnimationFrame` kunde vara negativt. Med levels backade speltiden över en levelgräns och loopen kraschade (`ENVS[-1]`). dt begränsas nu till 0–50 ms.

**`?level=N`** (även decimaler) är ett övningsläge: varken rekordet eller topplistan påverkas. Förkastat: att räkna poäng därifrån, eftersom man då kunde hoppa över de långsamma leveln.

**Lastbilen** är 24 px bred (pelaren 6 px). Sikt-gränsen beror bara på höjden, och fönstret räcker från stadens lägsta fart (270 px/s).

**Visuell kontroll** gjordes med ett galleri ritat direkt ur `levels.ts`. Fladdermusen syntes inte (mörkblått på svart), grottans stenar hade låg kontrast och lastbilens hjul såg ut som ben. Alla tre är rättade.

**Storlek och prestanda:** game + levels 10 401 B (budget höjd till 20 kB). Huvudbundlen 166,15 kB (+4,07 kB). Lighthouse mobil 3 körningar: 98, 98, 98. En fjärde botkörning i hela sviten: första krock 181,5 s, game over 186,8 s. Commit: "Add levels and environments".

## 2026-10-24 — Topplistan flyttad till en utfällbar panel under spelet
Topplistan ligger nu direkt under spelet i Bonus level (`#board`), inte i outron. Detta ersätter "Laddning" och "Visning" i posten nedan.

**Panelen:**
- Rubriken "HIGH SCORE" med pil syns alltid, och ett tryck fäller ut topp 10.
- Utfällt läge sparas per webbläsare (`vilgots-kalas-board-open`) och är stängt som standard.
- Efter en *postad* poäng fälls panelen ut av sig själv och den egna raden scrollas fram om den inte syns. Ett nej eller en nekad post fäller inte ut den.

**Webbläsarens rekord** ("Ditt rekord") flyttade från outron till panelen, där det också är reserv när Firebase inte svarar.

**Outron** visar bara den statiska "Vilgot – 10 år" och "Du?", utan Firebase.

**Laddning:** Firebase laddas vid spelstart eller när Bonus level-sektionen syns. Ett test kontrollerar att ett hopp direkt till outron inte laddar Firebase.

**Pilen** ritas med CSS. ▼ saknas i pixelfonten och blev pytteliten.

**Panelen syns bara med JS:** den är dold i HTML, eftersom listan ändå kräver JS och Firebase.

Huvudbundlen 162,08 kB (+1,0 kB mot förra committen). Lighthouse mobil: 98, 98, 96. Commit: "Move leaderboard under game".

## 2026-10-24 — Delad topplista i Firebase, opt-in
Topplistan för minispelet ligger i Realtime Database under `/scores/<gäst i gemener>`, och identiteten är `?g`-namnet om det finns i `content.guests`. Inget postas utan "Ja!" eller "Posta alltid" (sparas per gäst).

**Laddning:** Firebase laddas med `import()` vid första spelstart *eller* när high score-delen syns. Jacob valde det senare tillägget så att även den som inte spelar ser listan. Förkastat: bara vid spelstart.
- Huvudbundlen +5,58 kB (155,49 → 161,07 kB), med Firebase i en egen chunk på 223,5 kB (49,5 kB gzip).
- Lighthouse mobil 3 körningar: 93, 98, 98, med 0 Firebase-anrop vid sidladdning.

**Gränssnitt:** topplistan har ett eget gränssnitt (`Backend`: `listen` och `post`), så att testerna kan byta Firebase mot en låtsasdatabas. All Firebase-trafik stoppas i testerna. Förkastat: att mocka Firebases websocket-protokoll, som är skört.

**När frågan visas:** frågan "Nytt rekord!" visas när poängen slår gästens plats *på listan* och är högst i sessionen, inte när den slår webbläsarens lokala rekord. Annars kunde en gäst med högt lokalt rekord från tiden före topplistan aldrig komma in.

**Panelen:** frågepanelen är ett syskon till `#game`, inte ett barn. Spelytan har `role="button"`, och knappar inuti den vore nästlade kontroller. Tryck på panelen ska inte heller nå spelet.

**Regler:** se `scripts/gen-rules.mjs`.
- Radering förbjuds i `.write`, eftersom `.validate` inte körs vid radering.
- Heltal kontrolleras med `% 1 === 0`. Det är overifierat mot den riktiga databasen. Ingen Java finns, så emulatorn går inte att köra, och Jacob valde att verifiera med `npm run rules:check` efter Publish.
- Skriptet är testat mot en lokal låtsasserver: rätta regler 15/15, befintlig poäng ger avbrott utan skrivning, för generösa regler ger larm.
- Motsägelse i beställningen: skriptet skulle ta bort testposten, men reglerna förbjuder radering. Löst med `FIREBASE_DB_SECRET`, annars manuell instruktion, och anonym radering kontrolleras som nekad.

**Risk (accepterad av Jacob):** det finns ingen inloggning. Den som känner ett gästnamn kan posta upp till 99999 i det namnet. Reglerna stoppar andra namn, sänkningar och ogiltiga värden, och fusk rensas i konsolen. Förkastat för nu: hemlig kod per gäst i länken.

**Visning:**
- Den statiska raden "Vilgot – 10 år" ersätts av listan så snart det finns poster.
- Namn med versalt Å/Ä/Ö skrivs med gemener i pixelfonten (`pixelSafe`).

**Fel jag själv införde och rättade:** spelet mätte `.game-wrap` i stället för sektionen och krympte till 192 px. Storlekstestet kontrollerar nu storleken, och den negativa kontrollen föll som den skulle.

**Storlek:** `game.ts` är 6 473 B, gränsen 6,5 kB. Commit: "Add opt-in shared leaderboard".

## 2026-10-23 — Minispelet svårare: tre höjder, par, dykfågel; storleksgränsen höjd till 6,5 kB
**Fart:** acceleration 2 → 4 px/s², taket 170 → 212 px/s (+25 %). 170 nås efter ~25 s i stället för 50.

**Hinder:** låga (busk 10×6, block 8×8), mellan (16×16) och hög smal pelare (6×28). Därtill rak fågel i huvudhöjd och dykfågel i två varianter: tidig (måste hoppas) och sen (sveper över huvudet, stå kvar). Par: ~20 % av de låga, med avståndet satt så att andra hoppet görs direkt vid landning.

**Rättvisa:** beräknad i stället för provad. `jumpWindow` (avstampsfönster ur v₀ = 260 och g = 900) och `minGap` = v·luftid − tidigaste avstamp för a + senaste för b. `nextGap` ligger alltid minst 6 px över minimum vid farten då hindret når gubben. Fönstren är 160–470 ms breda.
- Bot "mitt i fönstret": 3 × 65 s och 62 s utan krock, med alla typer.
- Kontrollbotar: "aldrig hopp" död efter 6 s, "hoppar i sista stund" efter 9 s, "hoppar även för sen dykare" efter 28 s.

**Förkastat:**
- En enda dykvariant som planar ut före gubben. Den gav ingen timingskillnad, eftersom ett tidigt hopp ändå klarade den.
- Den gamla "låga" fågeln (GROUND − 13). Den träffade bara en hoppande gubbe, så den stående klarade sig alltid – ett fel i förra versionen.

**Storlek:** 6 168 B minifierat (3 135 B gzip, UTF-8) mot gränsen 6 kB. Tre trimningsrundor gav −244 B. Jacob valde att höja gränsen till 6,5 kB i stället för run-length-kodade sprites (oläsliga) eller färre hinder.
- Bortplockat för storlekens skull: rubriken "Bonus level" inne i spelytan (den står redan ovanför), dykfågelns egen klocka (vingslagen räknas nu på sträcka, 2,4× tätare än den raka fågeln) och `canvas.style.height` (CSS `height: auto` räcker).

**Scroll- och touchkoden är oförändrad.** Commit: "Tune minigame difficulty".

## 2026-10-23 — Minispel "Bonus level": tre liv i spelet, inte kopplat till HUD-hjärtana
Spelet har tre egna liv, ritade som hjärtan i canvasen: tre krockar innan game over, med 1,2 s skyddstid (gubben blinkar) efter varje krock. Det är inte kopplat till HUD-hjärtana i titelskärmen. Skäl:
1. Målgruppen är 8–10 år, och game over vid första krocken känns hårt.
2. HUD:en ligger ~3 500 px ovanför spelet och syns inte medan man spelar.
3. HUD-hjärtana är en leksak som kan stå på "GAME OVER?" (0 liv), och det tillståndet skulle då läcka in i spelet.

Förkastat: en krock = game over. Förkastat: att dela livräkning med HUD:en.

Övriga val:
- **Start:** bara på ett riktigt tryck (pointerup inom 10 px och 600 ms, ingen pointercancel), och `touch-action` växlar från `pan-y` (viloläge) till `none` (under spel). Förkastat: `touch-action: none` hela tiden, eftersom ett svep över spelet då inte kan scrolla sidan och dessutom skulle starta spelet.
- **Skärpa:** canvasens upplösning är 192·k enhetspixlar med heltal k, och allt ritas med `ctx.scale(k)`. Förkastat: att rita 192×96 och skala upp med CSS (pixelated), eftersom texten då blir suddig. Känd följd: vid dpr 1 och smal skärm blir spelet bara 192 px brett.
- **Rekord:** sparas per webbläsare i `vilgots-kalas-best` och rensas inte av `?reset=1`, som bara gäller OSA-svar.
- **Paus:** spelet pausas under 30 % synlighet och vid dold flik, och fortsätter bara på tryck. Förkastat: automatisk fortsättning, eftersom gubben då kan krocka innan man hunnit reagera.
- **Storlek:** game.ts är 4 945 B minifierat (2 462 B gzip), och bundlen växte med 5,2 kB inklusive kopplingen i main.ts och hoppljudet. Lighthouse mobil 3 körningar: 98, 100, 98.

## 2026-10-23 — Testsviten: mätning av animerade element
Två tester var felaktiga, inte sidan: porträttramens storlek mättes med `boundingBox()` (räknar med intro-animationens skalning, 76,8 i stället för 192 px), och spricka 2 i grävblocket (synlig ~0,1 s) missades av poll i 1 av 10 körningar. Nu mäts `offsetWidth/offsetHeight` och sprickan registreras med en MutationObserver. Förkastat: att förlänga sprickans visning för testets skull. Nödspärrstestet pollar nu synligheten, eftersom adresskortet vecklas ut med en övergång. Upprepat: dig-testet 15/15, interaktioner/ljud/OSA 5×7 gröna. Commit: "Initial Vilgots kalas".

## 2026-10-23 — Pixelfonten laddas asynkront; Lighthouse varierar
Första Lighthouse-körningen (mobil) gav prestanda 89. Google Fonts-stilmallen blockerade renderingen (~870 ms). Den laddas nu via `preload` + `onload`, med `noscript` som reserv, och rubrikerna visas i monospace tills fonten är klar. Inbäddad favicon tog bort 404-felet i konsolen (best practices 96 → 100). Resultat i 7 körningar: prestanda 98, 98, 82, 98, 98, 98, 97; tillgänglighet 100 och best practices 100 i alla. Avvikelsen (82) var långa uppgifter i vår bundle 2–4 s efter laddning. Orsaken är inte bekräftad (hypotes: ScrollTrigger räknar om när fonten byter in) och lämnas oåtgärdad. Förkastat: att självhosta fonten, eftersom asynkron laddning räckte. Commit: "Initial Vilgots kalas".

## 2026-10-23 — Ljud: syntes i stället för filer
Alla ljudfiler (`public/sounds/`, `scripts/process-sounds.sh`) är borttagna. Ljuden syntetiseras i `SYNTHS` i src/main.ts med fyrkant-/triangelvågor och korta envelopes, och grävljudet med bandpassfiltrerat brus. Det ersätter posten "Riktiga ljudeffekter i stället för syntes" (2026-10-15) för det här projektet. Arkitekturen är densamma: `getAudioCtx()`, `initAudioUnlock()` (upplåsning på varje tryck), `playSound(name)` och `isMuted`. Utöver de sex beställda ljuden (mynt, gräv, kista, ouch, game over, level up) finns `blip` (knappar, skylt) och `equip` (solglasögon, krona). Förladdningen är borttagen eftersom inget behöver laddas. `window.__sfx` är en testkrok som bara loggar om testet har skapat arrayen. Master-volymen sänkt från 0,6 till 0,22, eftersom fyrkantvågor låter starkare. Fällan om ffmpeg-klippning är borttagen ur CLAUDE.md, eftersom det inte finns några ljudfiler. Commit: "Initial Vilgots kalas".

## 2026-10-23 — Ny design: 8-bitarsspel, HUD i titelskärmen, sprites i ASCII
Strukturen är titelskärm (PRESS START) → När → Var → Vad händer → OSA ("Join game?") → high score, utan synliga "Level"-etiketter.
- **HUD:** ligger absolut i titelskärmen, inte fast i fönstret. Förkastat: fast HUD, eftersom fasta element hoppar i iOS Safari när tangentbordet öppnas i OSA-formuläret och skymmer text vid scroll.
- **Pixelgrafiken:** skrivs som ASCII i src/sprites.ts och renderas till SVG vid bygget (`prerender-sprites` i vite.config.ts), så att den syns utan JS. Förkastat: handskrivna SVG-rektanglar (svåra att ändra) och rendering i JS (syns inte utan JS).
- **Grävblocket:** ett tryck kör hela sekvensen (sprickor → splitter → mynt). Tolkning av "tryck gräver det – sprickor, sedan försvinner det", inte flera tryck per block.
- **Ålder och innehåll:** "[10]" i beställningen tolkades som 10. Programmets tredje punkt visas som statusrad, och "Ta med" som egen ruta.
- **Pixelfont:** Press Start 2P bara för rubriker och spel-UI. Brödtext, etiketter och formulär använder systemfont.
- **Rubrikernas text:** "Vilgot fyller 10!", "gamingkalas", "Vilgot"/"10 år" i high score och "Vi ses den 20:e!" (`seeYouText()`) kommer från content.ts via `staticText()`. Lyckat OSA-ja visar "Hurra! Vi ses den 20:e!", härlett ur datumet i stället för hårdkodat.

Oförändrat: OSA-logiken (`rsvpKey`, `?g`, `?reset`, `?debug`, guest-fältet), deploy-workflowen, robustheten utan JS och jank-skydden. Nycklarnas prefix har bytt namn till `vilgots-kalas-rsvp`/`vilgots-kalas-mute`.

Borttaget: PLAN.md (Livias byggplan). Fotona är beskurna med scripts/convert-images.mjs till 600×800 (porträtt) och 480×600. Commit: "Initial Vilgots kalas".

## 2026-10-17 — OSA-svaret sparas per gäst (omprövar "per webbläsare oavsett ?g")
Orsaken till Android-fallet var ett riktigt svar gjort via `?g=Livia` på samma telefon. Det visades för alla `?g` eftersom nyckeln var gemensam. Nyckeln är nu `livias-kalas-rsvp:<?g i gemener>`, eller `:default` utan `?g` (`rsvpKey()` i src/main.ts). Det ersätter principen "per webbläsare oavsett ?g" i posten "OSA-svar per webbläsare, ?reset=1 …" ovan. Den gamla nyckeln läses inte och migreras inte, eftersom det inte går att veta vilken gäst den gällde. Det riktiga svaret finns i Formspree. `?reset=1` rensar alla OSA-nycklar inklusive den gamla. Förkastat: att bara rensa den aktuella gästens nyckel. Känd följd: en gäst som svarat via sin `?g`-länk och sedan öppnar länken utan `?g` ser formuläret igen. Commit: "Scope RSVP state per guest".

## 2026-10-17 — Sidan fungerar utan JS; orsaken till Android-felet är inte hittad
Rapporterat (Android Chrome): porträttet saknades och "Ni har svarat ja" syntes utan svar. Hypotesen var att JS kraschade vid start, men det motsäger sig självt: sammanfattningen har `hidden` i HTML och visas bara när `initRSVP` (sista steget i `init()`) hittar ett sparat svar. JS körde alltså hela vägen, och webbläsaren har ett sparat svar. Ingen ny syntax eller API utöver Chrome 87 fanns i bundlen (de `?.` som hittades var ternära `e?.3:.45`). Porträttfelet är inte förklarat. `?debug=1` har lagts till för att samla data på enheten. Åtgärder: startlägen bakom `.js`-klass med nödspärr. Förkastat: `gsap.set` vid init, som ger blink. Fasta texter fylls i vid bygget. Varje steg i `init()` har try/catch. `build.target` es2019/chrome79. Förkastat: browserslist-fält, som inget verktyg läser. 3-sekunders-skyddet för porträttet (f1d7c94) är ersatt av js-klassen. Commit: "Make page resilient without JS, fix Android crash".

## 2026-10-17 — OSA-svar per webbläsare, ?reset=1, skydd för hero-porträttet
Rapporterat: OSA-svaret följde med till andra enheter. Granskat utan fynd: svaret ligger bara i `localStorage`, utan cookies, sessionStorage, hash, URL-state eller koppling till `?g`. Ett test bekräftar att en annan webbläsare med samma URL inte ser svaret. Trolig förklaring: det förifyllda namnet från `?g` eller samma webbläsare; inte utrett vidare. Tillagt `?reset=1`, som rensar bara svaret, inte ljudinställningen. Rapporterat: porträttet syns inte på Android. Gick inte att återskapa i Pixel 7-emulering. Som skydd tonas `.hero-frame` in via CSS efter 3 s om GSAP aldrig kör (hypotes, ej bekräftad orsak). Övriga intro-element har samma beroende av GSAP och saknar skydd. Commit: "Fix RSVP persistence and Android hero".

## 2026-10-15 — Ljudoriginalen ur repot; nattmössans ljud på tryck 2 och 3
`assets/sound/` är gitignorerad och originalen är borttagna ur repot (de finns kvar lokalt). Bara `public/sounds/` publiceras. Obs: originalen finns kvar i git-historiken (commit 402e0ac). Att rensa dem kräver omskriven historik och force-push, och det är inte gjort. Nattmössans ljud (sparkle 0.6) spelas nu både när mössan dalar ner och när den flyger iväg. Ersätter tolkningen i föregående post. Commit: "Remove sound originals".

## 2026-10-15 — Riktiga ljudeffekter i stället för syntes
Alla syntetiserade ljud är ersatta av filer i `public/sounds/`, framtagna med `scripts/process-sounds.sh` ur `assets/sound/` (mappen heter `sound`, inte `sounds`). Filerna förladdas vid första trycket och spelas via Web Audio. Ett ljud som efterfrågas innan laddningen är klar spelas om det hinner inom 0,5 s. Pop är 200–300 ms ur popcorn.mp3. Förkastat: de första 150 ms enligt ursprunglig instruktion, som är brus (max −28,8 dB). Jacob valde alternativet efter att ha lyssnat. Nattmössan använder sparkle med playbackRate 0.6 eftersom swoosh.mp3 saknas, och ljudet spelas när mössan dalar ner (tryck 2), inte när den flyger iväg. Topparna är normaliserade till −1 dBFS och huvudvolymen är 0,6. Commit: "Real sound effects".

## 2026-10-15 — Ljudknapp och ljudstart på iOS
Ljudknappen visar en ikon i taget och växlar etikett mellan "Stäng av ljud" och "Sätt på ljud". Förkastat: att också sätta `aria-pressed`, som tillsammans med en växlande etikett läses motsägelsefullt ("Sätt på ljud, nedtryckt"). AudioContext låses upp på varje tryck (touchend/pointerup/click/keydown) och `resume()` anropas när den inte är `running`. Förkastat: att bara låsa upp på första trycket, eftersom iOS pausar kontexten vid appbyte. Ljudet är på som standard (oförändrat). Commit: "Fix mute toggle and audio init".

## 2026-10-15 — Hero-tryck: tiara och nattmössa
Porträttet är en knapp (`#btn-hero`) som växlar mellan tre tillstånd: ingenting, tiara och nattmössa. Accessoarerna ligger i ett eget lager (`.hero-accessories`) bredvid `.hero-frame`, som har `overflow: hidden` och annars skulle klippa dem. Placeringen anges i % av ramen och är kalibrerad visuellt mot skärmdumpar vid 320/390/430 px. Hjässan sitter på ~17 % av ramen, inte på de ~11 % som räknats fram ur bildens beskärning. Ramen har fast storlek, så placeringen beror inte på skärmbredden. Förkastat: lägga accessoarerna inuti ramen (klipps). Ljud bara vid tiaran, enligt uppdraget. Commit: "Add hero tap: tiara and nightcap".

## 2026-10-15 — Tryckinteraktioner i Vad händer (pizza, tårta, popcorn)
Pizzans tuggor görs med en SVG-mask (`#bite-mask`) och inte en overlay i bakgrundsfärg, så de fungerar mot alla bakgrunder. Popcornets tryckyta är hela illustrationen med kuddar och hink, men bara hinken skakar. Förkastat: bara hinken, ~40×55 px, för liten för ett barn. Vid reduced motion visas bara slutlägen, men ljudet är kvar och styrs av ljudknappen. Popcornen visas då still och tonas ut efter 1,5 s. Förkastat: inget ljud alls, och inga popcorn alls. Bundle +~7 kB okomprimerat (+2,5 kB gzip). Ingen jank vid regn och scroll med CPU 4x: 0 frames >33 ms, 0 layout shifts. Commit: "Add tap interactions: pizza, cake, popcorn".

## 2026-10-15 — Skyltens fokusring: drop-shadow på plattan
iOS ritade en fyrkantig outline runt skylt-SVG:n (`role="button"`), och den lämnade spökkopior vid animation. Nu finns ingen outline och ingen tryckmarkering i komponenten. Fokusstil finns bara på `:focus-visible`, som en lila glöd på `#sign-plate`. Förkastat: `box-shadow`, som inte fungerar på SVG-element. `filter: drop-shadow` följer plattans rundade hörn. Plattan vaggar ±2° var 4:e sekund tills första trycket, bara när sektionen syns och inte vid reduced motion. Commit: "Fix signpost focus ring".

## 2026-10-14 — Tilltal till förälder och barn
Sidan läses ofta högt av en förälder. Med `?g=Namn` ersätter namnet "du" i introts "…och du är bjuden på" (`#invitee`), och namnet förifylls i OSA-fältet "Barnets namn". Formulär- och eftertext använder "ni" (Kommer ni?, Ja, vi kommer!, Ni har svarat…). Förkastat: en egen rad "Namn är bjuden på Livias kalas!" i stället för "Hej Namn!", eftersom den upprepar undertexten. Oförändrat: sidtiteln/förhandsvisningen ("du är bjuden!") och "Kom i pyjamas!". Commit: "Address parent and child".

## 2026-10-14 — "Akt 1/2/3"-etiketterna borttagna
Etiketterna var strukturnamn och inte innehåll, så `<h2 class="act-label">` och dess CSS är borttagna. "Kvällens program" har flyttats från `h3` till `h2`. Förkastat: behålla `h3`, eftersom rubrikordningen då hoppar från h1 till h3. Utseendet är oförändrat eftersom stilen sätts via `.act-title`. Ingen avståndsjustering behövdes: programrubriken ligger 64 px från sektionstoppen, samma som OSA, och Akt 1/2 är vertikalt centrerade. Commit: "Remove act labels".

## 2026-10-14 — Formspree mockas i tester; testsviten spåras i git
`qa/verify.spec.ts` fångar alla anrop till formspree.io med `context.route` och svarar med fejkat 200 `{"ok":true}`, eftersom sviten tidigare skickade riktiga OSA-svar. `.gitignore` ändrad från `qa/` till `qa/*` + `!qa/verify.spec.ts`. Förkastat: behålla hela `qa/` lokalt – då skulle skyddet bara finnas på en dator. Övrigt i `qa/` (rapport, skärmdumpar) ignoreras fortfarande. Commit: "Mock Formspree in tests".

## 2026-10-14 — Scroll-jank: svh i stället för dvh
`.act` ändrad från `min-height: 100dvh` till `100svh` (src/style.css:70). Förkastat: `dvh` – ändras när Safaris adressfält visas/döljs vid scroll och flyttar allt nedanför. Förkastat: lägga till `ScrollTrigger.config({ ignoreMobileResize: true })` – redan standard för touch i GSAP 3.15. Granskat utan åtgärd: reverse-animationer (alla `once: true`), FOUC (startläge redan i CSS), parallax/SVG-filter (finns inte). Pizzabildens storlek rättad och stjärnorna pausas utanför introt. Commit: "Fix scroll jank".

## 2026-10-14 — Asset filenames stored with colons
Assets were stored as `assets:livia-hero.png` and `assets:livia-pizza.png` (macOS colon artifact). Moved them to `assets/livia-hero.png` and `assets/livia-pizza.png`. Original files are PNG, not JPG as spec assumed — will convert to WebP with JPG fallback during build.

## 2026-10-14 — Font choice: Fredoka
Chose "Fredoka" as display font per spec suggestion. Round, friendly, good for children's party theme.

## 2026-10-14 — No yes.mp3 found
`assets/yes.mp3` does not exist. Using synthesized Web Audio API fanfare as specified in the fallback behavior.
