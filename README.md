# RGF Servizi Ambientali — sito web

> **STATO:** PRONTO PER LA REVISIONE DEL PROPRIETARIO — mancano il puntamento
> del dominio e il consenso a pubblicare; dal cliente servono l'endpoint del
> modulo contatti e i PDF delle certificazioni, oggi ospitati sul dominio
> attuale · aggiornato il 28/08/2026

Redesign completo di [rgfambiente.it](https://rgfambiente.it): sito statico ultramoderno
con scena 3D interattiva, animazioni scroll-driven e ricerca Codici EER integrata.

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
css/style.css       design system completo (dark theme, glassmorphism, responsive)
js/scene.js         scena 3D Three.js: autoarticolato con cisterna cromata al tramonto
js/main.js          preloader, smooth scroll, animazioni GSAP, ricerca EER, form
js/cer-data.js      dataset Codici EER (285 voci: 20 capitoli + 265 codici)
assets/favicon.svg  favicon
assets/og.jpg       immagine social 1200×630 (render 3D + branding)
robots.txt          direttive crawler
sitemap.xml         sitemap
foto rgf/           foto di riferimento del parco mezzi (art direction)
```

## Tecnologie

- **Three.js** (via CDN, importmap) — hero 3D: autoarticolato con cisterna cromata
  modellato proceduralmente, ispirato alle foto reali del parco mezzi (motrice +
  semirimorchio cisterna a 3 assi, scritta "RGF ambiente", fascia verde), luce da
  tramonto con environment map personalizzata, ombre soft, parallasse mouse e
  inquadrature adattive per mobile/tablet/desktop
- **GSAP + ScrollTrigger** (CDN) — reveal, timeline processo, parallasse
- **Lenis** (CDN) — smooth scrolling inerziale
- Font: Sora / Inter / JetBrains Mono (Google Fonts)
- Nessun build step: deployabile così com'è su qualsiasi hosting statico
  (Netlify, Vercel, GitHub Pages, FTP tradizionale)

Tutte le librerie hanno fallback: senza CDN il sito resta pienamente leggibile
e navigabile. `prefers-reduced-motion` disattiva le animazioni.

## Qualità verificata

- **Accessibilità**: contrasti testo ≥ 4.5:1 e bordi dei controlli ≥ 3:1 (WCAG AA
  1.4.3 e 1.4.11), verificati a runtime compositando gli sfondi reali; aree touch
  ≥ 44px; skip-link che sposta davvero il focus e aggiorna l'hash; `:focus-visible`;
  gerarchia heading senza salti; un solo `<h1>`; menu mobile con `inert`, blocco
  dello scroll, focus in ingresso ed ESC in uscita; nessun'ancora morta né id duplicato.
- **SEO/social**: canonical, Open Graph e Twitter Card con immagine dedicata,
  JSON-LD `LocalBusiness` validato, robots.txt e sitemap.xml.
- **Responsive**: nessun overflow orizzontale da 375px in su; la scena 3D adatta
  inquadratura, risoluzione e qualità delle ombre alla dimensione dello schermo.
- **Performance**: loop 3D sospeso quando la hero esce dal viewport, pixel ratio e
  shadow map ridotti sotto i 900px, preconnect verso font e CDN.
- **Stampa**: foglio di stile dedicato (nasconde 3D e form, espande gli URL).

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
