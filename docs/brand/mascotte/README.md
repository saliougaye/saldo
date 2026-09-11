# La mascotte di Saldo — il procione

Scelto l'11 settembre 2026 dopo una ricerca su nove animali. I fogli di quella ricerca e i cinque
concept astratti scartati prima di arrivare a una mascotte stanno in `docs/design/logo/`, che è
gitignored: materiale di lavoro locale, non fa parte del repository.

Il procione è l'unico candidato che regge tre cose insieme: bicolore autentico in nero e grigio,
metafora coerente (colleziona e mette via — in italiano "orsetto lavatore"), ed espressione
amichevole a ogni misura.

## Perché non fa paura

Questa è la ragione meccanica, non un'impressione. Vale per qualunque revisione futura, 3D compreso.

- **Gli occhi sono chiari dentro una macchia scura.** Pupilla scura su faccia chiara produce uno
  sguardo fisso; occhio chiaro dentro la maschera produce uno sguardo dolce. È la leva più forte,
  più della dimensione degli occhi.
- **La massa chiara domina.** Testa grigia, nero solo su orecchie, maschera e naso. La struttura
  inversa — testa nera con un buco chiaro al posto del viso — è la grammatica della maschera.
- **Occhi al 18% del raggio testa, sotto la mediana.** Fronte grande, viso basso: proporzione da
  cucciolo.

## Palette

Tre colori semantici, tutti token di `packages/ui/src/tokens.ts`, tema light. Nessun valore inventato.

| Ruolo | Valore | Token |
| --- | --- | --- |
| Fondo | `#FFFFFF` | `palettes.light.bg` |
| Nero | `#171717` | `palettes.light.text` |
| Grigio | `#8C8C8C` | `palettes.light.textMuted` |

Gli occhi usano il colore del fondo, non un quarto colore.

## Geometria

`viewBox="0 0 64 64"`, emersione dall'angolo basso destro, il personaggio occupa circa il 90%
del quadrato ed esce dal bordo inferiore e destro.

| Elemento | Forma |
| --- | --- |
| Orecchio sinistro | `circle 19,24 r 8` nero |
| Orecchio destro | `circle 55,24 r 8` nero |
| Testa | `ellipse 37,44 rx 27 ry 23` grigio |
| Maschera sinistra | `ellipse 29,41 rx 11 ry 9.5` nero |
| Maschera destra | `ellipse 45,41 rx 11 ry 9.5` nero |
| Occhio sinistro | `circle 28,41 r 4.2` fondo |
| Occhio destro | `circle 46,41 r 4.2` fondo |
| Naso | `ellipse 37,55 rx 4.2 ry 3.2` nero |

Le due macchie della maschera si sovrappongono fra x 34 e x 40: è quella saldatura a leggere come
maschera da procione invece che come due chiazze separate.

## File

| File | Uso |
| --- | --- |
| `procione.svg` | Canonico, fondo bianco pieno. Icona app, favicon, README |
| `procione-trasparente.svg` | Senza fondo. Solo sopra superfici **chiare** |
| `procione-scuro.svg` | Senza fondo, per superfici **scure**. Le orecchie prendono il grigio della testa |
| `procione-monocromo.svg` | Solo alpha su `currentColor`. Android themed icon. La maschera diventa foro e gli occhi tornano pieni, così il viso sopravvive a un colore solo |

`generatori/verifica-varianti.html` rende i quattro file affiancati sui fondi reali. Da rieseguire
dopo ogni modifica: senza quel controllo il difetto qui sotto non si sarebbe visto.

## Difetto trovato e corretto

La prima versione trasparente aveva le orecchie in `#171717` sopra `#0A0A0A`: contrasto quasi nullo,
le orecchie sparivano e restava una testa tonda. Per questo esiste `procione-scuro.svg`, dove le
orecchie prendono il grigio della testa e la silhouette esterna diventa una massa continua.
Il canonico non è stato toccato.

## Debiti dichiarati

- **Nove forme, budget quattro–sette.** Il disegno sfora di due. Le due macchie della maschera sono
  le candidate a fondersi in un solo path se serve rientrare.
- **Somiglia a un panda.** Le macchie sono troppo simmetriche e troppo tonde. Si corregge
  inclinandole verso il naso o aggiungendo la coda anellata.
- **Connotazione.** Il procione ruba. In italiano l'associazione dominante è "orsetto lavatore",
  quindi lava e mette via, ma il rischio esiste e non è stato eliminato, solo valutato.

## Rigenerare gli asset dell'app

Le pagine in `generatori/` sono le sorgenti dei PNG spediti in `apps/mobile/assets/`. Ogni pagina è
un documento di dimensioni fisse che contiene un solo SVG; il PNG si ottiene fotografandola con
Chrome headless, che è l'unico rasterizzatore che serve.

```bash
cd docs/brand/mascotte/generatori
python3 -m http.server 8790 &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
shoot() {
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=$3,$3 --default-background-color=00000000 --virtual-time-budget=3000 \
    --screenshot="$2" "http://localhost:8790/$1"
}
A=../../../../apps/mobile/assets
shoot ios-light.html          $A/icon.png                        1024
shoot ios-dark.html           $A/ios-icon-dark.png               1024
shoot ios-tinted.html         $A/ios-icon-tinted.png             1024
shoot android-foreground.html $A/android-icon-foreground.png     1024
shoot android-background.html $A/android-icon-background.png     1024
shoot android-monochrome.html $A/android-icon-monochrome.png     1024
shoot splash-light.html       $A/splash-icon.png                  512
shoot splash-dark.html        $A/splash-icon-dark.png             512
shoot favicon.html            $A/favicon.png                       64
kill %1
```

Poi `generatori/verifica-icone.html` e `generatori/verifica-splash.html` mostrano i PNG appena
scritti sotto le maschere reali — cerchio e squircle per Android, squircle per iOS.

Due vincoli che il formato impone e che non vanno violati:

- **Le tre icone iOS devono restare opache.** iOS rifiuta un canale alpha. Le pagine iOS hanno un
  fondo CSS pieno proprio per questo.
- **Le due Android devono avere alpha.** Il launcher compone `foreground` sopra `background` e
  tinge `monochrome`.

Dopo aver rigenerato serve `npx expo prebuild -p ios --clean` (e `-p android`): `expo run` non
rifà il prebuild se la cartella nativa esiste già, e continuerebbe a spedire le icone vecchie.

## Brief per la versione 3D

Da tenere identico, altrimenti diventa un altro personaggio:

- Tre colori, gli stessi tre. Nessun colore caldo aggiunto.
- Occhi chiari dentro la maschera scura. Mai pupille scure su viso chiaro.
- Maschera saldata al centro, non due chiazze staccate.
- Orecchie tonde e smussate, entrambe visibili, nessuna punta.
- Testa più larga che alta, viso nella metà bassa.
- Volume morbido e appena accennato: niente lucido plastico, niente peluche, niente resa
  fotorealistica. Deve restare leggibile a 16 px.

## Assistente in-app

Il personaggio è pensato anche come assistente dentro l'app. Quando arriverà quel lavoro serviranno
espressioni derivate dallo stesso viso — neutro, attento, contento, preoccupato — ottenute muovendo
solo occhi e naso, senza toccare testa, orecchie e maschera. Non ancora disegnate.
