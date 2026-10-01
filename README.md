# RGF Servizi Ambientali — sito web

> **STATO:** PRONTO PER LA REVISIONE DEL PROPRIETARIO — aggiornato il 01/10/2026
> con i film Higgsfield e i fatti nuovi (AIA rinnovata l'08/01/2026, stato dei
> codici EER). Mancano il puntamento del dominio e il consenso a pubblicare;
> dal cliente servono l'endpoint del modulo, i PDF da spostare dal dominio
> attuale e la conferma dello stato dei codici (vedi `FATTI.md`).

Redesign completo di [rgfambiente.it](https://rgfambiente.it): sito statico ultramoderno
con film d'apertura (dal 01/10/2026 al posto della scena 3D), animazioni scroll-driven e ricerca Codici EER integrata.

Su `rgfambiente.it` risponde ancora il WordPress precedente, con il copyright
fermo al 2020.

## Anteprima locale

Dalla radice di `SITI/`, la voce `rgf` di `.claude/launch.json`, oppure:

```bash
node ../../serve-statico.mjs 01-clienti/rgf-servizi-ambientali 4182
```

Poi aprire <http://localhost:4182>. Il vecchio comando `npx http-server`
scaricava un pacchetto da internet a ogni avvio: non serve, il server statico
del portfolio è in casa e non ha dipendenze.

## Struttura

```
index.html          pagina unica (one-page, sezioni ancorate)
css/style.css       design system (fondo scuro, vetro, responsive), caratteri in casa
js/main.js          preloader, scorrimento, animazioni GSAP, ricerca EER, modulo
js/film.js          carica e fa girare i film solo quando sono in vista
js/eer.js           265 codici EER con lo stato presso RGF (in impianto / intermediazione)
js/vendor/          GSAP 3.12.5, ScrollTrigger, Lenis 1.1.14 — in casa, non da CDN
assets/fonts/       Archivo (wdth), Manrope, JetBrains Mono — da @fontsource-variable 5.x
media/              4 film (tramonto in apertura; serbatoi, cisterna, magazzino nelle bande),
                    versioni 1060/1280 e 720 px, poster
FATTI.md            i fatti verificati il 01/10/2026, con le fonti e cosa chiedere
sorgenti/           film grezzi Higgsfield, foto del sito vecchio, scena 3D di agosto,
                    risposta di find-cer.php — non pubblicati (.vercelignore)
scripts/            media.mjs (prepara i film), sequenza.mjs e controllo.mjs
                    (copiati da usteria-della-lella/scripts)
```

## I film (Higgsfield, 01/10/2026)

Kling 3.0 std, 5 s, muti, dalle foto vere: 4 × 7,5 = **30 crediti**, il budget
dato da Fabio. Montati in andata e ritorno per un ciclo senza scatto. Numeri dei
serbatoi, targa «R» e targhe dei mezzi controllati fotogramma per fotogramma:
invariati. L'apertura viene da uno screenshot Instagram di 403×302 px, quindi
è morbida: sopra un velo scuro regge; per averla nitida serve una foto grande
della cisterna al tramonto, o rigenerarla da un ingrandimento (+9,5 crediti).
Una prova con grafica chiara è nel ramo `prova-chiara-2026-10-01`: scartata.

## Tecnologie

- **Film d'apertura** in `<video>` muto: sui grandi schermi occupa i due terzi
  di destra e sfuma nel cielo del fondo; sul telefono inquadra la cisterna
- **GSAP + ScrollTrigger** (in casa, `js/vendor/`) — reveal, timeline processo, parallasse
- **Lenis** (in casa) — smooth scrolling inerziale
- Font: Archivo / Manrope / JetBrains Mono, file in `assets/fonts/`
- Nessun build step: deployabile così com'è su qualsiasi hosting statico
  (Netlify, Vercel, GitHub Pages, FTP tradizionale)

Tutte le librerie hanno fallback: senza JavaScript il sito resta pienamente leggibile
e navigabile. `prefers-reduced-motion` disattiva le animazioni.

## Qualità verificata

- **Accessibilità**: contrasti testo ≥ 4.5:1 e bordi dei controlli ≥ 3:1 (WCAG AA
  1.4.3 e 1.4.11), verificati a runtime compositando gli sfondi reali; aree touch
  ≥ 44px; skip-link che sposta davvero il focus e aggiorna l'hash; `:focus-visible`;
  gerarchia heading senza salti; un solo `<h1>`; menu mobile con `inert`, blocco
  dello scroll, focus in ingresso ed ESC in uscita; nessun'ancora morta né id duplicato.
- **SEO/social**: canonical, Open Graph e Twitter Card con immagine dedicata,
  JSON-LD `LocalBusiness` validato, robots.txt e sitemap.xml.
- **Responsive**: nessun overflow orizzontale da 375px in su; il film d'apertura
  cambia inquadratura e risoluzione (720 px) sul telefono.
- **Performance**: film caricati solo in vista e fermati fuori vista; con
  «riduci movimento» o risparmio dati resta il fotogramma fermo. Zero richieste
  verso terzi (verificato con `scripts/controllo.mjs` il 01/10/2026).
- **Stampa**: foglio di stile dedicato (nasconde film e form, espande gli URL).

## Contenuti

Tutti i dati aziendali provengono dal sito attuale (rilevazione 27/07/2026):
storia (1991/1997), impianto 7.000 m² AIA (DD11 del 08/01/2026), gruppo di 4 società
(RGF, O.R.S.A., Facchetti Fabio, S.E.B.), Albo Gestori Ambientali MI01055
(cat. 1F, 4E, 5F, 8C, 9C), certificazioni UNI EN ISO 9001:2015 (n. 5331) e
14001:2015 (n. 17019), fotovoltaico con autosufficienza energetica.

## Prima di pubblicare

- **Escludere `foto rgf/`** dalla cartella pubblicata: sono screenshot di
  riferimento per l'art direction (~350 KB), non referenziati da nessuna pagina,
  che verrebbero comunque serviti pubblicamente.
- **Aggiornare i link ai PDF** in sezione Documenti e nel footer: puntano a
  `rgfambiente.it/wp-content/…`, quindi al sito attuale.
- Verificare che `assets/og.jpg` sia raggiungibile all'URL dichiarato nei meta
  Open Graph, altrimenti l'anteprima social resta vuota.

## Note operative

- **Form contatti**: apre il client di posta con richiesta precompilata (`mailto:`).
  Non essendo possibile sapere se l'apertura riesce, il messaggio di conferma mostra
  sempre anche telefono, indirizzo email in chiaro e un pulsante per copiare il testo;
  oltre 1900 caratteri l'URL viene ridotto al solo oggetto. **Resta la soluzione
  debole del sito**: per un canale affidabile collegare Formspree o un endpoint
  proprio nella funzione di submit in `js/main.js`.
- **Dataset CER** (`js/cer-data.js`): indicativo, con disclaimer in pagina.
  Ampliabile aggiungendo voci `{ c, d, p }`.
- **PDF certificazioni** nel footer: puntano ai file sul dominio attuale
  rgfambiente.it — aggiornare i link quando si migra l'hosting.
